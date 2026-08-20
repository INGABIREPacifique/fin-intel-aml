import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";
import WorkspaceDrawer from "../components/WorkspaceDrawer";

const NODE_COLORS = {
  subject: "#ef4444",
  shell_corp: "#f59e0b",
  financial_institution: "#4edea3",
};

export default function CaseDetail() {
  const { caseCode } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [alert, setAlert] = useState(null);
  const [caseRecord, setCaseRecord] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const load = async () => {
    const [{ data: alertData }, { data: caseData }, { data: nodeData }, { data: edgeData }, { data: evidenceData }] =
      await Promise.all([
        supabase.from("alerts").select("*, entities(*)").eq("case_code", caseCode).single(),
        supabase.from("cases").select("*, profiles(full_name)").eq("case_code", caseCode).maybeSingle(),
        supabase.from("case_network_nodes").select("*").eq("case_code", caseCode),
        supabase.from("case_network_edges").select("*").eq("case_code", caseCode),
        supabase.from("case_evidence").select("*").eq("case_code", caseCode).order("occurred_at", { ascending: false }),
      ]);
    setAlert(alertData ?? null);
    setCaseRecord(caseData ?? null);
    setNodes(nodeData ?? []);
    setEdges(edgeData ?? []);
    setEvidence(evidenceData ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [caseCode]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-8">
        Loading case...
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">
        Case not found for {caseCode}.
      </div>
    );
  }

  const nodeByKey = Object.fromEntries(nodes.map((n) => [n.node_key, n]));
  const sweepRatio =
    alert.funds_in && alert.funds_out ? ((alert.funds_out / alert.funds_in) * 100).toFixed(1) : null;

  const handleAssign = async () => {
    if (!caseRecord) return;
    const { error } = await supabase.from("cases").update({ assigned_to: session.user.id }).eq("id", caseRecord.id);
    if (!error) {
      await supabase.from("audit_logs").insert({
        actor_id: session.user.id,
        action: "case_assigned",
        target_type: "case",
        target_id: caseRecord.id,
        target_label: caseCode,
        details: { note: `Assigned to ${profile?.full_name}` },
      });
      setActionMessage(`Assigned to you (${profile?.full_name}).`);
      load();
    }
  };

  const handleFalsePositive = async () => {
    if (!caseRecord) return;
    await Promise.all([
      supabase.from("alerts").update({ status: "closed" }).eq("case_code", caseCode),
      supabase.from("cases").update({ status: "resolved" }).eq("id", caseRecord.id),
    ]);
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "marked_false_positive",
      target_type: "case",
      target_id: caseRecord.id,
      target_label: caseCode,
      details: { note: "Marked as false positive; alert closed, case resolved." },
    });
    setActionMessage("Marked as false positive. Case resolved.");
    load();
  };

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <div className="flex-1 flex">
          <div className="flex-1 flex flex-col border-r border-surface-border relative">
            <div className="h-16 border-b border-surface-border flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-3">
                <h1 className="font-body-lg text-body-lg font-semibold text-on-surface">
                  Case #{alert.case_code.replace("CASE-", "")}: {alert.entities?.entity_name}
                </h1>
                {alert.status !== "closed" && (
                  <span className="border border-status-critical bg-status-critical/10 text-status-critical font-label-caps text-label-caps px-2 py-1 rounded">
                    SAR PENDING
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-background/90 backdrop-blur border border-surface-border rounded p-3 z-10">
                <p className="font-label-caps text-label-caps text-on-surface mb-2">Node Legend</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.subject }} />
                    <span className="font-data-tabular text-data-tabular text-on-surface-variant">Subject Entity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.shell_corp }} />
                    <span className="font-data-tabular text-data-tabular text-on-surface-variant">Shell Corp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: NODE_COLORS.financial_institution }} />
                    <span className="font-data-tabular text-data-tabular text-on-surface-variant">Financial Inst.</span>
                  </div>
                </div>
              </div>

              {nodes.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant text-center max-w-xs">
                    No network graph data yet for this case. Run migration_007_case_forensics.sql to seed it,
                    or this case doesn't have mapped relationships.
                  </p>
                </div>
              ) : (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  {edges.map((e, i) => {
                    const from = nodeByKey[e.from_key];
                    const to = nodeByKey[e.to_key];
                    if (!from || !to) return null;
                    return (
                      <line
                        key={i}
                        x1={from.pos_x}
                        y1={from.pos_y}
                        x2={to.pos_x}
                        y2={to.pos_y}
                        stroke="var(--color-surface-border)"
                        strokeWidth="0.3"
                      />
                    );
                  })}
                </svg>
              )}

              {nodes.map((n) => (
                <div
                  key={n.id}
                  className="absolute flex flex-col items-center gap-1 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${n.pos_x}%`, top: `${n.pos_y}%` }}
                >
                  <div
                    className="rounded-full"
                    style={{
                      width: n.node_type === "subject" ? 32 : 20,
                      height: n.node_type === "subject" ? 32 : 20,
                      backgroundColor: NODE_COLORS[n.node_type] ?? "#909097",
                    }}
                  />
                  <span className="font-data-tabular text-data-tabular text-on-surface bg-background/80 px-1 rounded whitespace-nowrap">
                    {n.label}
                  </span>
                  {n.amount_label && (
                    <span className="font-data-tabular text-data-tabular text-on-surface-variant">
                      {n.amount_label}
                    </span>
                  )}
                </div>
              ))}

              {edges.find((e) => e.label) && (
                <div className="absolute top-[35%] left-1/2 -translate-x-1/2 bg-background border border-surface-border rounded px-2 py-1">
                  <span className="font-data-tabular text-data-tabular text-status-critical">
                    {edges.find((e) => e.label).label}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="w-[416px] flex flex-col shrink-0 overflow-y-auto">
            <div className="border-b border-surface-border px-6 py-6 flex items-start justify-between">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
                  {alert.entities?.entity_name}
                </h2>
                <div className="flex gap-4 font-data-tabular text-data-tabular text-on-surface-variant">
                  <span>ID: {alert.entities?.tin_ein ?? "—"}</span>
                  <span>Jurisdiction: {alert.entities?.jurisdiction}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">RISK SCORE</p>
                <div className="border border-status-critical bg-status-critical/10 rounded px-3 py-1.5 flex items-baseline gap-1">
                  <span className="font-body-lg text-body-lg font-semibold text-status-critical">
                    {alert.risk_score}
                  </span>
                  <span className="font-data-tabular text-data-tabular text-status-critical/70">/100</span>
                </div>
              </div>
            </div>

            <div className="border-b border-surface-border px-6 py-6 space-y-4">
              <p className="font-label-caps text-label-caps text-on-surface-variant">WHY WAS THIS FLAGGED?</p>
              <div className="bg-surface-container border border-surface-border rounded p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-body-lg text-body-lg text-on-surface">{alert.pattern}</h3>
                  <span className="bg-status-critical/20 border border-status-critical/30 text-status-critical font-data-tabular text-data-tabular px-2 py-0.5 rounded">
                    CRITICAL ANOMALY
                  </span>
                </div>
                {alert.narrative && (
                  <p className="font-body-md text-body-md text-on-surface font-medium">{alert.narrative}</p>
                )}
                {alert.funds_in && (
                  <div className="flex gap-6 pt-2">
                    <div className="border-l-2 border-secondary pl-3">
                      <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">FUNDS IN (48h)</p>
                      <p className="font-body-lg text-body-lg text-on-surface">
                        ${Number(alert.funds_in).toLocaleString()}
                      </p>
                    </div>
                    <div className="border-l-2 border-status-critical pl-3">
                      <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">FUNDS OUT (48h)</p>
                      <p className="font-body-lg text-body-lg text-on-surface">
                        ${Number(alert.funds_out).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                {sweepRatio && (
                  <div className="flex justify-between border-t border-surface-border pt-3">
                    <span className="font-body-md text-body-md text-on-surface">Sweep Ratio:</span>
                    <span className="font-data-tabular text-data-tabular font-bold text-status-critical">
                      {sweepRatio}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-6 flex-1">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-3">SOURCE EVIDENCE</p>
              <div className="border border-surface-border rounded overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant px-3 py-2">DATE</th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant px-3 py-2">SOURCE</th>
                      <th className="text-left font-label-caps text-label-caps text-on-surface-variant px-3 py-2">RECORD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evidence.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 font-data-tabular text-data-tabular text-on-surface-variant">
                          No evidence records yet.
                        </td>
                      </tr>
                    )}
                    {evidence.map((e) => (
                      <tr key={e.id} className="border-t border-surface-border">
                        <td className="px-3 py-3 font-data-tabular text-data-tabular text-on-surface-variant whitespace-nowrap">
                          {new Date(e.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="px-3 py-3 font-data-tabular text-data-tabular text-data-focus">{e.source}</td>
                        <td className="px-3 py-3 font-data-tabular text-data-tabular text-on-surface">{e.record}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border-t border-surface-border p-4 sticky bottom-0 bg-background">
              {caseRecord?.assigned_to && (
                <p className="font-data-tabular text-data-tabular text-data-focus mb-2">
                  Assigned to: {caseRecord.profiles?.full_name ?? "—"}
                </p>
              )}
              {actionMessage && (
                <p className="font-data-tabular text-data-tabular text-status-success mb-2">{actionMessage}</p>
              )}
              <div className="grid grid-cols-[1fr_1fr_1fr_1.5fr] gap-2">
                <button
                  onClick={handleAssign}
                  className="border border-surface-border bg-surface-container rounded font-label-caps text-label-caps text-on-surface py-3 hover:bg-surface-container-high transition-colors"
                >
                  ASSIGN
                </button>
                <button
                  onClick={handleFalsePositive}
                  className="border border-surface-border bg-surface-container rounded font-label-caps text-label-caps text-on-surface py-3 hover:bg-surface-container-high transition-colors"
                >
                  FALSE POSITIVE
                </button>
                <button
                  onClick={() => setWorkspaceOpen(true)}
                  className="border border-secondary text-secondary rounded font-label-caps text-label-caps py-3 hover:bg-secondary/10 transition-colors"
                >
                  WORKSPACE
                </button>
                <button
                  onClick={() => navigate(`/cases/${alert.case_code}/sar`)}
                  className="bg-status-critical rounded font-label-caps text-label-caps text-white py-3"
                >
                  FLAG FOR SAR
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {workspaceOpen && (
        <WorkspaceDrawer caseCode={alert.case_code} onClose={() => setWorkspaceOpen(false)} />
      )}
    </div>
  );
}
