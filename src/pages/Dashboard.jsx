import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function Dashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAlerts() {
      const { data, error } = await supabase
        .from("alerts")
        .select("*, entities(entity_name)")
        .order("risk_score", { ascending: false });
      if (!error) setAlerts(data);
      setLoading(false);
    }
    loadAlerts();
  }, []);

  const highRiskCount = alerts.filter((a) => a.risk_score >= 90).length;

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <aside className="w-[240px] bg-surface-container-low border-r border-surface-border p-6 flex flex-col justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md font-bold text-on-surface mb-1">
            AML <span className="text-secondary">Division</span>
          </h1>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-8">
            Institutional Vault
          </p>
          <nav className="space-y-1">
            <div className="flex items-center gap-3 px-3 py-2 bg-surface-container-high text-secondary rounded">
              <span className="material-symbols-outlined text-[20px]">grid_view</span>
              <span className="font-body-md text-body-md">Overview</span>
            </div>
            <div className="flex items-center gap-3 px-3 py-2 text-on-surface-variant rounded">
              <span className="material-symbols-outlined text-[20px]">list_alt</span>
              <span className="font-body-md text-body-md">Alert Queue</span>
            </div>
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-on-surface-variant hover:text-status-critical transition-colors rounded"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="font-body-md text-body-md">Logout</span>
        </button>
      </aside>

      <main className="flex-1 p-8">
        <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Institutional Vault</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mb-8">
          Executive Overview &amp; Risk Anomaly Detection
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-surface-container border border-surface-border p-6 rounded">
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
              Total Alerts
            </p>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading ? "…" : alerts.length}
            </p>
          </div>
          <div className="bg-surface-container border border-status-critical p-6 rounded">
            <p className="font-label-caps text-label-caps text-status-critical uppercase mb-2">
              High-Risk Flags
            </p>
            <p className="font-headline-lg text-headline-lg text-status-critical">
              {loading ? "…" : highRiskCount}
            </p>
          </div>
          <div className="bg-surface-container border border-surface-border p-6 rounded">
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
              Open Cases
            </p>
            <p className="font-headline-lg text-headline-lg text-on-surface">
              {loading ? "…" : alerts.filter((a) => a.status === "open").length}
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
  );
}
