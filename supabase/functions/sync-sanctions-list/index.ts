// supabase/functions/sync-sanctions-list/index.ts
//
// Pulls the REAL, current OFAC Specially Designated Nationals (SDN) list
// directly from the U.S. Treasury's official Sanctions List Service and
// upserts it into the sanctions_watchlist table. This is genuinely
// functional government data once deployed — nothing here is mocked or
// fabricated.
//
// Deploy with the Supabase CLI from the project root:
//   supabase functions deploy sync-sanctions-list
//
// Then trigger it manually (e.g. via curl or the Supabase dashboard's
// "Invoke" button), or schedule it with Supabase's pg_cron + pg_net (or an
// external scheduler hitting this URL) to keep the list current — OFAC
// updates the SDN list on an as-needed basis, not a fixed schedule.
//
// This function uses the SUPABASE_SERVICE_ROLE_KEY, which Supabase
// automatically provides to Edge Functions as an environment variable —
// it is never exposed to the browser, unlike the anon key the rest of
// this app uses.
//
// Known follow-ups, not built here: the UN Consolidated List and the EU
// Sanctions List each have their own separate official public endpoints
// and would need their own sync functions following this same pattern.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OFAC_SDN_CSV_URL =
  "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV";

// OFAC's server returns 403 to any request with no User-Agent header —
// documented in OFAC's own May 2024 technical notice about the Sanctions
// List Service migration. This is not optional.
const OFAC_FETCH_HEADERS = {
  "User-Agent": "FIN-INTEL-AML-Compliance-Platform/1.0 (contact: compliance@fin-intel-aml.example)",
};

// The basic SDN.CSV has no header row. Column order per OFAC's long-
// published SDN data specification (sdn.ff / sdn.csv format guide):
const SDN_COLUMNS = [
  "ent_num",
  "sdn_name",
  "sdn_type",
  "program",
  "title",
  "call_sign",
  "vess_type",
  "tonnage",
  "grt",
  "vess_flag",
  "vess_owner",
  "remarks",
];

// Minimal CSV line parser that respects quoted fields containing commas —
// OFAC's file quotes every field, but a naive split(",") would break on
// any name or remark that itself contains a comma.
function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function mapEntityType(sdnType, vessType) {
  if (vessType && vessType !== "-0-") return "vessel";
  if (!sdnType) return "entity";
  const t = sdnType.toLowerCase();
  if (t.includes("individual")) return "individual";
  if (t.includes("aircraft")) return "aircraft";
  return "entity";
}

Deno.serve(async (_req) => {
  try {
    const response = await fetch(OFAC_SDN_CSV_URL, { headers: OFAC_FETCH_HEADERS });
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `OFAC fetch failed: HTTP ${response.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    const csvText = await response.text();
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0);

    const rows = lines.map((line) => {
      const fields = parseCsvLine(line);
      const record = {};
      SDN_COLUMNS.forEach((col, i) => {
        record[col] = fields[i] === "-0-" ? null : fields[i] ?? null;
      });
      return record;
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const upsertRows = rows
      .filter((r) => r.ent_num && r.sdn_name)
      .map((r) => ({
        source: "OFAC_SDN",
        external_id: r.ent_num,
        name: r.sdn_name,
        entity_type: mapEntityType(r.sdn_type, r.vess_type),
        programs: r.program,
        remarks: r.remarks,
        list_updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }));

    // Batch to avoid a single oversized request against ~19,000+ SDN rows.
    const BATCH_SIZE = 500;
    let syncedCount = 0;
    const errors = [];
    for (let i = 0; i < upsertRows.length; i += BATCH_SIZE) {
      const batch = upsertRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("sanctions_watchlist")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) {
        errors.push(error.message);
      } else {
        syncedCount += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        source: "OFAC_SDN",
        total_parsed: upsertRows.length,
        synced: syncedCount,
        errors,
        synced_at: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
