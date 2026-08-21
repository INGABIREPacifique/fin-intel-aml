import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

function timeAgo(dateStr) {
  if (!dateStr) return "never";
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diffMs)) return "unknown";
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

export default function DataHealth() {
  const { session } = useAuth();
  const [institutions, setInstitutions] = useState([]);
  const [resolutionAudit, setResolutionAudit] = useState([]);
  const [recordCount, setRecordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    const [{ data: instData }, { data: auditData }, { count: entityCount }, { count: alertCount }, { count: caseCount }] =
      await Promise.all([
        supabase.from("institutions").select("*").order("name"),
        supabase.from("entity_resolution_audit").select("*").order("matched_at", { ascending: false }),
        supabase.from("entities").select("*", { count: "exact", head: true }),
        supabase.from("alerts").select("*", { count: "exact", head: true }),
        supabase.from("cases").select("*", { count: "exact", head: true }),
      ]);
    setInstitutions(instData ?? []);
    setResolutionAudit(auditData ?? []);
    setRecordCount((entityCount ?? 0) + (alertCount ?? 0) + (caseCount ?? 0));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    setErrorMessage("");
    const { error: updateErr } = await supabase
      .from("institutions")
      .update({ sync_status: "live", last_sync_at: new Date().toISOString() })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (updateErr) {
      setErrorMessage(`Sync failed: ${updateErr.message}`);
      setSyncing(false);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "data_sync_triggered",
      target_type: "system",
      target_label: "All Integration Feeds",
      details: { note: "Manual sync triggered for all institution feeds" },
    });
    await load();
    setSyncing(false);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Data Health &amp; Ingestion Monitor</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Real-time surveillance of system-wide data integrity, schema normalization, and entity resolution pipelines.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-container-high border border-surface-border rounded p-4">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Total Records (Real)</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">{loading ? "…" : recordCount.toLocaleString()}</p>
              <p className="font-data-tabular text-data-tabular text-on-surface-variant mt-1">entities + alerts + cases</p>
            </div>
            <div className="bg-surface-container-high border border-surface-border rounded p-4 relative">
              <span className="absolute top-2 right-2 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">DEMO</span>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Normalization Rate</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">98.4%</p>
            </div>
            <div className="bg-surface-container-high border border-surface-border rounded p-4 relative">
              <span className="absolute top-2 right-2 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">DEMO</span>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Entity Linkage Score</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">A- <span className="font-data-tabular text-data-tabular text-on-surface-variant">94.1 index</span></p>
            </div>
            <div className="bg-surface-container-high border border-surface-border rounded p-4 relative">
              <span className="absolute top-2 right-2 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">DEMO</span>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">System Latency</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">142<span className="font-data-tabular text-data-tabular text-on-surface-variant"> ms</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 bg-surface-container-high border border-surface-border rounded p-6 relative">
              <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
                <h2 className="font-headline-sm text-headline-sm text-data-focus">Ingestion Pipeline Status</h2>
                <span className="font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">ILLUSTRATIVE</span>
              </div>
              <div className="flex justify-between items-center py-8">
                {["Ingestion", "Normalization", "Resolution", "Enrichment"].map((stage, i) => (
                  <div key={stage} className="flex flex-col items-center gap-2">
                    <div className={`w-16 h-16 rounded-lg border flex items-center justify-center ${i === 1 ? "border-status-warning" : "border-secondary"}`}>
                      <span className={`material-symbols-outlined ${i === 1 ? "text-status-warning" : "text-secondary"}`}>
                        {["input", "sync_alt", "join", "layers"][i]}
                      </span>
                    </div>
                    <p className="font-label-caps text-label-caps text-on-surface">{stage.toUpperCase()}</p>
                    <p className={`font-data-tabular text-data-tabular ${i === 1 ? "text-status-warning" : "text-secondary"}`}>
                      {i === 1 ? "Lag: 2.1s" : "Healthy"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-high border border-surface-border rounded p-6">
              <div className="flex items-center justify-between border-b border-surface-border pb-4 mb-4">
                <h2 className="font-headline-sm text-headline-sm text-data-focus">Active Integration Feeds</h2>
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="font-label-caps text-label-caps text-data-focus flex items-center gap-1 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[14px]">sync</span>
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>
              {errorMessage && (
                <p className="font-data-tabular text-data-tabular text-status-critical mb-3">{errorMessage}</p>
              )}
              <div className="space-y-3">
                {institutions.map((inst) => {
                  const syncStatus = inst.sync_status ?? "unknown";
                  return (
                  <div
                    key={inst.id}
                    className={`bg-surface-container border rounded p-3 flex items-center justify-between ${syncStatus === "lagging" ? "border-status-warning" : "border-surface-border"}`}
                  >
                    <div>
                      <p className="font-body-md text-body-md text-on-surface font-semibold">{inst.name}</p>
                      <p className={`font-data-tabular text-data-tabular ${syncStatus === "lagging" ? "text-status-warning" : "text-on-surface-variant"}`}>
                        Last sync: {timeAgo(inst.last_sync_at)}
                      </p>
                    </div>
                    <span className={`font-data-tabular text-data-tabular px-2 py-0.5 rounded border ${syncStatus === "live" ? "text-status-success border-status-success bg-status-success/10" : "text-status-warning border-status-warning bg-status-warning/10"}`}>
                      {syncStatus.toUpperCase()}
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-high border border-surface-border rounded p-6 relative">
            <span className="absolute top-6 right-6 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">DEMO DATA</span>
            <h2 className="font-headline-sm text-headline-sm text-data-focus mb-1">Entity Resolution Audit</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-4">
              Recent high-confidence linkages across independent schemas.
            </p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Timestamp</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Source A</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Source B</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Match Logic</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-3 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {resolutionAudit.map((r) => (
                  <tr key={r.id} className="border-b border-surface-border">
                    <td className="px-3 py-3 font-data-tabular text-data-tabular text-on-surface-variant whitespace-nowrap">{r.matched_at}</td>
                    <td className="px-3 py-3 font-data-tabular text-data-tabular text-data-focus">{r.source_a}<br /><span className="text-on-surface-variant text-[11px]">{r.source_a_ref}</span></td>
                    <td className="px-3 py-3 font-data-tabular text-data-tabular text-data-focus">{r.source_b}<br /><span className="text-on-surface-variant text-[11px]">{r.source_b_ref}</span></td>
                    <td className="px-3 py-3 font-data-tabular text-data-tabular text-on-surface">{r.match_logic}</td>
                    <td className="px-3 py-3">
                      <span className={`font-data-tabular text-data-tabular px-2 py-0.5 rounded border ${r.confidence >= 95 ? "text-status-success border-status-success bg-status-success/10" : "text-status-warning border-status-warning bg-status-warning/10"}`}>
                        {r.confidence}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
