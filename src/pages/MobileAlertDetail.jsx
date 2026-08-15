import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function MobileAlertDetail() {
  const { caseCode } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data } = await supabase.from("alerts").select("*, entities(*)").eq("case_code", caseCode).single();
    setAlert(data ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [caseCode]);

  const handleAcknowledge = async () => {
    await supabase.from("alerts").update({ status: "investigating" }).eq("case_code", caseCode);
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "alert_acknowledged_mobile",
      target_type: "case",
      target_label: caseCode,
      details: { note: "Acknowledged from Mobile Field Hub" },
    });
    setMessage("Acknowledged — status set to investigating.");
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-6 max-w-[430px] mx-auto">
        Loading...
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-6 max-w-[430px] mx-auto">
        Alert not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface max-w-[430px] mx-auto pb-24">
      <header className="bg-background border-b border-surface-border h-16 flex items-center gap-3 px-4 sticky top-0 z-10">
        <button onClick={() => navigate("/mobile")}>
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h1 className="font-headline-sm text-headline-sm text-on-surface truncate">{alert.case_code}</h1>
      </header>

      <main className="p-4 space-y-4">
        <div className="bg-surface-container border border-surface-border rounded p-4">
          <div className="flex items-center justify-between mb-2">
            <span
              className={`font-label-caps text-label-caps px-2 py-0.5 rounded border ${
                alert.risk_score >= 90
                  ? "text-status-critical border-status-critical bg-status-critical/10"
                  : "text-status-warning border-status-warning bg-status-warning/10"
              }`}
            >
              {alert.risk_score} RISK
            </span>
            <span className="font-data-tabular text-data-tabular text-on-surface-variant uppercase">{alert.status}</span>
          </div>
          <p className="font-headline-md text-headline-md text-on-surface mb-1">{alert.entities?.entity_name}</p>
          <p className="font-body-md text-body-md text-on-surface-variant">{alert.pattern}</p>
        </div>

        <div className="bg-surface-container border border-surface-border rounded p-4 space-y-3">
          <div className="flex justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Jurisdiction</span>
            <span className="font-data-tabular text-data-tabular text-on-surface">{alert.entities?.jurisdiction ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">Volume</span>
            <span className="font-data-tabular text-data-tabular text-on-surface">
              ${Number(alert.volume ?? 0).toLocaleString()} ({alert.window_label})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">TIN / EIN</span>
            <span className="font-data-tabular text-data-tabular text-on-surface">{alert.entities?.tin_ein ?? "—"}</span>
          </div>
        </div>

        {message && (
          <p className="font-data-tabular text-data-tabular text-status-success">{message}</p>
        )}

        <button
          onClick={handleAcknowledge}
          className="w-full bg-secondary text-on-secondary py-3 rounded font-label-caps text-label-caps font-semibold"
        >
          Acknowledge on Site
        </button>
        <button
          onClick={() => navigate(`/cases/${caseCode}`)}
          className="w-full border border-surface-border text-on-surface py-3 rounded font-label-caps text-label-caps"
        >
          Open Full Case (Desktop View)
        </button>
      </main>
    </div>
  );
}
