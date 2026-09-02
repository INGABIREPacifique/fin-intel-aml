// supabase/functions/ingest-transaction/index.ts
//
// The real webhook endpoint a bank, mobile money provider, or trading
// venue would POST transactions to in a production deployment. No real
// institution is connected today — that requires an actual partnership
// agreement, which can't happen from this environment — but this endpoint
// is genuinely functional: authenticate a real institution with a real
// API key (reusing the platform's existing api_keys system, generated on
// the API Gateway screen), and a submitted transaction really does flow
// into detection and can really create a case an analyst works.
//
// Deploy with the Supabase CLI from the project root:
//   supabase functions deploy ingest-transaction --no-verify-jwt
//
// (--no-verify-jwt because this endpoint authenticates institutions via
// their own API key in the Authorization header, not a staff Supabase
// session — a different, deliberate auth model from the rest of the app.)
//
// Expected request:
//   POST /functions/v1/ingest-transaction
//   Authorization: Bearer <api key from the API Gateway screen>
//   Content-Type: application/json
//   {
//     "external_transaction_id": "TXN-2026-04521",
//     "sender_account": "GB29NWBK60161331926819",
//     "sender_name": "Apex Global Trading LLC",
//     "sender_bank_bic": "NWBKGB2L",
//     "receiver_account": "US64SVBKUS6S3300958879",
//     "receiver_name": "Quantum Logistics Inc.",
//     "receiver_bank_bic": "SVBKUS6S",
//     "amount": 250000.00,
//     "currency": "USD",
//     "transaction_type": "wire_transfer",
//     "occurred_at": "2026-08-30T14:22:00Z"
//   }
//
// Three real, working detection heuristics run on every ingested
// transaction — documented honestly: these are genuine rules operating on
// genuine submitted data, not placeholders, but each is one specific rule
// among the many a production system would need (sanctions-adjacent
// counterparties, velocity anomalies, and more are modeled in the Risk
// Engine Config screen's UI but not yet wired to live data):
//
//   1. Rapid pass-through / layering — an entity receives funds and sends
//      85%+ of them back out within 48 hours (above a $10,000 floor to
//      avoid flagging trivial transfers).
//   2. Structuring / smurfing — a sender makes 3+ transactions within 24
//      hours, each individually under the real $10,000 U.S. Bank Secrecy
//      Act Currency Transaction Report threshold, summing to $10,000 or
//      more — the textbook definition of structuring to evade reporting.
//   3. Circular flow / round-tripping — funds sent from A to B are sent
//      back from B to A within a 7-day window, a direct two-hop round trip.
//
// All three create or update a real alert (and, on first creation, a
// matching cases row) exactly like a manually-entered one — visible in the
// existing Alert Queue and Case Detail screens.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RAPID_PASS_THROUGH_WINDOW_HOURS = 48;
const RAPID_PASS_THROUGH_MIN_SWEEP_RATIO = 0.85;
const RAPID_PASS_THROUGH_MIN_AMOUNT = 10000;

const STRUCTURING_WINDOW_HOURS = 24;
const STRUCTURING_REPORTING_THRESHOLD = 10000; // real US BSA CTR threshold
const STRUCTURING_MIN_TRANSACTION_COUNT = 3;

const CIRCULAR_FLOW_WINDOW_DAYS = 7;
const CIRCULAR_FLOW_MIN_AMOUNT = 5000;

// Institution systems calling this server-to-server don't hit browser CORS
// restrictions, but this is added for consistency and in case any caller
// ever does invoke it from a browser context.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST is supported." }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const providedKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!providedKey) {
    return jsonResponse({ error: "Missing Authorization: Bearer <api key> header." }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data: apiKeyRow, error: keyErr } = await supabase
    .from("api_keys")
    .select("*")
    .eq("full_key", providedKey)
    .eq("revoked", false)
    .maybeSingle();

  if (keyErr) return jsonResponse({ error: keyErr.message }, 500);
  if (!apiKeyRow) return jsonResponse({ error: "Invalid or revoked API key." }, 401);
  if (new Date(apiKeyRow.expires_at) < new Date()) {
    return jsonResponse({ error: "API key has expired." }, 401);
  }
  if (!(apiKeyRow.scopes ?? []).includes("write:aml")) {
    return jsonResponse({ error: "This API key does not have the write:aml scope required to submit transactions." }, 403);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const required = ["sender_name", "receiver_name", "amount", "currency", "occurred_at"];
  const missing = required.filter((f) => payload[f] === undefined || payload[f] === null || payload[f] === "");
  if (missing.length > 0) {
    return jsonResponse({ error: `Missing required field(s): ${missing.join(", ")}` }, 400);
  }

  const { data: insertedTxn, error: insertErr } = await supabase
    .from("transaction_ingestion_log")
    .insert({
      api_key_id: apiKeyRow.id,
      external_transaction_id: payload.external_transaction_id ?? null,
      sender_account: payload.sender_account ?? null,
      sender_name: payload.sender_name,
      sender_bank_bic: payload.sender_bank_bic ?? null,
      receiver_account: payload.receiver_account ?? null,
      receiver_name: payload.receiver_name,
      receiver_bank_bic: payload.receiver_bank_bic ?? null,
      amount: payload.amount,
      currency: payload.currency,
      transaction_type: payload.transaction_type ?? null,
      occurred_at: payload.occurred_at,
      raw_payload: payload,
    })
    .select()
    .single();

  if (insertErr) return jsonResponse({ error: insertErr.message }, 500);

  const results = [];

  // Rapid pass-through — checked against BOTH parties on this transaction,
  // since a single transaction can complete either the receiver's pattern
  // (inbound leg) or the sender's pattern (outbound sweep leg).
  results.push(await runRapidPassThroughCheck(supabase, payload.receiver_name, insertedTxn.id));
  if (payload.sender_name !== payload.receiver_name) {
    results.push(await runRapidPassThroughCheck(supabase, payload.sender_name, insertedTxn.id));
  }

  // Structuring — checked against the sender, since structuring is
  // characterized by the sender's own pattern of small transactions.
  results.push(await runStructuringCheck(supabase, payload.sender_name, insertedTxn.id));

  // Circular flow — checked as a direct pair between the two parties on
  // this specific transaction.
  results.push(await runCircularFlowCheck(supabase, payload.sender_name, payload.receiver_name, insertedTxn.id));

  const flaggedResult = results.find((r) => r.flagged && r.alertId) ?? results.find((r) => r.flagged);

  return jsonResponse({
    success: true,
    transaction_id: insertedTxn.id,
    flagged: results.some((r) => r.flagged),
    alert_id: flaggedResult?.alertId ?? null,
    patterns_checked: results.map((r) => r.pattern),
  });
});

// Shared logic for creating or updating an automated alert — used by all
// three heuristics below, so the "update existing open alert with fresh
// totals, or create a new one with its matching cases row" behavior only
// needs to be correct in one place rather than three separately-maintained
// copies (a real bug — a missing cases row breaking Assign/Resolve — was
// already found and fixed once in this exact logic; keeping it shared
// means that fix now protects all three heuristics, not just one).
async function createOrUpdateAutomatedAlert(supabase, { entityId, matchedEntityName, pattern, riskScore, volume, windowLabel, fundsIn, fundsOut, narrative, currentTxnId }) {
  const { data: existingOpenAlert } = await supabase
    .from("alerts")
    .select("id")
    .eq("entity_id", entityId)
    .eq("pattern", pattern)
    .eq("status", "open")
    .maybeSingle();

  if (existingOpenAlert) {
    const { error: updateErr } = await supabase
      .from("alerts")
      .update({ risk_score: riskScore, volume, funds_in: fundsIn ?? null, funds_out: fundsOut ?? null, narrative })
      .eq("id", existingOpenAlert.id);
    if (!updateErr) {
      await supabase.from("transaction_ingestion_log").update({ flagged: true, resulting_alert_id: existingOpenAlert.id }).eq("id", currentTxnId);
    }
    return { flagged: true, alertId: existingOpenAlert.id, pattern };
  }

  const caseCode = `CASE-AUTO-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;

  const { data: newAlert, error: alertErr } = await supabase
    .from("alerts")
    .insert({
      entity_id: entityId,
      case_code: caseCode,
      pattern,
      risk_score: riskScore,
      volume,
      window_label: windowLabel,
      status: "open",
      funds_in: fundsIn ?? null,
      funds_out: fundsOut ?? null,
      narrative,
    })
    .select()
    .single();

  if (alertErr) return { flagged: true, alertId: null, pattern };

  const caseRiskLevel = riskScore >= 90 ? "critical" : riskScore >= 75 ? "high" : riskScore >= 50 ? "medium" : "low";
  const { error: caseInsertErr } = await supabase.from("cases").insert({
    case_code: caseCode,
    title: `${matchedEntityName} — Automated ${pattern.replace(" (Automated Detection)", "")} Detection`,
    entity_id: entityId,
    status: "active",
    risk_level: caseRiskLevel,
  });
  if (caseInsertErr) {
    await supabase.from("audit_logs").insert({
      actor_id: null,
      action: "automated_case_row_creation_failed",
      target_type: "alert",
      target_id: newAlert.id,
      target_label: caseCode,
      details: { note: caseInsertErr.message },
    });
  }

  await supabase.from("transaction_ingestion_log").update({ flagged: true, resulting_alert_id: newAlert.id }).eq("id", currentTxnId);
  await supabase.from("audit_logs").insert({
    actor_id: null,
    action: "automated_alert_created",
    target_type: "alert",
    target_id: newAlert.id,
    target_label: caseCode,
    details: { note: `Created by ingest-transaction Edge Function's ${pattern} heuristic`, entity_id: entityId },
  });

  return { flagged: true, alertId: newAlert.id, pattern };
}

// Never auto-creates a new entity from unverified webhook text — if there's
// no confident match, the caller still logs the flag but skips creating an
// alert, until a human properly resolves the entity.
async function matchEntity(supabase, entityName) {
  const { data } = await supabase.from("entities").select("id, entity_name").ilike("entity_name", entityName).limit(1);
  return data?.[0] ?? null;
}

async function runRapidPassThroughCheck(supabase, entityName, currentTxnId) {
  const pattern = "Rapid Pass-Through (Automated Detection)";
  const windowStart = new Date(Date.now() - RAPID_PASS_THROUGH_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const [{ data: inbound }, { data: outbound }] = await Promise.all([
    supabase.from("transaction_ingestion_log").select("amount").eq("receiver_name", entityName).gte("occurred_at", windowStart),
    supabase.from("transaction_ingestion_log").select("amount").eq("sender_name", entityName).gte("occurred_at", windowStart),
  ]);

  const fundsIn = (inbound ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
  const fundsOut = (outbound ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  if (fundsIn < RAPID_PASS_THROUGH_MIN_AMOUNT) return { flagged: false, alertId: null, pattern };
  const sweepRatio = fundsOut / fundsIn;
  if (sweepRatio < RAPID_PASS_THROUGH_MIN_SWEEP_RATIO) return { flagged: false, alertId: null, pattern };

  const entity = await matchEntity(supabase, entityName);
  if (!entity) return { flagged: true, alertId: null, pattern };

  const riskScore = Math.min(99, Math.round(60 + sweepRatio * 35));
  const narrative = `Automated detection: this entity received $${fundsIn.toLocaleString()} and sent out $${fundsOut.toLocaleString()} (${(sweepRatio * 100).toFixed(1)}% sweep) within a ${RAPID_PASS_THROUGH_WINDOW_HOURS}-hour window across ${(inbound ?? []).length + (outbound ?? []).length} ingested transaction(s), consistent with rapid pass-through / layering behavior.`;

  return createOrUpdateAutomatedAlert(supabase, {
    entityId: entity.id,
    matchedEntityName: entity.entity_name,
    pattern,
    riskScore,
    volume: fundsIn,
    windowLabel: `${RAPID_PASS_THROUGH_WINDOW_HOURS}h`,
    fundsIn,
    fundsOut,
    narrative,
    currentTxnId,
  });
}

async function runStructuringCheck(supabase, entityName, currentTxnId) {
  const pattern = "Structuring (Automated Detection)";
  const windowStart = new Date(Date.now() - STRUCTURING_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  const { data: recentTxns } = await supabase
    .from("transaction_ingestion_log")
    .select("amount")
    .eq("sender_name", entityName)
    .lt("amount", STRUCTURING_REPORTING_THRESHOLD)
    .gte("occurred_at", windowStart);

  const count = recentTxns?.length ?? 0;
  const total = (recentTxns ?? []).reduce((sum, r) => sum + Number(r.amount), 0);

  if (count < STRUCTURING_MIN_TRANSACTION_COUNT) return { flagged: false, alertId: null, pattern };
  if (total < STRUCTURING_REPORTING_THRESHOLD) return { flagged: false, alertId: null, pattern };

  const entity = await matchEntity(supabase, entityName);
  if (!entity) return { flagged: true, alertId: null, pattern };

  const riskScore = Math.min(97, Math.round(55 + count * 6));
  const narrative = `Automated detection: this entity sent ${count} separate transactions within ${STRUCTURING_WINDOW_HOURS} hours, each individually below the $${STRUCTURING_REPORTING_THRESHOLD.toLocaleString()} reporting threshold, totaling $${total.toLocaleString()} — consistent with structuring to evade currency transaction reporting requirements.`;

  return createOrUpdateAutomatedAlert(supabase, {
    entityId: entity.id,
    matchedEntityName: entity.entity_name,
    pattern,
    riskScore,
    volume: total,
    windowLabel: `${STRUCTURING_WINDOW_HOURS}h`,
    narrative,
    currentTxnId,
  });
}

async function runCircularFlowCheck(supabase, senderName, receiverName, currentTxnId) {
  const pattern = "Circular Flow (Automated Detection)";
  if (!senderName || !receiverName || senderName === receiverName) return { flagged: false, alertId: null, pattern };

  const windowStart = new Date(Date.now() - CIRCULAR_FLOW_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: returnLegs } = await supabase
    .from("transaction_ingestion_log")
    .select("amount")
    .eq("sender_name", receiverName)
    .eq("receiver_name", senderName)
    .gte("occurred_at", windowStart);

  if (!returnLegs || returnLegs.length === 0) return { flagged: false, alertId: null, pattern };

  const totalReturned = returnLegs.reduce((sum, r) => sum + Number(r.amount), 0);
  if (totalReturned < CIRCULAR_FLOW_MIN_AMOUNT) return { flagged: false, alertId: null, pattern };

  const entity = await matchEntity(supabase, senderName);
  if (!entity) return { flagged: true, alertId: null, pattern };

  const riskScore = 88;
  const narrative = `Automated detection: funds sent from this entity to ${receiverName} were sent back to this entity within ${CIRCULAR_FLOW_WINDOW_DAYS} days (${returnLegs.length} return transaction(s) totaling $${totalReturned.toLocaleString()}), consistent with circular flow / round-tripping behavior.`;

  return createOrUpdateAutomatedAlert(supabase, {
    entityId: entity.id,
    matchedEntityName: entity.entity_name,
    pattern,
    riskScore,
    volume: totalReturned,
    windowLabel: `${CIRCULAR_FLOW_WINDOW_DAYS}d`,
    narrative,
    currentTxnId,
  });
}
