// supabase/functions/sync-un-sanctions-list/index.ts
//
// Pulls the REAL, current UN Security Council Consolidated Sanctions List
// directly from the UN's official XML feed and upserts it into the same
// sanctions_watchlist table used by sync-sanctions-list (OFAC). This is
// genuinely functional government/international-body data once deployed —
// nothing here is mocked. Unlike the EU list, the UN list requires no
// registration or access token; it's fully public.
//
// Deploy with the Supabase CLI from the project root:
//   supabase functions deploy sync-un-sanctions-list
//
// Trigger manually (Supabase dashboard "Invoke" button, or curl/PowerShell
// with the Authorization header), or schedule alongside sync-sanctions-list
// via the same pg_cron pattern (see migration_030) — the UN list, like
// OFAC's, updates on an as-needed basis rather than a fixed schedule.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UN_CONSOLIDATED_XML_URL = "https://scsanctions.un.org/resources/xml/en/name/consolidated.xml";

// Extracts the text content of the first occurrence of a tag within a
// block of XML. Deliberately simple (not a full DOM parser) since the
// UN's XML has a flat, consistent, well-documented tag structure for the
// fields this needs — a full XML parser dependency isn't warranted here.
function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].trim() : null;
}

function extractNestedValue(block, parentTag) {
  const parentMatch = block.match(new RegExp(`<${parentTag}>([\\s\\S]*?)</${parentTag}>`));
  if (!parentMatch) return null;
  return extractTag(parentMatch[1], "VALUE");
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

function parseIndividualBlock(block) {
  const dataId = extractTag(block, "DATAID");
  const names = ["FIRST_NAME", "SECOND_NAME", "THIRD_NAME", "FOURTH_NAME"]
    .map((tag) => extractTag(block, tag))
    .filter(Boolean)
    .map((n) => n.trim());
  const fullName = decodeEntities(names.join(" ").replace(/\s+/g, " ").trim());
  if (!dataId || !fullName) return null;

  return {
    source: "UN_CONSOLIDATED",
    external_id: dataId,
    name: fullName,
    entity_type: "individual",
    programs: decodeEntities(extractTag(block, "UN_LIST_TYPE") ?? extractTag(block, "REFERENCE_NUMBER")),
    remarks: decodeEntities(extractNestedValue(block, "DESIGNATION") ?? extractTag(block, "COMMENTS1")),
    list_updated_at: extractTag(block, "LISTED_ON") ? new Date(extractTag(block, "LISTED_ON")).toISOString() : null,
    synced_at: new Date().toISOString(),
  };
}

function parseEntityBlock(block) {
  const dataId = extractTag(block, "DATAID");
  // UN entity records use a single FIRST_NAME field for the full entity
  // name (unlike individuals, which split across up to four name fields).
  const name = decodeEntities(extractTag(block, "FIRST_NAME"));
  if (!dataId || !name) return null;

  return {
    source: "UN_CONSOLIDATED",
    external_id: dataId,
    name,
    entity_type: "entity",
    programs: decodeEntities(extractTag(block, "UN_LIST_TYPE") ?? extractTag(block, "REFERENCE_NUMBER")),
    remarks: decodeEntities(extractTag(block, "COMMENTS1")),
    list_updated_at: extractTag(block, "LISTED_ON") ? new Date(extractTag(block, "LISTED_ON")).toISOString() : null,
    synced_at: new Date().toISOString(),
  };
}

Deno.serve(async (_req) => {
  try {
    const response = await fetch(UN_CONSOLIDATED_XML_URL);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `UN feed fetch failed: HTTP ${response.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    const xmlText = await response.text();

    const individualBlocks = xmlText.match(/<INDIVIDUAL>[\s\S]*?<\/INDIVIDUAL>/g) ?? [];
    const entityBlocks = xmlText.match(/<ENTITY>[\s\S]*?<\/ENTITY>/g) ?? [];

    const rows = [
      ...individualBlocks.map((b) => {
        try {
          return parseIndividualBlock(b);
        } catch {
          return null;
        }
      }),
      ...entityBlocks.map((b) => {
        try {
          return parseEntityBlock(b);
        } catch {
          return null;
        }
      }),
    ].filter(Boolean);

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
        source: "UN_CONSOLIDATED",
        individuals_found: individualBlocks.length,
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
