import { useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";

/**
 * Subscribes to Postgres Changes on the given tables and calls `onChange`
 * (typically a page's existing `load` function) whenever any row in any of
 * them is inserted, updated, or deleted — so a page's data reflects live
 * activity from other users without a manual refresh.
 *
 * Deliberately re-runs the page's own already-correct loader rather than
 * hand-merging individual changed rows in every call site: with demo-scale
 * data sizes, a full re-fetch is cheap, and it avoids repeating the same
 * join-reconstruction logic (and its bug surface) across many pages.
 * Rapid bursts of changes are debounced into a single refresh.
 */
export function useRealtimeRefresh(tables, onChange) {
  const timeoutRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const tableKey = Array.isArray(tables) ? tables.join(",") : tables;

  useEffect(() => {
    if (!tableKey) return;
    const tableList = tableKey.split(",");
    const channel = supabase.channel(`live-refresh:${tableKey}:${Math.random().toString(36).slice(2, 8)}`);

    tableList.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          onChangeRef.current();
        }, 300);
      });
    });

    channel.subscribe();

    return () => {
      clearTimeout(timeoutRef.current);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey]);
}
