import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function SarFiling() {
  const { caseCode } = useParams();
  const navigate = useNavigate();
  const { profile, session } = useAuth();
  const canApprove = profile?.role === "compliance_officer" || profile?.role === "admin";

  const [caseRecord, setCaseRecord] = useState(null);
  const [alert, setAlert] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [sar, setSar] = useState(null);
  const [narrative, setNarrative] = useState("");
  const [amendments, setAmendments] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  function buildGeneratedNarrative(caseData, alertData) {
    if (!caseData) return "";
    const entityName = caseData.entities?.entity_name ?? "the subject entity";
    const pattern = alertData?.pattern ?? "an unspecified pattern";
    const fundsIn = alertData?.funds_in;
    const fundsOut = alertData?.funds_out;
    const retained = fundsIn && fundsOut ? Math.max(0, ((fundsIn - fundsOut) / fundsIn) * 100) : null;

    let text = `The reporting institution identifies ${entityName} as exhibiting activity consistent with ${pattern.toLowerCase()}, warranting a Suspicious Activity Report under 31 CFR 1020.320.`;
    if (alertData?.narrative) {
      text += ` ${alertData.narrative}`;
    } else if (fundsIn && fundsOut) {
      text += ` Between the review window, funds totaling $${Number(fundsIn).toLocaleString()} entered the account and $${Number(fundsOut).toLocaleString()} exited, retaining approximately ${retained?.toFixed(1)}% of total volume — consistent with rapid pass-through / layering behavior rather than legitimate commercial activity.`;
    }
    text += ` This filing is based on the evidence detailed alongside this narrative and the risk model output associated with case ${caseData.case_code}.`;
    return text;
  }

  const load = async () => {
    setLoadError("");
    try {
      const { data: caseData, error: caseErr } = await supabase
        .from("cases")
        .select("*, entities(*)")
        .eq("case_code", caseCode)
        .single();

      if (caseErr) {
        setLoadError(caseErr.message);
        setLoading(false);
        return;
      }
      if (!caseData) {
        setLoading(false);
        return;
      }
      setCaseRecord(caseData);

      const [
        { data: alertData, error: alertErr },
        { data: evidenceData, error: evidenceErr },
        { data: sarData, error: sarErr },
      ] = await Promise.all([
        supabase.from("alerts").select("*").eq("case_code", caseCode).maybeSingle(),
        supabase.from("case_evidence").select("*").eq("case_code", caseCode).order("occurred_at", { ascending: false }),
        supabase.from("sar_filings").select("*").eq("case_id", caseData.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const secondaryError = alertErr || evidenceErr || sarErr;
      if (secondaryError) setLoadError(secondaryError.message);

      setAlert(alertData ?? null);
      setEvidence(evidenceData ?? []);

      if (sarData) {
        setSar(sarData);
        setNarrative(sarData.narrative ?? buildGeneratedNarrative(caseData, alertData));
        setAmendments(sarData.reviewer_amendments ?? "");
        setTotalAmount(sarData.total_amount ?? alertData?.volume ?? "");
        setStartDate(sarData.date_range_start ?? "");
        setEndDate(sarData.date_range_end ?? "");
      } else {
        setNarrative(buildGeneratedNarrative(caseData, alertData));
        setTotalAmount(alertData?.volume ?? "");
      }
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [caseCode]);

  const handleSaveDraft = async () => {
    setSaving(true);
    setMessage("");
    const payload = {
      case_id: caseRecord.id,
      entity_id: caseRecord.entity_id,
      narrative,
      reviewer_amendments: amendments || null,
      total_amount: totalAmount || null,
      date_range_start: startDate || null,
      date_range_end: endDate || null,
      status: sar?.status && sar.status !== "draft" ? sar.status : "pending_review",
    };

    let result;
    if (sar) {
      result = await supabase.from("sar_filings").update(payload).eq("id", sar.id).select().single();
    } else {
      result = await supabase.from("sar_filings").insert(payload).select().single();
    }

    setSaving(false);
    if (result.error) {
      setMessage(`Error: ${result.error.message}`);
    } else {
      setSar(result.data);
      setMessage("Draft saved.");
      const { error: logErr } = await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "sar_draft_saved",
        target_type: "sar_filing",
        target_id: result.data.id,
        details: { case_code: caseCode },
      });
      if (logErr) setMessage(`Draft saved, but audit log failed: ${logErr.message}`);
    }
  };

  const handleDecision = async (newStatus) => {
    if (!sar) return;
    if (!canApprove) {
      setMessage("Only a Compliance Officer can approve, return, or hold a SAR.");
      return;
    }
    setSaving(true);
    setMessage("");
    const { data, error } = await supabase
      .from("sar_filings")
      .update({ status: newStatus, reviewed_by: session.user.id, reviewer_amendments: amendments || null })
      .eq("id", sar.id)
      .select()
      .single();

    if (error) {
      setMessage(`Couldn't update SAR status: ${error.message}`);
      setSaving(false);
      return;
    }

    setSar(data);
    const actionLabel = { filed: "sar_approved", rejected: "sar_rejected", on_hold: "sar_held" }[newStatus] ?? "sar_status_changed";
    const { error: logErr } = await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: actionLabel,
      target_type: "sar_filing",
      target_id: sar.id,
      details: { case_code: caseCode, note: amendments || undefined },
    });

    if (newStatus === "filed") {
      const { error: caseErr } = await supabase.from("cases").update({ status: "resolved" }).eq("id", caseRecord.id);
      if (!caseErr) {
        await supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: "case_resolved",
          target_type: "case",
          target_id: caseRecord.id,
          details: { case_code: caseCode, reason: "sar_filed" },
        });
      }
    }

    const messages = {
      filed: "Digitally signed and approved — filed to FinCEN. Case marked resolved.",
      rejected: "Returned to analyst for revision.",
      on_hold: "SAR placed on hold pending further review.",
    };
    setMessage(logErr ? `${messages[newStatus]} (audit log failed: ${logErr.message})` : messages[newStatus]);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-8">
        Loading case...
      </div>
    );
  }

  if (loadError && !caseRecord) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">
        Couldn't load this case: {loadError}
      </div>
    );
  }

  if (!caseRecord) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">
        Case not found for {caseCode}.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
      <button
        onClick={() => navigate(`/cases/${caseCode}`)}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6 font-body-md text-body-md"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to Case
      </button>

      {loadError && (
        <p className="font-data-tabular text-data-tabular text-status-critical mb-4">{loadError}</p>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-label-caps text-label-caps text-data-focus uppercase mb-1">
            FinCEN Form 111 (SAR) — Final Review &amp; Sign-off
          </p>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {caseRecord.entities?.entity_name}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Review generated narrative against financial evidence before submission.
          </p>
        </div>
        {sar && (
          <span
            className={`font-label-caps text-label-caps px-3 py-1 rounded-full border ${
              sar.status === "filed"
                ? "text-status-success border-status-success bg-status-success/10"
                : sar.status === "rejected"
                ? "text-status-critical border-status-critical bg-error-container/20"
                : sar.status === "on_hold"
                ? "text-status-warning border-status-warning bg-status-warning/10"
                : "text-status-warning border-status-warning bg-status-warning/10"
            }`}
          >
            {sar.status.replace("_", " ").toUpperCase()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left column: Generated Narrative */}
        <div className="lg:col-span-7 bg-surface-container border border-surface-border rounded p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-body-lg text-body-lg text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-data-focus text-[18px]">smart_toy</span>
              Generated Narrative
            </h2>
            <span className="font-label-caps text-label-caps px-2.5 py-1 rounded border border-data-focus text-data-focus">
              AI GENERATED
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed bg-primary-container/30 border border-surface-border rounded p-4">
            {narrative || "No narrative generated yet — save evidence to this case to auto-generate one."}
          </p>

          <div className="mt-6">
            <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
              Reviewer Amendments (Optional)
            </label>
            <textarea
              value={amendments}
              onChange={(e) => setAmendments(e.target.value)}
              rows={4}
              className="w-full bg-primary-container border border-surface-border text-on-surface font-body-md text-body-md p-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus rounded-none"
              placeholder="Add specific notes or required revisions here before returning to analyst..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                Total Amount (USD)
              </label>
              <input
                type="number"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular p-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus rounded-none"
              />
            </div>
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                Date From
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular p-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus rounded-none"
              />
            </div>
            <div>
              <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
                Date To
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-primary-container border border-surface-border text-on-surface font-data-tabular text-data-tabular p-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus rounded-none"
              />
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-surface-border">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-6 py-3 rounded font-label-caps text-label-caps border border-outline text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-60"
            >
              {saving ? "SAVING..." : "Save Draft"}
            </button>
          </div>
        </div>

        {/* Right column: Key Evidence Markers + Final Decision */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-surface-container border border-surface-border rounded p-6">
            <h2 className="font-body-lg text-body-lg text-on-surface font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-status-warning text-[18px]">key</span>
              Key Evidence Markers
            </h2>
            {evidence.length === 0 ? (
              <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                No forensic evidence recorded for this case yet.
              </p>
            ) : (
              <div className="space-y-4">
                {evidence.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-status-warning text-[20px] mt-0.5">warning</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-body-md text-body-md text-on-surface font-semibold">{ev.source}</p>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">
                          {new Date(ev.occurred_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-data-tabular text-data-tabular text-on-surface-variant">{ev.record}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-surface-container border border-surface-border rounded p-6">
            <h2 className="font-body-lg text-body-lg text-on-surface font-semibold mb-4">Final Decision</h2>

            {message && (
              <p className="font-data-tabular text-data-tabular text-secondary mb-4">{message}</p>
            )}

            {sar && sar.status !== "filed" && canApprove ? (
              <div className="space-y-3">
                <button
                  onClick={() => handleDecision("filed")}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded font-label-caps text-label-caps bg-status-success text-on-primary-fixed font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">draw</span>
                  Digital Signature &amp; Approve
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDecision("rejected")}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-label-caps text-label-caps border border-status-critical text-status-critical hover:bg-status-critical/10 transition-colors disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    Return
                  </button>
                  <button
                    onClick={() => handleDecision("on_hold")}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded font-label-caps text-label-caps border border-outline text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                    Hold
                  </button>
                </div>
                <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                  Approving digitally signs and files this SAR to FinCEN, and marks the case resolved.
                </p>
              </div>
            ) : sar && sar.status === "filed" ? (
              <p className="font-data-tabular text-data-tabular text-status-success">
                This SAR has been filed and the case is resolved.
              </p>
            ) : sar && !canApprove ? (
              <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                Awaiting Compliance Officer review — you do not have approval permissions.
              </p>
            ) : (
              <p className="font-data-tabular text-data-tabular text-on-surface-variant">
                Save a draft first to enable the final decision actions.
              </p>
            )}
          </div>
        </div>
      </div>
        </main>
      </div>
    </div>
  );
}
