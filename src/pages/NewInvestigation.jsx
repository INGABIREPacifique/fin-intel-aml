import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function NewInvestigation() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState("company");
  const [jurisdiction, setJurisdiction] = useState("");
  const [pattern, setPattern] = useState("");
  const [riskScore, setRiskScore] = useState(75);
  const [volume, setVolume] = useState("");
  const [windowLabel, setWindowLabel] = useState("30d");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const caseCode = `CASE-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    const { data: entity, error: entityErr } = await supabase
      .from("entities")
      .insert({ entity_name: entityName, entity_type: entityType, jurisdiction })
      .select()
      .single();

    if (entityErr) {
      setError(entityErr.message);
      setSaving(false);
      return;
    }

    const { error: alertErr } = await supabase.from("alerts").insert({
      entity_id: entity.id,
      case_code: caseCode,
      pattern,
      risk_score: riskScore,
      volume: volume || null,
      window_label: windowLabel,
      status: "open",
    });

    if (alertErr) {
      setError(alertErr.message);
      setSaving(false);
      return;
    }

    const riskLevel = riskScore >= 90 ? "critical" : riskScore >= 70 ? "high" : riskScore >= 50 ? "medium" : "low";

    const { error: caseErr } = await supabase.from("cases").insert({
      case_code: caseCode,
      title: `${entityName} — ${pattern} Investigation`,
      entity_id: entity.id,
      status: "active",
      risk_level: riskLevel,
      assigned_to: session.user.id,
    });

    if (caseErr) {
      setError(caseErr.message);
      setSaving(false);
      return;
    }

    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "investigation_created",
      target_type: "case",
      target_label: caseCode,
      details: { note: `New investigation opened for ${entityName}` },
    });

    navigate(`/cases/${caseCode}`);
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">New Investigation</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            Open a new case against a subject entity.
          </p>

          <form onSubmit={handleSubmit} className="max-w-2xl bg-surface-container border border-surface-border rounded p-8 space-y-6">
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                Entity Name
              </label>
              <input
                required
                value={entityName}
                onChange={(e) => setEntityName(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-body-md text-body-md px-4 py-3 focus:outline-none focus:border-data-focus rounded"
                placeholder="e.g. Sterling Holdings LLC"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                  Entity Type
                </label>
                <select
                  value={entityType}
                  onChange={(e) => setEntityType(e.target.value)}
                  className="w-full bg-primary-container border border-surface-border text-on-surface font-body-md text-body-md px-4 py-3 focus:outline-none focus:border-data-focus rounded"
                >
                  <option value="company">Company</option>
                  <option value="individual">Individual</option>
                </select>
              </div>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                  Jurisdiction
                </label>
                <input
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="w-full bg-primary-container border border-surface-border text-on-surface font-body-md text-body-md px-4 py-3 focus:outline-none focus:border-data-focus rounded"
                  placeholder="e.g. Cayman Islands"
                />
              </div>
            </div>

            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                Pattern Detected
              </label>
              <input
                required
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-body-md text-body-md px-4 py-3 focus:outline-none focus:border-data-focus rounded"
                placeholder="e.g. Structuring, Circular Flow, Rapid Pass-Through"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                  Risk Score: {riskScore}
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={riskScore}
                  onChange={(e) => setRiskScore(Number(e.target.value))}
                  className="w-full mt-3"
                />
              </div>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                  Volume (USD)
                </label>
                <input
                  type="number"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular px-4 py-3 focus:outline-none focus:border-data-focus rounded"
                />
              </div>
              <div>
                <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                  Window
                </label>
                <input
                  value={windowLabel}
                  onChange={(e) => setWindowLabel(e.target.value)}
                  className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular px-4 py-3 focus:outline-none focus:border-data-focus rounded"
                  placeholder="30d"
                />
              </div>
            </div>

            {error && (
              <div className="bg-error-container border border-status-critical p-3 text-sm text-on-error-container font-body-md">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="border border-surface-border text-on-surface px-5 py-3 rounded font-label-caps text-label-caps"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-secondary text-on-secondary px-5 py-3 rounded font-label-caps text-label-caps font-semibold disabled:opacity-60"
              >
                {saving ? "Creating..." : "Open Investigation"}
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
