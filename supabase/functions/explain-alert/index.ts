// supabase/functions/explain-alert/index.ts
//
// Generates a "why was this flagged" explanation for an alert, written for
// an analyst to actually read and act on. Two real modes, always labeled
// honestly to the caller so the UI never claims one is the other:
//
//   1. Real LLM mode — if an ANTHROPIC_API_KEY secret is configured on this
//      Supabase project, calls the real Anthropic API and returns a
//      genuinely AI-generated explanation grounded only in the real data
//      pulled for this alert (never invented facts).
//   2. Rule-based fallback — if no key is configured (the default in this
//      environment, since no key was available to set one up), builds a
//      real, deterministic explanation from the same real data — the same
//      honesty pattern already used elsewhere in this app (SAR narrative
//      generator, Case Workspace Smart Draft): genuinely useful, clearly
//      labeled, never dressed up as something it isn't.
//
// Deploy with the Supabase CLI from the project root (JWT verification
// stays on by default — this is called by authenticated staff sessions,
// unlike the institution-facing ingest-transaction function):
//   supabase functions deploy explain-alert
//
// To enable real mode later, set the secret and redeploy — no code change
// needed:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildRuleBasedExplanation({ alert, entity, relationships, evidence }) {
  const parts = [];
  parts.push(
    `${entity?.entity_name ?? "This entity"} was flagged for "${alert.pattern}" with a risk score of ${alert.risk_score}/100.`
  );

  if (alert.funds_in != null && alert.funds_out != null) {
    const sweepRatio = alert.funds_in > 0 ? ((alert.funds_out / alert.funds_in) * 100).toFixed(1) : "0";
    parts.push(
      `Within the ${alert.window_label ?? "monitored"} window, $${Number(alert.funds_in).toLocaleString()} entered the account and $${Number(alert.funds_out).toLocaleString()} left it — a ${sweepRatio}% sweep, meaning funds moved through rather than being retained, which is the core signature of pass-through / layering behavior rather than ordinary account activity.`
    );
  } else if (alert.volume) {
    parts.push(`Total transaction volume associated with this alert is $${Number(alert.volume).toLocaleString()}.`);
  }

  if (relationships && relationships.length > 0) {
    const uniqueCounterparties = new Set(
      relationships.map((r) => (r.from_entity_id === entity?.id ? r.to_entity_id : r.from_entity_id))
    );
    parts.push(
      `This entity has ${relationships.length} recorded transaction relationship(s) with ${uniqueCounterparties.size} distinct counterpart${uniqueCounterparties.size === 1 ? "y" : "ies"}, which the network graph view visualizes directly.`
    );
  }

  if (evidence && evidence.length > 0) {
    parts.push(
      `${evidence.length} piece(s) of supporting evidence have been logged on this case, available in the Case Detail workspace.`
    );
  }

  parts.push(
    "This explanation is generated from the platform's own real recorded data using a fixed set of rules — it is not an AI-generated assessment, and does not replace an analyst's own review of the underlying evidence."
  );

  return parts.join(" ");
}

async function buildAnthropicExplanation(apiKey, { alert, entity, relationships, evidence }) {
  const context = {
    entity_name: entity?.entity_name,
    jurisdiction: entity?.jurisdiction,
    pattern: alert.pattern,
    risk_score: alert.risk_score,
    funds_in: alert.funds_in,
    funds_out: alert.funds_out,
    window_label: alert.window_label,
    volume: alert.volume,
    relationship_count: relationships?.length ?? 0,
    evidence_count: evidence?.length ?? 0,
    evidence_summaries: (evidence ?? []).slice(0, 5).map((e) => ({ source: e.source, record: e.record })),
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system:
        "You are an AML compliance analyst assistant. Explain, in plain language for a human compliance analyst, why a flagged transaction pattern is suspicious. Use ONLY the facts given to you in the data below — never invent entity names, amounts, dates, or relationships that aren't present. Be concrete and specific. Keep it to 3-5 sentences.",
      messages: [
        { role: "user", content: `Explain this flagged alert using only this real data:\n\n${JSON.stringify(context, null, 2)}` },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API returned HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Only POST is supported." }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const { alert_id } = body;
  if (!alert_id) {
    return jsonResponse({ error: "alert_id is required." }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data: alert, error: alertErr } = await supabase
    .from("alerts")
    .select("*, entities(*)")
    .eq("id", alert_id)
    .maybeSingle();
  if (alertErr) return jsonResponse({ error: alertErr.message }, 500);
  if (!alert) return jsonResponse({ error: "Alert not found." }, 404);

  const entity = alert.entities;
  const [{ data: relationships }, { data: evidence }] = await Promise.all([
    entity
      ? supabase
          .from("entity_relationships")
          .select("*")
          .or(`from_entity_id.eq.${entity.id},to_entity_id.eq.${entity.id}`)
      : Promise.resolve({ data: [] }),
    supabase.from("case_evidence").select("*").eq("case_code", alert.case_code),
  ]);

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  let explanation;
  let source;

  if (anthropicKey) {
    try {
      explanation = await buildAnthropicExplanation(anthropicKey, { alert, entity, relationships, evidence });
      source = "anthropic";
    } catch (err) {
      // A real LLM call failure falls back to the rule-based explanation
      // rather than returning an error — the analyst still gets something
      // real and useful, just clearly labeled as the fallback.
      explanation = buildRuleBasedExplanation({ alert, entity, relationships, evidence });
      source = "rule_based";
    }
  } else {
    explanation = buildRuleBasedExplanation({ alert, entity, relationships, evidence });
    source = "rule_based";
  }

  const { error: updateErr } = await supabase
    .from("alerts")
    .update({
      ai_explanation: explanation,
      ai_explanation_source: source,
      ai_explanation_generated_at: new Date().toISOString(),
    })
    .eq("id", alert_id);
  if (updateErr) return jsonResponse({ error: updateErr.message }, 500);

  return jsonResponse({ success: true, explanation, source });
});
