import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function AlertQueue() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState(searchParams.get("risk") ?? "all");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const filtered = alerts.filter((a) => {
    const riskOk =
      riskFilter === "all" ||
      (riskFilter === "crit" && a.risk_score >= 90) ||
      (riskFilter === "high" && a.risk_score >= 70 && a.risk_score < 90) ||
      (riskFilter === "med" && a.risk_score >= 50 && a.risk_score < 70) ||
      (riskFilter === "low" && a.risk_score < 50);
    const statusOk = statusFilter === "all" || a.status === statusFilter;
    return riskOk && statusOk;
  });

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Alert Queue</h1>
      </div>
      <p className="font-body-md text-body-md text-on-surface-variant mb-8">
        AI-driven triage ranking anomalies by risk score and laundering pattern.
      </p>

      <div className="flex gap-4 mb-6">
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="bg-surface-container border border-surface-border text-on-surface font-label-caps text-label-caps px-4 py-2 rounded focus:outline-none focus:border-data-focus"
        >
          <option value="all">All Risk Levels</option>
          <option value="crit">Critical (90+)</option>
          <option value="high">High (70-89)</option>
          <option value="med">Medium (50-69)</option>
          <option value="low">Low (&lt;50)</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-container border border-surface-border text-on-surface font-label-caps text-label-caps px-4 py-2 rounded focus:outline-none focus:border-data-focus"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <div className="bg-surface-container border border-surface-border rounded divide-y divide-surface-border">
        {loading && (
          <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
            Loading alerts...
          </p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="p-6 font-data-tabular text-data-tabular text-on-surface-variant">
            No alerts match these filters.
          </p>
        )}
        {filtered.map((alert) => (
          <div
            key={alert.id}
            className="p-5 flex items-center justify-between hover:bg-surface-container-high transition-colors cursor-pointer"
            onClick={() => navigate(`/cases/${alert.case_code}`)}
          >
            <div>
              <p className="font-data-tabular text-data-tabular text-data-focus mb-1">
                {alert.case_code} · <span className="uppercase">{alert.status}</span>
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
                  : alert.risk_score >= 70
                  ? "text-status-warning border-status-warning bg-status-warning/10"
                  : "text-status-success border-status-success bg-status-success/10"
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
