import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import Sidebar from "../components/Sidebar";
import TopNavBar from "../components/TopNavBar";

export default function CaseWorkspace() {
  const { caseCode } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();

  const [caseRecord, setCaseRecord] = useState(null);
  const [taskForce, setTaskForce] = useState([]);
  const [evidenceLog, setEvidenceLog] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const { data: caseData } = await supabase.from("cases").select("*, entities(entity_name)").eq("case_code", caseCode).maybeSingle();
    if (!caseData) {
      setLoading(false);
      return;
    }
    setCaseRecord(caseData);

    const [{ data: tf }, { data: log }, { data: ms }, { data: ai }] = await Promise.all([
      supabase.from("case_task_force").select("*, profiles(full_name)").eq("case_id", caseData.id),
      supabase.from("case_evidence_log").select("*, profiles(full_name)").eq("case_id", caseData.id).order("created_at", { ascending: true }),
      supabase.from("case_milestones").select("*").eq("case_id", caseData.id).order("sort_order"),
      supabase.from("case_action_items").select("*, profiles(full_name)").eq("case_id", caseData.id).order("created_at"),
    ]);
    setTaskForce(tf ?? []);
    setEvidenceLog(log ?? []);
    setMilestones(ms ?? []);
    setActionItems(ai ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [caseCode]);

  const handleJoin = async () => {
    if (!caseRecord) return;
    await supabase.from("case_task_force").insert({
      case_id: caseRecord.id,
      member_id: session.user.id,
      agency_label: profile.department,
      role_label: profile.role.replace("_", " "),
    });
    load();
  };

  const handlePostNote = async () => {
    if (!noteText.trim() || !caseRecord) return;
    setPosting(true);
    await supabase.from("case_evidence_log").insert({
      case_id: caseRecord.id,
      author_id: session.user.id,
      body: noteText,
    });
    setNoteText("");
    setPosting(false);
    load();
  };

  const toggleActionItem = async (item) => {
    await supabase.from("case_action_items").update({ done: !item.done }).eq("id", item.id);
    load();
  };

  if (loading) {
    return <div className="min-h-screen bg-background text-on-surface-variant font-data-tabular text-data-tabular p-8">Loading workspace...</div>;
  }
  if (!caseRecord) {
    return <div className="min-h-screen bg-background text-status-critical font-data-tabular text-data-tabular p-8">Case not found.</div>;
  }

  const isMember = taskForce.some((t) => t.member_id === session.user.id);

  return (
    <div className="min-h-screen bg-background text-on-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopNavBar />
        <main className="flex-1 p-8">
          <button onClick={() => navigate(`/cases/${caseCode}`)} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-4 font-body-md text-body-md">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Case
          </button>

          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-label-caps text-label-caps text-status-critical border border-status-critical rounded px-2 py-0.5">
                  {caseRecord.risk_level.toUpperCase()} RISK
                </span>
                <span className="font-label-caps text-label-caps text-status-success border border-status-success rounded px-2 py-0.5">
                  {caseRecord.status.toUpperCase()}
                </span>
                <span className="font-data-tabular text-data-tabular text-on-surface-variant">{caseRecord.case_code}</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface">{caseRecord.title}</h1>
            </div>
            {!isMember && (
              <button onClick={handleJoin} className="bg-status-success text-on-primary-fixed px-4 py-2 rounded font-label-caps text-label-caps font-semibold">
                Join Task Force
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container border border-surface-border rounded p-5">
              <h2 className="font-headline-sm text-headline-sm text-secondary mb-4">Joint Task Force</h2>
              <div className="space-y-3">
                {taskForce.length === 0 && (
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant">No members yet — be the first to join.</p>
                )}
                {taskForce.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-container-high border border-surface-border flex items-center justify-center font-label-caps text-label-caps text-secondary">
                      {t.profiles?.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="font-body-md text-body-md text-on-surface">{t.profiles?.full_name}</p>
                      <p className="font-data-tabular text-data-tabular text-on-surface-variant">{t.agency_label} · {t.role_label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 bg-surface-container border border-surface-border rounded p-5">
              <h2 className="font-headline-sm text-headline-sm text-secondary mb-4">Evidence &amp; Comm Log</h2>
              <div className="space-y-4 max-h-[400px] overflow-auto mb-4">
                {evidenceLog.length === 0 && (
                  <p className="font-data-tabular text-data-tabular text-on-surface-variant">No entries yet.</p>
                )}
                {evidenceLog.map((n) => (
                  <div key={n.id} className="bg-background border border-surface-border rounded p-3">
                    <div className="flex justify-between mb-1">
                      <span className="font-body-md text-body-md text-on-surface font-semibold">{n.profiles?.full_name}</span>
                      <span className="font-data-tabular text-data-tabular text-on-surface-variant">
                        {new Date(n.created_at).toISOString().slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="font-body-md text-body-md text-on-surface">{n.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add evidence note..."
                  className="flex-1 bg-primary-container border border-surface-border text-on-surface px-3 py-2 rounded text-sm focus:outline-none focus:border-data-focus"
                />
                <button
                  onClick={handlePostNote}
                  disabled={posting}
                  className="bg-secondary text-on-secondary px-4 py-2 rounded font-label-caps text-label-caps font-semibold disabled:opacity-60"
                >
                  Post Note
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-surface-container border border-surface-border rounded p-5">
                <h2 className="font-headline-sm text-headline-sm text-secondary mb-4">Key Milestones</h2>
                <div className="space-y-3">
                  {milestones.map((m) => (
                    <div key={m.id} className="flex gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${m.status === "done" ? "bg-status-success" : "bg-surface-border"}`} />
                      <div>
                        <p className="font-data-tabular text-data-tabular text-on-surface-variant">{m.occurred_on ?? "PENDING"}</p>
                        <p className="font-body-md text-body-md text-on-surface">{m.title}</p>
                        <p className="font-data-tabular text-data-tabular text-on-surface-variant">{m.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-container border border-surface-border rounded p-5">
                <h2 className="font-headline-sm text-headline-sm text-secondary mb-4">Action Items</h2>
                <div className="space-y-3">
                  {actionItems.map((a) => (
                    <label key={a.id} className="flex items-start gap-2">
                      <input type="checkbox" checked={a.done} onChange={() => toggleActionItem(a)} className="mt-1" />
                      <div>
                        <p className={`font-body-md text-body-md ${a.done ? "text-on-surface-variant line-through" : "text-on-surface"}`}>{a.title}</p>
                        <p className="font-data-tabular text-data-tabular text-status-warning">{a.due_label}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
