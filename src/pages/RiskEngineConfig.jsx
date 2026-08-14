import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

const statusStyle = {
  active: "text-secondary border-secondary bg-secondary/10",
  testing: "text-status-warning border-status-warning bg-status-warning/10",
  critical: "text-status-critical border-status-critical bg-status-critical/10",
};

export default function RiskEngineConfig() {
  const [models, setModels] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [logicUpdates, setLogicUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: modelData }, { data: patternData }, { data: logData }] = await Promise.all([
      supabase.from("risk_models").select("*").order("sort_order"),
      supabase.from("market_patterns").select("*").order("sort_order"),
      supabase.from("audit_logs").select("*").eq("target_type", "risk_model").order("created_at", { ascending: false }).limit(5),
    ]);
    setModels(modelData ?? []);
    setPatterns(patternData ?? []);
    setLogicUpdates(logData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totalFlags = models.reduce((sum, m) => sum + (m.flags_30d ?? 0), 0);
  const avgPrecision = models.length ? (models.reduce((s, m) => s + Number(m.precision ?? 0), 0) / models.length).toFixed(1) : "—";
  const avgRecall = models.length ? (models.reduce((s, m) => s + Number(m.recall ?? 0), 0) / models.length).toFixed(1) : "—";

  const handleEmergencyOverride = async (model) => {
    const newStatus = model.status === "critical" ? "active" : "critical";
    const { data, error } = await supabase.from("risk_models").update({ status: newStatus }).eq("id", model.id).select().single();
    if (!error) setModels((prev) => prev.map((m) => (m.id === data.id ? data : m)));
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Risk Engine Configuration</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Manage detection logic, model thresholds, and heuristic rules.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-container-high border border-surface-border rounded p-5">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Total Flags (30D)</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">{loading ? "…" : totalFlags.toLocaleString()}</p>
            </div>
            <div className="bg-surface-container-high border border-surface-border rounded p-5">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Precision (Avg)</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">{loading ? "…" : `${avgPrecision}%`}</p>
            </div>
            <div className="bg-surface-container-high border border-surface-border rounded p-5">
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Recall (Avg)</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">{loading ? "…" : `${avgRecall}%`}</p>
            </div>
            <div className="bg-surface-container-high border border-surface-border rounded p-5 relative">
              <span className="absolute top-2 right-2 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">
                DEMO
              </span>
              <p className="font-label-caps text-label-caps text-status-critical uppercase mb-2">False Positive Rate</p>
              <p className="font-headline-lg text-headline-lg text-status-critical">15.8%</p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-headline-md text-headline-md text-on-surface">Multi-Market Intelligence</h2>
              {models.some((m) => m.is_demo) && (
                <span className="font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">
                  MODEL PERFORMANCE: DEMO DATA
                </span>
              )}
            </div>
            <div className="flex gap-4 mb-6">
              {["Equities Live", "Derivatives Live", "Crypto-Liquidity Live"].map((label) => (
                <span key={label} className="flex items-center gap-1.5 font-label-caps text-label-caps text-secondary">
                  <span className="w-2 h-2 rounded-full bg-secondary" /> {label}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {models.map((m) => (
              <div key={m.id} className="bg-surface-container-low border border-surface-border rounded-lg p-6 relative overflow-hidden">
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${m.status === "critical" ? "bg-status-critical" : m.status === "testing" ? "bg-status-warning" : "bg-secondary"}`} />
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface">{m.name}</h3>
                  <span className={`font-label-caps text-label-caps px-2 py-0.5 rounded border ${statusStyle[m.status]}`}>
                    {m.status.toUpperCase()}
                  </span>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant mb-3">{m.description}</p>
                <div className="bg-primary-container border border-surface-border rounded p-3 mb-4">
                  <p className="font-data-tabular text-data-tabular text-data-focus">
                    <span className="text-on-surface-variant">Core Logic: </span>
                    {m.core_logic}
                  </p>
                </div>
                <div className="flex gap-6 mb-4">
                  <div>
                    <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Precision</p>
                    <p className="font-data-tabular text-data-tabular text-on-surface">{m.precision}%</p>
                  </div>
                  <div>
                    <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Recall</p>
                    <p className="font-data-tabular text-data-tabular text-on-surface">{m.recall}%</p>
                  </div>
                  <div>
                    <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">Flags (30D)</p>
                    <p className="font-data-tabular text-data-tabular text-on-surface">{m.flags_30d?.toLocaleString()}</p>
                  </div>
                </div>
                <div className="border-t border-surface-border pt-4 flex justify-end">
                  {m.status === "critical" ? (
                    <button
                      onClick={() => handleEmergencyOverride(m)}
                      className="bg-status-critical text-white px-4 py-2 rounded font-label-caps text-label-caps"
                    >
                      Emergency Override
                    </button>
                  ) : (
                    <button className="border border-outline text-on-surface px-4 py-2 rounded font-label-caps text-label-caps">
                      Configure
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <h2 className="font-headline-md text-headline-md text-on-surface mb-4">Market Pattern Library</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {patterns.map((p) => (
              <div key={p.id} className="bg-surface-container-low border border-surface-border rounded p-5">
                <p className="font-body-lg text-body-lg text-on-surface mb-2">{p.name}</p>
                <p className="font-body-md text-body-md text-on-surface-variant mb-3">{p.description}</p>
                <p className="font-label-caps text-label-caps text-on-surface-variant">
                  CONFIDENCE: <span className="text-secondary font-bold">{p.confidence}%</span>
                </p>
              </div>
            ))}
          </div>

          <div className="bg-surface-container-low border border-surface-border rounded p-6 mb-10 relative">
            <span className="absolute top-6 right-6 font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">
              ILLUSTRATIVE — NOT YET WIRED TO A REAL BACKTESTING ENGINE
            </span>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-1">AI Simulation &amp; Backtesting</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mb-6">
              Run "What-If" scenarios to evaluate rule changes before deployment.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Predicted FP Reduction</p>
                <p className="font-headline-lg text-headline-lg text-secondary">-22.4%</p>
                <p className="font-data-tabular text-data-tabular text-on-surface-variant">Estimated 2,800 fewer false alerts/mo</p>
              </div>
              <div>
                <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">Detection Yield Shift</p>
                <p className="font-headline-lg text-headline-lg text-data-focus">+4.1%</p>
                <p className="font-data-tabular text-data-tabular text-on-surface-variant">Improved capture of high-velocity flows</p>
              </div>
            </div>
          </div>

          <h2 className="font-headline-md text-headline-md text-on-surface mb-4">Recent Logic Updates</h2>
          <div className="bg-surface-container-high border border-surface-border rounded overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Rule ID</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Description</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Timestamp</th>
                  <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {logicUpdates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-5 font-data-tabular text-data-tabular text-on-surface-variant">
                      No logic updates recorded yet.
                    </td>
                  </tr>
                )}
                {logicUpdates.map((u) => (
                  <tr key={u.id} className="border-t border-surface-border">
                    <td className="px-4 py-3 font-data-tabular text-data-tabular text-data-focus">{u.target_label}</td>
                    <td className="px-4 py-3 font-data-tabular text-data-tabular text-on-surface">{u.details?.note}</td>
                    <td className="px-4 py-3 font-data-tabular text-data-tabular text-on-surface-variant whitespace-nowrap">
                      {new Date(u.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-label-caps text-label-caps px-2 py-0.5 rounded border ${u.status === "flagged" ? "text-status-warning border-status-warning bg-status-warning/10" : "text-secondary border-secondary bg-secondary/10"}`}>
                        {u.status === "flagged" ? "PENDING REVIEW" : "DEPLOYED"}
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
