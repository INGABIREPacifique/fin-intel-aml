import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function RiskModelDetail() {
  const { modelId } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [model, setModel] = useState(null);
  const [auditEntries, setAuditEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [maxWindow, setMaxWindow] = useState(72);
  const [minNodes, setMinNodes] = useState(3);
  const [retentionRatio, setRetentionRatio] = useState(85);
  const [currencyNorm, setCurrencyNorm] = useState(true);
  const [previewFlags, setPreviewFlags] = useState(null);

  const load = async () => {
    const { data } = await supabase.from("risk_models").select("*").eq("id", modelId).single();
    if (data) {
      setModel(data);
      setMaxWindow(data.max_window_hours ?? 72);
      setMinNodes(data.min_node_count ?? 3);
      setRetentionRatio(data.loop_retention_ratio ?? 85);
      setCurrencyNorm(data.currency_normalization ?? true);
    }
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*, profiles(full_name)")
      .eq("target_type", "risk_model")
      .eq("target_id", modelId)
      .order("created_at", { ascending: false });
    setAuditEntries(logs ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [modelId]);

  // Simplified, disclosed heuristic: stricter node-count / lower window
  // reduces flag volume roughly proportional to the parameter shift.
  // Real backtesting would need historical raw transaction replay.
  const handlePreview = () => {
    const base = model?.flags_30d ?? 0;
    const windowFactor = maxWindow / (model?.max_window_hours ?? 72);
    const nodeFactor = (model?.min_node_count ?? 3) / minNodes;
    setPreviewFlags(Math.round(base * windowFactor * nodeFactor));
  };

  const handleReset = () => {
    if (!model) return;
    setMaxWindow(model.max_window_hours ?? 72);
    setMinNodes(model.min_node_count ?? 3);
    setRetentionRatio(model.loop_retention_ratio ?? 85);
    setCurrencyNorm(model.currency_normalization ?? true);
    setPreviewFlags(null);
  };

  const handleSave = async () => {
    setSaving(true);
    const changes = [];
    if (maxWindow !== model.max_window_hours) changes.push(`Max Window ${model.max_window_hours}h -> ${maxWindow}h`);
    if (minNodes !== model.min_node_count) changes.push(`Min Nodes ${model.min_node_count} -> ${minNodes}`);
    if (retentionRatio !== model.loop_retention_ratio) changes.push(`Retention Ratio ${model.loop_retention_ratio}% -> ${retentionRatio}%`);

    const { data, error } = await supabase
      .from("risk_models")
      .update({
        max_window_hours: maxWindow,
        min_node_count: minNodes,
        loop_retention_ratio: retentionRatio,
        currency_normalization: currencyNorm,
      })
      .eq("id", modelId)
      .select()
      .single();

    if (!error) {
      setModel(data);
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "risk_model_parameters_updated",
        target_type: "risk_model",
        target_id: modelId,
        target_label: data.name,
        details: { note: changes.length ? changes.join("; ") : "Configuration saved (no numeric changes)" },
      });
      setMessage("Configuration saved.");
      load();
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-8">Loading...</div>;
  }
  if (!model) {
    return <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">Model not found.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <button onClick={() => navigate("/risk-engine")} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6 font-body-md text-body-md">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Risk Engine
          </button>

          <div className="flex items-center gap-3 mb-1">
            <span className="font-label-caps text-label-caps text-on-surface-variant border border-surface-border rounded px-2 py-0.5">
              THREAT TYPE: NETWORK FLOW ANALYSIS
            </span>
            <span className="font-label-caps text-label-caps text-status-success border border-status-success rounded px-2 py-0.5">
              {model.status.toUpperCase()}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-8">{model.name} — V4.2</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="bg-surface-container border border-surface-border rounded p-6">
              <h2 className="font-headline-sm text-headline-sm text-secondary mb-4">Model Parameters</h2>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="font-body-md text-body-md text-on-surface-variant">Max Window (Hrs)</label>
                    <span className="font-data-tabular text-data-tabular text-on-surface">{maxWindow}H</span>
                  </div>
                  <input type="range" min={12} max={168} value={maxWindow} onChange={(e) => setMaxWindow(Number(e.target.value))} className="w-full" />
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant mt-1">
                    Maximum duration between initial outflow and final inflow.
                  </p>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="font-body-md text-body-md text-on-surface-variant">Min. Node Count</label>
                    <span className="font-data-tabular text-data-tabular text-on-surface">{minNodes} Nodes</span>
                  </div>
                  <input type="range" min={2} max={10} value={minNodes} onChange={(e) => setMinNodes(Number(e.target.value))} className="w-full" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="font-body-md text-body-md text-on-surface-variant">Loop Retention Ratio (%)</label>
                    <span className="font-data-tabular text-data-tabular text-on-surface">{retentionRatio}%</span>
                  </div>
                  <input type="range" min={50} max={100} value={retentionRatio} onChange={(e) => setRetentionRatio(Number(e.target.value))} className="w-full" />
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant mt-1">
                    Expected % of original funds returning (accounts for transaction fees).
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <label className="font-body-md text-body-md text-on-surface-variant">Currency Normalization</label>
                  <input type="checkbox" checked={currencyNorm} onChange={(e) => setCurrencyNorm(e.target.checked)} />
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-surface-container border border-surface-border rounded p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-headline-sm text-headline-sm text-secondary">Impact Simulation (Simplified Heuristic)</h2>
                <div className="flex gap-2">
                  <button onClick={handleReset} className="border border-outline text-on-surface px-4 py-2 rounded font-label-caps text-label-caps">Reset</button>
                  <button onClick={handlePreview} className="border border-secondary text-secondary px-4 py-2 rounded font-label-caps text-label-caps">Preview</button>
                  <button onClick={handleSave} disabled={saving} className="bg-secondary text-on-secondary px-4 py-2 rounded font-label-caps text-label-caps font-semibold disabled:opacity-60">
                    {saving ? "Saving..." : "Save Configuration"}
                  </button>
                </div>
              </div>
              <div className="flex items-end gap-8 h-[200px] border-b border-surface-border pb-4">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 bg-surface-border rounded-t" style={{ height: "160px" }} />
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant">Current: {model.flags_30d}</p>
                </div>
                {previewFlags !== null && (
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-16 bg-data-focus rounded-t"
                      style={{ height: `${Math.min(200, (previewFlags / model.flags_30d) * 160)}px` }}
                    />
                    <p className="font-data-tabular text-data-tabular text-data-focus">Preview: {previewFlags}</p>
                  </div>
                )}
              </div>
              {message && <p className="font-data-tabular text-data-tabular text-status-success mt-4">{message}</p>}
            </div>
          </div>

          <div className="bg-surface-container border border-surface-border rounded overflow-hidden">
            <div className="bg-surface-container-low border-b border-surface-border px-5 py-4">
              <h2 className="font-headline-sm text-headline-sm text-secondary">Configuration Audit Trail</h2>
            </div>
            <div className="overflow-auto max-h-[300px]">
              {auditEntries.length === 0 && (
                <p className="p-5 font-data-tabular text-data-tabular text-on-surface-variant">No changes recorded yet.</p>
              )}
              {auditEntries.map((e) => (
                <div key={e.id} className="px-5 py-3 border-b border-surface-border">
                  <div className="flex justify-between mb-1">
                    <span className="font-data-tabular text-data-tabular text-secondary">{e.profiles?.full_name ?? "SYSTEM"}</span>
                    <span className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  <p className="font-data-tabular text-data-tabular text-on-surface">{e.details?.note}</p>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
