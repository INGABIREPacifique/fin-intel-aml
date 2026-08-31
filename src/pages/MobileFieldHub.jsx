import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeRefresh } from "../lib/useRealtimeRefresh";

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function MobileFieldHub() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    try {
      const [{ data: alertData, error: alertErr }, { data: instData, error: instErr }] = await Promise.all([
        supabase.from("alerts").select("*, entities(entity_name)").order("created_at", { ascending: false }),
        supabase.from("institutions").select("*"),
      ]);
      const firstError = alertErr || instErr;
      if (firstError) {
        setErrorMessage(`Couldn't load field hub data: ${firstError.message}`);
      } else {
        setAlerts(alertData ?? []);
        setInstitutions(instData ?? []);
      }
    } catch (err) {
      setErrorMessage(`Couldn't load field hub data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useRealtimeRefresh(["alerts", "institutions"], load);

  const activeCases = alerts.filter((a) => a.status !== "closed").length;
  const highRisk = alerts.filter((a) => a.risk_score >= 90).length;

  const severity = (score) => (score >= 90 ? "critical" : score >= 70 ? "warning" : "info");
  const severityStyle = {
    critical: "text-status-critical border-status-critical bg-status-critical/10",
    warning: "text-status-warning border-status-warning bg-status-warning/10",
    info: "text-primary border-primary bg-primary/10",
  };

  return (
    <div className="min-h-screen bg-background text-on-surface max-w-[430px] mx-auto relative pb-24 pt-16">
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-background border-b border-surface-border h-16 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-data-focus text-[20px]">shield_locked</span>
          <h1 className="font-headline-sm text-headline-sm font-bold text-on-surface">Investigation Hub</h1>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">search</span>
      </header>

      <main className="px-4 space-y-6">
        {errorMessage && (
          <p className="font-data-tabular text-data-tabular text-status-critical">{errorMessage}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface-container border border-surface-border rounded p-4">
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Active Cases</p>
            <p className="font-headline-lg text-headline-lg text-on-surface">{loading ? "…" : activeCases}</p>
          </div>
          <div className="bg-surface-container border-l-4 border-status-critical border border-surface-border rounded p-4">
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">High Risk Nodes</p>
            <p className="font-headline-lg text-headline-lg text-status-critical">{loading ? "…" : highRisk}</p>
          </div>
          <div className="bg-surface-container border border-surface-border rounded p-4 relative">
            <span className="absolute top-2 right-2 font-data-tabular text-data-tabular text-[8px] text-on-surface-variant border border-surface-border rounded px-1">DEMO</span>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Pending Verifs</p>
            <p className="font-headline-lg text-headline-lg text-on-surface">45</p>
          </div>
          <div className="bg-surface-container border border-surface-border rounded p-4 relative">
            <span className="absolute top-2 right-2 font-data-tabular text-data-tabular text-[8px] text-on-surface-variant border border-surface-border rounded px-1">DEMO</span>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">System Uptime</p>
            <p className="font-headline-lg text-headline-lg text-status-success">99.9%</p>
          </div>
        </div>

        <div>
          <h2 className="font-headline-sm text-headline-sm text-data-focus mb-3 border-b border-surface-border pb-2">Priority Notifications</h2>
          <div className="space-y-3">
            {alerts.slice(0, 6).map((a) => {
              const sev = severity(a.risk_score);
              return (
                <button
                  key={a.id}
                  onClick={() => navigate(`/mobile/alerts/${a.case_code}`)}
                  className="w-full text-left bg-surface-container border border-surface-border rounded p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-label-caps text-label-caps px-2 py-0.5 rounded border ${severityStyle[sev]}`}>
                      {sev.toUpperCase()}
                    </span>
                    <span className="font-data-tabular text-data-tabular text-on-surface-variant">{timeAgo(a.created_at)}</span>
                  </div>
                  <p className="font-body-lg text-body-lg text-on-surface font-semibold mb-1">
                    {a.pattern} — {a.entities?.entity_name}
                  </p>
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant">{a.case_code}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="font-headline-sm text-headline-sm text-data-focus mb-3 border-b border-surface-border pb-2">Active Nodes</h2>
          <div className="space-y-2">
            {institutions.map((inst) => (
              <div
                key={inst.id}
                className={`bg-surface-container border-l-2 rounded p-3 flex items-center justify-between ${
                  inst.sync_status === "live" ? "border-secondary" : "border-status-warning"
                }`}
              >
                <div>
                  <p className="font-data-tabular text-data-tabular text-on-surface">{inst.name}</p>
                  <p className={`font-body-md text-body-md ${inst.sync_status === "live" ? "text-on-surface-variant" : "text-status-warning"}`}>
                    {inst.sync_status === "live" ? "Stable" : "Degraded"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-surface-container border-t border-surface-border h-20 flex items-center justify-around px-4 z-20">
        <div className="bg-secondary text-on-secondary rounded-xl px-4 py-1 flex flex-col items-center">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span className="font-label-caps text-label-caps">Alerts</span>
        </div>
        <div className="flex flex-col items-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">folder</span>
          <span className="font-label-caps text-label-caps">Case Files</span>
        </div>
        <div className="flex flex-col items-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="font-label-caps text-label-caps">Notices</span>
        </div>
        <div className="flex flex-col items-center text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px]">person</span>
          <span className="font-label-caps text-label-caps">Account</span>
        </div>
      </nav>
    </div>
  );
}
