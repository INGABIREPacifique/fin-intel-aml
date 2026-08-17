import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function InstitutionProfile() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [institution, setInstitution] = useState(null);
  const [agreements, setAgreements] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");

  const load = async () => {
    const { data: inst, error } = await supabase
      .from("institutions")
      .select("*")
      .eq("institution_code", code)
      .single();

    if (error || !inst) {
      setLoading(false);
      return;
    }
    setInstitution(inst);

    const [{ data: agreementData }, { data: auditData }] = await Promise.all([
      supabase.from("institution_legal_agreements").select("*").eq("institution_id", inst.id),
      supabase
        .from("audit_logs")
        .select("*")
        .eq("target_type", "institution")
        .eq("target_id", inst.id)
        .order("created_at", { ascending: false }),
    ]);
    setAgreements(agreementData ?? []);
    setAuditEntries(auditData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [code]);

  const handleScheduleAudit = async () => {
    if (!institution) return;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 90);
    const nextDateStr = nextDate.toISOString().slice(0, 10);

    const { error } = await supabase
      .from("institutions")
      .update({ next_audit_date: nextDateStr })
      .eq("id", institution.id);

    if (error) {
      setActionMessage(`Couldn't schedule audit: ${error.message}`);
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "audit_scheduled",
      target_type: "institution",
      target_id: institution.id,
      target_label: institution.name,
      details: { note: `Next audit scheduled for ${nextDateStr}` },
    });
    setActionMessage(`Next audit scheduled for ${nextDateStr}.`);
    load();
  };

  const handleFullReport = () => {
    const lines = [
      `Institution Report — ${institution.name}`,
      `Institution Code: ${institution.institution_code}`,
      `Jurisdiction: ${institution.jurisdiction_code}`,
      `Status: ${institution.status}`,
      `Last Audit: ${institution.last_audit_date}`,
      `Next Audit: ${institution.next_audit_date ?? "Not scheduled"}`,
      "",
      "-- Metrics --",
      `SAR Filing Accuracy: ${institution.sar_filing_accuracy}%`,
      `CTR Pass Rate: ${institution.ctr_pass_rate}%`,
      `Schema Validations: ${institution.schema_validation_rate}%`,
      "",
      "-- Legal Agreements --",
      ...agreements.map((a) => `${a.title} (${a.reference}) — ${a.status}, expires ${a.expires_on}`),
      "",
      "-- Audit Trail --",
      ...auditEntries.map((e) => `${e.created_at} — ${e.action.replace(/_/g, " ")}: ${e.details?.note ?? ""}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${institution.institution_code}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-8">
        Loading institution...
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">
        Institution not found for {code}.
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
            onClick={() => navigate("/institutions")}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-6 font-body-md text-body-md"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Institutions
          </button>

          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Institution Profile
                </span>
                <span className="w-1 h-1 rounded-full bg-surface-border" />
                <span className="font-label-caps text-label-caps text-on-surface-variant">
                  ID: {institution.institution_code}
                </span>
                {institution.is_demo && (
                  <span className="font-data-tabular text-data-tabular text-[9px] text-on-surface-variant border border-surface-border rounded px-1.5 py-0.5">
                    DEMO
                  </span>
                )}
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">{institution.name}</h1>
              <div className="flex items-center gap-3">
                <span className="bg-surface-container border border-surface-border rounded px-3 py-1 font-body-md text-body-md text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">public</span>
                  {institution.jurisdiction_code}
                </span>
                <span
                  className={`flex items-center gap-1.5 rounded px-3 py-1 font-label-caps text-label-caps border ${
                    institution.status === "active"
                      ? "text-status-success border-status-success bg-status-success/10"
                      : "text-status-critical border-status-critical bg-error-container/20"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-current" />
                  {institution.status === "active" ? "PASSED / ACTIVE" : institution.status.toUpperCase()}
                </span>
                <span className="font-data-tabular text-data-tabular text-on-surface-variant">
                  Last Audit: {institution.last_audit_date}
                </span>
                {institution.next_audit_date && (
                  <span className="font-data-tabular text-data-tabular text-secondary">
                    Next Audit: {institution.next_audit_date}
                  </span>
                )}
              </div>
              {actionMessage && (
                <p className={`font-data-tabular text-data-tabular mt-2 ${actionMessage.startsWith("Couldn't") ? "text-status-critical" : "text-status-success"}`}>
                  {actionMessage}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleScheduleAudit}
                className="border border-surface-border px-4 py-2 rounded text-on-surface font-body-md text-body-md hover:bg-surface-container-high transition-colors"
              >
                Schedule Next Audit
              </button>
              <button
                onClick={handleFullReport}
                className="bg-status-success text-on-primary-fixed px-4 py-2 rounded font-body-md text-body-md font-semibold"
              >
                Full Report
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <div className="lg:col-span-2 bg-surface-container border border-surface-border rounded overflow-hidden">
              <div className="bg-surface-container-low border-b border-surface-border px-5 py-4">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Data Integrity &amp; Audit Metrics
                </h2>
              </div>
              <div className="p-5 grid grid-cols-3 gap-6">
                <div className="border-l-2 border-secondary pl-4">
                  <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                    SAR Filing Accuracy
                  </p>
                  <p className="font-headline-lg text-headline-lg text-on-surface">
                    {institution.sar_filing_accuracy}%
                  </p>
                </div>
                <div className="border-l-2 border-surface-border pl-4">
                  <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                    CTR Pass Rate
                  </p>
                  <p className="font-headline-lg text-headline-lg text-on-surface">
                    {institution.ctr_pass_rate}%
                  </p>
                </div>
                <div className="border-l-2 border-status-warning pl-4">
                  <p className="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1">
                    Schema Validations
                  </p>
                  <p className="font-headline-lg text-headline-lg text-on-surface">
                    {institution.schema_validation_rate}%
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-surface-container border border-surface-border rounded overflow-hidden">
              <div className="bg-surface-container-low border-b border-surface-border px-5 py-4">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">Legal Frameworks</h2>
              </div>
              <div className="divide-y divide-surface-border max-h-[260px] overflow-auto">
                {agreements.length === 0 && (
                  <p className="p-4 font-data-tabular text-data-tabular text-on-surface-variant">
                    No agreements on file.
                  </p>
                )}
                {agreements.map((a) => (
                  <div key={a.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-body-lg text-body-lg text-on-surface font-semibold">{a.title}</p>
                      <span
                        className={`font-label-caps text-label-caps px-2 py-0.5 rounded border ${
                          a.status === "active"
                            ? "text-status-success border-status-success bg-status-success/10"
                            : "text-on-surface-variant border-surface-border bg-surface-container-high"
                        }`}
                      >
                        {a.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between font-body-md text-body-md text-on-surface-variant">
                      <span>Ref: {a.reference}</span>
                      <span>Exp: {a.expires_on}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-surface-container border border-surface-border rounded overflow-hidden">
            <div className="bg-surface-container-low border-b border-surface-border px-5 py-4 flex items-center justify-between">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Administrative Audit Trail</h2>
            </div>
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-container-high border-b border-surface-border">
                    <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-5 py-3">
                      Timestamp (UTC)
                    </th>
                    <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-5 py-3">
                      Action
                    </th>
                    <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-5 py-3">
                      Description
                    </th>
                    <th className="text-left font-label-caps text-label-caps text-on-surface-variant uppercase px-5 py-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-5 font-data-tabular text-data-tabular text-on-surface-variant">
                        No audit entries yet.
                      </td>
                    </tr>
                  )}
                  {auditEntries.map((e) => (
                    <tr key={e.id} className="border-b border-surface-border last:border-0">
                      <td className="px-5 py-3 font-data-tabular text-data-tabular text-on-surface-variant whitespace-nowrap">
                        {new Date(e.created_at).toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-5 py-3">
                        <span className="bg-surface-container-high rounded px-2 py-0.5 font-data-tabular text-data-tabular text-on-surface">
                          {e.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-data-tabular text-data-tabular text-on-surface">
                        {e.details?.note ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 font-data-tabular text-data-tabular text-status-success">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          OK
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
