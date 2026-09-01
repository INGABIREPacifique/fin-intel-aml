// supabase/functions/sync-eu-sanctions-list/index.ts
//
// Pulls the EU Consolidated Financial Sanctions List. Unlike OFAC and the
// UN list, the European Commission requires a free personal registration
// to get an access token — this cannot be obtained on your behalf, no
// public no-auth endpoint exists. This function is otherwise fully real
// and complete; it needs exactly one thing from you to go live.
//
// SETUP REQUIRED (one-time, free, ~5 minutes):
//   1. Go to https://webgate.ec.europa.eu/europeaid/fsd/fsf#!/account
//   2. Create a free account
//   3. Go to https://webgate.ec.europa.eu/europeaid/fsd/fsf#!/files
//   4. Open "show settings for crawler/robot" and copy the URL for
//      "1.0 XML (Based on XSD)" — it looks like:
//      https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=YOUR_TOKEN
//   5. Set that full token value (just the token= part) as a Supabase secret:
//      supabase secrets set EU_SANCTIONS_TOKEN=your_token_here
//   6. Deploy: supabase functions deploy sync-eu-sanctions-list
//
// Until step 5-6 are done, this function returns a clear error explaining
// exactly what's missing rather than failing silently or faking data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// EU sanctioned-entity XML records use nameAlias blocks with wholeName —
// this extracts the primary (first) name alias per entity record.
function parseEntityBlock(block) {
  const euReferenceNumber = extractTag(block, "logicalId") ?? extractTag(block, "euReferenceNumber");
  const nameAliasBlock = block.match(/<nameAlias[^>]*>([\s\S]*?)<\/nameAlias>/);
  const wholeName = nameAliasBlock ? extractTag(nameAliasBlock[1], "wholeName") : null;
  if (!euReferenceNumber || !wholeName) return null;

  const subjectType = extractTag(block, "subjectType");

  return {
    source: "EU_CONSOLIDATED",
    external_id: euReferenceNumber,
    name: decodeEntities(wholeName),
    entity_type: subjectType?.toLowerCase().includes("person") ? "individual" : "entity",
    programs: decodeEntities(extractTag(block, "regulationSummary") ?? extractTag(block, "programme")),
    remarks: decodeEntities(extractTag(block, "remark")),
    list_updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (_req) => {
  const token = Deno.env.get("EU_SANCTIONS_TOKEN");
  if (!token) {
    return new Response(
      JSON.stringify({
        error:
          "EU_SANCTIONS_TOKEN is not configured. This requires a free personal registration at " +
          "https://webgate.ec.europa.eu/europeaid/fsd/fsf#!/account — see the setup instructions " +
          "in this function's source comments for the exact steps. Once you have a token, run: " +
          "supabase secrets set EU_SANCTIONS_TOKEN=your_token_here",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const url = `https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content?token=${token}`;
    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `EU feed fetch failed: HTTP ${response.status}. Check that your token is still valid.` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    const xmlText = await response.text();

    const entityBlocks = xmlText.match(/<sanctionEntity[\s\S]*?<\/sanctionEntity>/g) ?? [];
    const rows = entityBlocks
      .map((b) => {
        try {
          return parseEntityBlock(b);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    const BATCH_SIZE = 500;
    let syncedCount = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
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
        source: "EU_CONSOLIDATED",
        entities_found: entityBlocks.length,
        total_parsed: rows.length,
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
