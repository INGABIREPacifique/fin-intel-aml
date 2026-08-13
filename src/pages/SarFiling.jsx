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
  const [sar, setSar] = useState(null);
  const [narrative, setNarrative] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: caseData, error: caseErr } = await supabase
        .from("cases")
        .select("*, entities(*)")
        .eq("case_code", caseCode)
        .single();

      if (caseErr || !caseData) {
        setLoading(false);
        return;
      }
      setCaseRecord(caseData);

      const { data: sarData } = await supabase
        .from("sar_filings")
        .select("*")
        .eq("case_id", caseData.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sarData) {
        setSar(sarData);
        setNarrative(sarData.narrative ?? "");
        setTotalAmount(sarData.total_amount ?? "");
        setStartDate(sarData.date_range_start ?? "");
        setEndDate(sarData.date_range_end ?? "");
      }
      setLoading(false);
    }
    load();
  }, [caseCode]);

  const handleSaveDraft = async () => {
    setSaving(true);
    setMessage("");
    const payload = {
      case_id: caseRecord.id,
      entity_id: caseRecord.entity_id,
      narrative,
      total_amount: totalAmount || null,
      date_range_start: startDate || null,
      date_range_end: endDate || null,
      status: "pending_review",
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
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "sar_draft_saved",
        target_type: "sar_filing",
        target_id: result.data.id,
        details: { case_code: caseCode },
      });
    }
  };

  const handleDecision = async (newStatus) => {
    if (!sar) return;
    if (!canApprove) {
      setMessage("Only a Compliance Officer can approve or reject a SAR.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("sar_filings")
      .update({ status: newStatus, reviewed_by: session.user.id })
      .eq("id", sar.id)
      .select()
      .single();

    if (!error) {
      setSar(data);
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: newStatus === "filed" ? "sar_approved" : "sar_rejected",
        target_type: "sar_filing",
        target_id: sar.id,
        details: { case_code: caseCode },
      });

      if (newStatus === "filed") {
        await supabase.from("cases").update({ status: "resolved" }).eq("id", caseRecord.id);
        await supabase.from("audit_logs").insert({
          actor_id: session.user.id,
          action: "case_resolved",
          target_type: "case",
          target_id: caseRecord.id,
          details: { case_code: caseCode, reason: "sar_filed" },
        });
      }

      setMessage(newStatus === "filed" ? "SAR approved and filed. Case marked resolved." : "SAR rejected — returned for revision.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-8">
        Loading case...
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
        <main className="flex-1 p-8">
      <button
        onClick={() => navigate(`/cases/${caseCode}`)}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6 font-body-md text-body-md"
      >
        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        Back to Case
      </button>

      <div className="max-w-3xl bg-surface-container border border-surface-border rounded p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-label-caps text-label-caps text-secondary uppercase mb-1">
              FinCEN Form 111 (SAR) Draft
            </p>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">
              {caseRecord.entities?.entity_name}
            </h1>
          </div>
          {sar && (
            <span
              className={`font-label-caps text-label-caps px-3 py-1 rounded-full border ${
                sar.status === "filed"
                  ? "text-status-success border-status-success bg-status-success/10"
                  : sar.status === "rejected"
                  ? "text-status-critical border-status-critical bg-error-container/20"
                  : "text-status-warning border-status-warning bg-status-warning/10"
              }`}
            >
              {sar.status.replace("_", " ").toUpperCase()}
            </span>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
              Narrative
            </label>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={6}
              className="w-full bg-primary-container border border-surface-border text-on-surface font-body-md text-body-md p-3 focus:outline-none focus:border-data-focus focus:ring-1 focus:ring-data-focus rounded-none"
              placeholder="Describe the suspicious activity, patterns detected, and rationale..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
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

          {message && (
            <p className="font-data-tabular text-data-tabular text-secondary">{message}</p>
          )}

          <div className="flex gap-4 pt-4 border-t border-surface-border">
            <button
              onClick={handleSaveDraft}
              disabled={saving}
              className="px-6 py-3 rounded font-label-caps text-label-caps border border-outline text-on-surface-variant hover:bg-surface-variant transition-colors disabled:opacity-60"
            >
              {saving ? "SAVING..." : "Save Draft"}
            </button>
            {sar && sar.status === "pending_review" && canApprove && (
              <>
                <button
                  onClick={() => handleDecision("rejected")}
                  disabled={saving}
                  className="px-6 py-3 rounded font-label-caps text-label-caps border border-status-critical text-status-critical hover:bg-status-critical/10 transition-colors disabled:opacity-60"
                >
                  Reject / Return
                </button>
                <button
                  onClick={() => handleDecision("filed")}
                  disabled={saving}
                  className="px-6 py-3 rounded font-label-caps text-label-caps bg-status-success text-on-primary-fixed font-bold hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  Approve &amp; File to FinCEN
                </button>
              </>
            )}
            {sar && sar.status === "pending_review" && !canApprove && (
              <p className="font-data-tabular text-data-tabular text-on-surface-variant self-center">
                Awaiting Compliance Officer review — you do not have approval permissions.
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
