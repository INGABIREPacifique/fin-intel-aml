import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function Dashboard() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [{ data: alertData, error: alertErr }, { count: resolvedCountResult }] = await Promise.all([
        supabase.from("alerts").select("*, entities(entity_name)").order("risk_score", { ascending: false }),
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("status", "resolved"),
      ]);
      if (!alertErr) setAlerts(alertData);
      setResolvedCount(resolvedCountResult ?? 0);
      setLoading(false);
    }
    loadData();
  }, []);

  const highRiskCount = alerts.filter((a) => a.risk_score >= 90).length;
  const activeCount = alerts.filter((a) => a.status !== "closed").length;

  const bands = [
    { label: "CRIT", min: 90, max: 100, color: "#ef4444" },
    { label: "HIGH", min: 70, max: 89, color: "#f59e0b" },
    { label: "MED", min: 50, max: 69, color: "#4edea3" },
    { label: "LOW", min: 0, max: 49, color: "#334155" },
  ];
  const bandCounts = bands.map((b) => ({
    ...b,
    count: alerts.filter((a) => a.risk_score >= b.min && a.risk_score <= b.max).length,
  }));
  const maxBandCount = Math.max(1, ...bandCounts.map((b) => b.count));

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Institutional Vault</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">
          Executive Overview &amp; Risk Anomaly Detection
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-surface-container border border-surface-border p-4 rounded">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Total Alerts Processed
              </p>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">database</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading ? "…" : alerts.length}
            </p>
          </div>
          <div className="bg-surface-container border border-surface-border p-4 rounded">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Active Investigations
              </p>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">person_search</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading ? "…" : activeCount}
            </p>
          </div>
          <div className="bg-surface-container border border-status-critical/30 p-4 rounded shadow-[0_0_15px_0_rgba(239,68,68,0.1)]">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-status-critical uppercase">
                High-Risk Flags
              </p>
              <span className="material-symbols-outlined text-status-critical text-[18px]">warning</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-status-critical">
              {loading ? "…" : highRiskCount}
            </p>
          </div>
          <div className="bg-surface-container border border-surface-border p-4 rounded">
            <div className="flex items-start justify-between mb-3">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Resolved Cases
              </p>
              <span className="material-symbols-outlined text-status-success text-[18px]">task_alt</span>
            </div>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading ? "…" : resolvedCount}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-surface-container border border-surface-border rounded p-5 md:col-span-1">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-1">Risk Distribution</h3>
            <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-6">
              Distribution of flags by severity
            </p>
            <div className="flex items-end justify-center gap-4 h-[140px] border-b border-surface-border pb-2">
              {bandCounts.map((b) => (
                <div key={b.label} className="flex flex-col items-center gap-2">
                  <div
                    className="w-10 rounded-t"
                    style={{
                      height: `${Math.max(4, (b.count / maxBandCount) * 120)}px`,
                      backgroundColor: b.color,
                      opacity: 0.8,
                    }}
                    title={`${b.count} alerts`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {bandCounts.map((b) => (
                <span key={b.label} className="w-10 text-center font-data-tabular text-data-tabular text-on-surface-variant text-[10px]">
                  {b.label}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-surface-container border border-surface-border rounded p-5 md:col-span-2 flex flex-col items-center justify-center">
            <p className="font-data-tabular text-data-tabular text-on-surface-variant text-center">
              Laundering Pattern Detection (Structuring / Circular Flow / Rapid Pass-Through trend lines) —
              not yet built. Needs historical time-series data, which isn't tracked yet.
            </p>
          </div>
        </div>

        <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Alert Queue</h3>
        <div className="bg-surface-container border border-surface-border rounded divide-y divide-surface-border">
          {loading && (
            <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
              Loading live data...
            </p>
          )}
          {!loading && alerts.length === 0 && (
            <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
              No alerts found. Run the seed data in docs/schema.sql if this is unexpected.
            </p>
          )}
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="p-5 flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer"
              onClick={() => navigate(`/cases/${alert.case_code}`)}
            >
              <div>
                <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-1">
                  {alert.case_code}
                </p>
                <p className="font-body-lg text-body-lg text-on-surface font-semibold">
                  {alert.entities?.entity_name ?? "Unknown entity"}
                </p>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  {alert.pattern} · ${Number(alert.volume).toLocaleString()} ({alert.window_label})
                </p>
              </div>
              <span
                className={`font-label-caps text-label-caps px-3 py-1 rounded-full border ${
                  alert.risk_score >= 90
                    ? "text-status-critical border-status-critical bg-error-container/20"
                    : "text-status-warning border-status-warning bg-status-warning/10"
                }`}
              >
                {alert.risk_score} RISK
              </span>
            </div>
          ))}
        </div>
      </main>
      </div>
    </div>
  );
}
