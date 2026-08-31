import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useRealtimeRefresh } from "../lib/useRealtimeRefresh";
import { useAuth } from "../lib/AuthContext";

export default function MobileAlertDetail() {
  const { caseCode } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [alert, setAlert] = useState(null);
  const [relatedEntities, setRelatedEntities] = useState([]);
  const [flowExpanded, setFlowExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoadError("");
    try {
      const { data, error } = await supabase.from("alerts").select("*, entities(*)").eq("case_code", caseCode).single();
      if (error) {
        setLoadError(error.message);
        setAlert(null);
        return;
      }
      setAlert(data ?? null);
      if (!data?.entity_id) return;

      const { data: relData, error: relErr } = await supabase
        .from("entity_relationships")
        .select("*, from_entity:from_entity_id(id, entity_name), to_entity:to_entity_id(id, entity_name)")
        .or(`from_entity_id.eq.${data.entity_id},to_entity_id.eq.${data.entity_id}`);

      if (relErr) {
        setLoadError(relErr.message);
        return;
      }

      const neighborIds = Array.from(
        new Set(
          (relData ?? []).map((r) => (r.from_entity_id === data.entity_id ? r.to_entity_id : r.from_entity_id))
        )
      );
      if (neighborIds.length === 0) return;

      const { data: neighborAlerts, error: alertsErr } = await supabase
        .from("alerts")
        .select("*, entities(entity_name)")
        .in("entity_id", neighborIds);

      if (alertsErr) {
        setLoadError(alertsErr.message);
      } else {
        setRelatedEntities(neighborAlerts ?? []);
      }
    } catch (err) {
      setLoadError(err.message);
      setAlert(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [caseCode]);

  useRealtimeRefresh(["alerts", "entity_relationships"], load);

  const handleAction = async (actionType) => {
    setMessage("");
    try {
      const newStatus = actionType === "flag" ? "investigating" : alert.status;
      if (actionType === "flag") {
        const { error: updateErr } = await supabase.from("alerts").update({ status: newStatus }).eq("case_code", caseCode);
        if (updateErr) {
          setMessage(`Couldn't flag: ${updateErr.message}`);
          return;
        }
      }
      const { error: logErr } = await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: actionType === "flag" ? "alert_flagged_mobile" : "alert_info_requested_mobile",
        target_type: "case",
        target_label: caseCode,
        details: { note: actionType === "flag" ? "Flagged for review from Mobile Field Hub" : "Additional info requested from Mobile Field Hub" },
      });
      if (logErr) {
        setMessage(`${actionType === "flag" ? "Flagged" : "Request sent"}, but audit log failed: ${logErr.message}`);
      } else {
        setMessage(actionType === "flag" ? "Flagged for review — status set to investigating." : "Info request logged for the assigned analyst.");
      }
      if (actionType === "flag") load();
    } catch (err) {
      setMessage(`Couldn't complete action: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-6 max-w-[430px] mx-auto">
        Loading...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-6 max-w-[430px] mx-auto">
        Couldn't load this alert: {loadError}
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
        <h1 className="font-headline-sm text-headline-sm text-data-focus truncate">{alert.case_code}</h1>
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
              {alert.risk_score >= 90 ? "CRITICAL RISK" : "ELEVATED RISK"}
            </span>
            <span className="font-data-tabular text-data-tabular text-on-surface-variant uppercase">{alert.status}</span>
          </div>
          <p className="font-headline-md text-headline-md text-on-surface mb-1">{alert.entities?.entity_name}</p>
          <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-3">ID: {alert.entity_id?.slice(0, 8).toUpperCase()}</p>
          <div className="flex items-center gap-6">
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Risk Score</p>
              <p className="font-headline-lg text-headline-lg text-status-critical">{alert.risk_score}/100</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant uppercase">Total Exposure</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">
                ${Number(alert.funds_in ?? alert.volume ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container border border-surface-border rounded p-4">
          <p className="font-label-caps text-label-caps text-status-warning uppercase mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">warning</span>
            Detected Pattern
          </p>
          <p className="font-body-md text-body-md text-on-surface font-semibold mb-3">{alert.pattern}</p>
          <div className="grid grid-cols-3 gap-2 font-data-tabular text-data-tabular">
            <div>
              <p className="text-on-surface-variant text-[11px] uppercase">Trigger</p>
              <p className="text-on-surface">{alert.pattern}</p>
            </div>
            <div>
              <p className="text-on-surface-variant text-[11px] uppercase">Confidence</p>
              <p className="text-on-surface">{alert.risk_score}%</p>
            </div>
            <div>
              <p className="text-on-surface-variant text-[11px] uppercase">Timeframe</p>
              <p className="text-on-surface">{alert.window_label ?? "—"}</p>
            </div>
          </div>
        </div>

        {(alert.funds_in || alert.funds_out || alert.narrative) && (
          <div className="bg-surface-container border border-surface-border rounded p-4">
            <button
              onClick={() => setFlowExpanded((v) => !v)}
              className="w-full flex items-center justify-between"
            >
              <p className="font-label-caps text-label-caps text-on-surface uppercase">Flow Analysis</p>
              <span className="material-symbols-outlined text-on-surface-variant text-[18px]">
                {flowExpanded ? "expand_less" : "expand_more"}
              </span>
            </button>
            {flowExpanded && (
              <div className="mt-3 space-y-3">
                {alert.funds_in && alert.funds_out && (
                  <div className="flex items-center justify-between font-data-tabular text-data-tabular">
                    <div className="text-center">
                      <span className="material-symbols-outlined text-status-warning">arrow_downward</span>
                      <p className="text-on-surface">${Number(alert.funds_in).toLocaleString()}</p>
                      <p className="text-on-surface-variant text-[10px] uppercase">Funds In</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant">trending_flat</span>
                    <div className="text-center">
                      <span className="material-symbols-outlined text-status-critical">arrow_upward</span>
                      <p className="text-on-surface">${Number(alert.funds_out).toLocaleString()}</p>
                      <p className="text-on-surface-variant text-[10px] uppercase">Funds Out</p>
                    </div>
                  </div>
                )}
                {alert.narrative && (
                  <p className="font-body-md text-body-md text-on-surface-variant">{alert.narrative}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="bg-surface-container border border-surface-border rounded p-4">
          <p className="font-label-caps text-label-caps text-on-surface uppercase mb-3">
            Related Flagged Entities {relatedEntities.length > 0 && `(${relatedEntities.length})`}
          </p>
          {relatedEntities.length === 0 ? (
            <p className="font-data-tabular text-data-tabular text-on-surface-variant">No related flagged entities found.</p>
          ) : (
            <div className="space-y-2">
              {relatedEntities.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/mobile/alerts/${r.case_code}`)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-on-surface-variant text-[18px]">apartment</span>
                    <span className="font-data-tabular text-data-tabular text-on-surface">{r.entities?.entity_name}</span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {message && (
          <p className="font-data-tabular text-data-tabular text-status-success">{message}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleAction("request_info")}
            className="flex-1 border border-surface-border text-on-surface py-3 rounded font-label-caps text-label-caps flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">description</span>
            Request Info
          </button>
          <button
            onClick={() => handleAction("flag")}
            className="flex-1 bg-status-critical text-on-primary-fixed py-3 rounded font-label-caps text-label-caps font-semibold flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">flag</span>
            Flag &amp; Review
          </button>
        </div>
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
