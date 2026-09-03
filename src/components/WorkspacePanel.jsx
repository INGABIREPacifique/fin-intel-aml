import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import VideoCallRoom from "./VideoCallRoom";

function renderBody(text, taskForce) {
  if (!text) return null;
  const names = taskForce.map((t) => t.profiles?.full_name).filter(Boolean);
  const parts = text.split(/(@[A-Za-z]+(?:\s[A-Za-z]+)?)/g);
  return parts.map((part, i) => {
    const isMention = part.startsWith("@") && names.some((n) => `@${n}` === part);
    return isMention ? (
      <span key={i} className="text-data-focus font-semibold">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

export default function WorkspacePanel({ caseCode, onClose }) {
  const { session, profile } = useAuth();

  const [caseRecord, setCaseRecord] = useState(null);
  const [taskForce, setTaskForce] = useState([]);
  const [evidenceLog, setEvidenceLog] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [noteText, setNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const fileInputRef = useRef(null);
  const chunksRef = useRef([]);

  const load = async () => {
    setLoadError("");
    const { data: caseData, error: caseErr } = await supabase
      .from("cases")
      .select("*, entities(entity_name)")
      .eq("case_code", caseCode)
      .maybeSingle();
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
      { data: tf, error: tfErr },
      { data: log, error: logErr },
      { data: ms, error: msErr },
      { data: ai, error: aiErr },
    ] = await Promise.all([
      supabase.from("case_task_force").select("*, profiles(full_name)").eq("case_id", caseData.id),
      supabase.from("case_evidence_log").select("*, profiles(full_name)").eq("case_id", caseData.id).order("created_at", { ascending: true }),
      supabase.from("case_milestones").select("*").eq("case_id", caseData.id).order("sort_order"),
      supabase.from("case_action_items").select("*, profiles(full_name)").eq("case_id", caseData.id).order("created_at"),
    ]);
    const secondaryError = tfErr || logErr || msErr || aiErr;
    if (secondaryError) {
      setLoadError(secondaryError.message);
    } else {
      setTaskForce(tf ?? []);
      setEvidenceLog(log ?? []);
      setMilestones(ms ?? []);
      setActionItems(ai ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [caseCode]);

  // Live updates for the case activity log (text notes, file uploads, voice
  // notes) — previously this only refreshed for the person who posted,
  // since load() was called manually after posting but no one else's
  // browser knew to re-fetch. Requires the case_evidence_log table to be
  // added to the supabase_realtime publication (migration_025).
  useEffect(() => {
    if (!caseRecord?.id) return;
    const channel = supabase
      .channel(`case-log:${caseRecord.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "case_evidence_log", filter: `case_id=eq.${caseRecord.id}` },
        async (payload) => {
          const { data: fullRow } = await supabase
            .from("case_evidence_log")
            .select("*, profiles(full_name)")
            .eq("id", payload.new.id)
            .maybeSingle();
          setEvidenceLog((prev) =>
            prev.some((e) => e.id === payload.new.id) ? prev : [...prev, fullRow ?? payload.new]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseRecord?.id]);

  const [joinError, setJoinError] = useState("");

  const handleJoin = async () => {
    if (!caseRecord) return;
    setJoinError("");
    const { error } = await supabase.from("case_task_force").insert({
      case_id: caseRecord.id,
      member_id: session.user.id,
      agency_label: profile.department,
      role_label: profile.role.replace("_", " "),
    });
    if (error) {
      setJoinError(`Couldn't join task force: ${error.message}`);
      return;
    }
    load();
  };

  const [postError, setPostError] = useState("");

  const postMessage = async ({ body, attachment_url, attachment_label, message_type }) => {
    setPostError("");
    const { error } = await supabase.from("case_evidence_log").insert({
      case_id: caseRecord.id,
      author_id: session.user.id,
      body: body ?? "",
      attachment_url: attachment_url ?? null,
      attachment_label: attachment_label ?? null,
      message_type: message_type ?? "text",
    });
    if (error) {
      setPostError(`Couldn't post: ${error.message}`);
      return false;
    }
    // No manual reload here — the postgres_changes subscription above picks
    // up this insert for every viewer, including this browser, so calling
    // load() too would risk a duplicate render of the same message.
    return true;
  };

  const handlePostNote = async () => {
    if (!noteText.trim() || !caseRecord) return;
    setPosting(true);
    const success = await postMessage({ body: noteText, message_type: "text" });
    if (success) setNoteText("");
    setPosting(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !caseRecord) return;
    setUploading(true);
    setPostError("");
    const path = `${caseRecord.id}/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("case-evidence").upload(path, file);
    if (uploadErr) {
      setPostError(`Couldn't upload file: ${uploadErr.message}`);
    } else {
      const { data: pub } = supabase.storage.from("case-evidence").getPublicUrl(path);
      await postMessage({ attachment_url: pub.publicUrl, attachment_label: file.name, message_type: "file" });
    }
    setUploading(false);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const path = `${caseRecord.id}/${Date.now()}-voice-note.webm`;
        setUploading(true);
        setPostError("");
        const { error: uploadErr } = await supabase.storage.from("case-evidence").upload(path, blob);
        if (uploadErr) {
          setPostError(`Couldn't upload voice note: ${uploadErr.message}`);
        } else {
          const { data: pub } = supabase.storage.from("case-evidence").getPublicUrl(path);
          await postMessage({ attachment_url: pub.publicUrl, attachment_label: "Voice Note", message_type: "voice" });
        }
        setUploading(false);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  const stopRecording = () => {
    mediaRecorder?.stop();
    setRecording(false);
  };

  const [inCall, setInCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null); // { from, fromName }
  const [callStatusMessage, setCallStatusMessage] = useState("");
  const ringChannelRef = useRef(null);

  useEffect(() => {
    const myId = session.user.id;
    const channel = supabase.channel(`case-ring:${caseCode}`);
    ringChannelRef.current = channel;

    channel
      .on("broadcast", { event: "ring" }, ({ payload }) => {
        if (payload.from === myId) return;
        setIncomingCall({ from: payload.from, fromName: payload.fromName });
      })
      .on("broadcast", { event: "declined" }, ({ payload }) => {
        if (payload.to !== myId) return;
        setCallStatusMessage(`${payload.fromName} declined the call.`);
      })
      .on("broadcast", { event: "call-ended" }, ({ payload }) => {
        if (payload.from === myId) return;
        setIncomingCall((prev) => (prev?.from === payload.from ? null : prev));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [caseCode, session.user.id]);

  const handleStartVideoCall = () => {
    setCallStatusMessage("");
    ringChannelRef.current?.send({
      type: "broadcast",
      event: "ring",
      payload: { from: session.user.id, fromName: profile?.full_name ?? "Unknown" },
    });
    setInCall(true);
  };

  const handleAcceptCall = () => {
    setIncomingCall(null);
    setCallStatusMessage("");
    setInCall(true);
  };

  const handleDeclineCall = () => {
    if (incomingCall) {
      ringChannelRef.current?.send({
        type: "broadcast",
        event: "declined",
        payload: { from: session.user.id, fromName: profile?.full_name ?? "Unknown", to: incomingCall.from },
      });
    }
    setIncomingCall(null);
  };

  const handleDismissCall = () => {
    setIncomingCall(null);
  };

  const handleCloseCall = () => {
    ringChannelRef.current?.send({
      type: "broadcast",
      event: "call-ended",
      payload: { from: session.user.id },
    });
    setInCall(false);
  };

  const [actionItemError, setActionItemError] = useState("");

  const toggleActionItem = async (item) => {
    setActionItemError("");
    const { error } = await supabase.from("case_action_items").update({ done: !item.done }).eq("id", item.id);
    if (error) {
      setActionItemError(`Couldn't update action item: ${error.message}`);
      return;
    }
    load();
  };

  const handleNoteChange = (e) => {
    const val = e.target.value;
    setNoteText(val);
    setMentionOpen(val.endsWith("@"));
  };

  const buildSmartDraft = () => {
    if (!caseRecord) return "";
    const doneItems = actionItems.filter((a) => a.done).length;
    const totalItems = actionItems.length;
    const openItems = actionItems.filter((a) => !a.done);
    const latestMilestone = [...milestones].reverse().find((m) => m.status === "done") ?? milestones[milestones.length - 1];
    const nextMilestone = milestones.find((m) => m.status !== "done");

    const parts = [`Status update on ${caseRecord.case_code} (${caseRecord.risk_level.toUpperCase()} risk):`];
    if (latestMilestone) {
      parts.push(`Most recent milestone: "${latestMilestone.title}"${latestMilestone.occurred_on ? ` (${latestMilestone.occurred_on})` : ""}.`);
    }
    if (nextMilestone) {
      parts.push(`Next up: "${nextMilestone.title}".`);
    }
    if (totalItems > 0) {
      parts.push(`Action items: ${doneItems}/${totalItems} complete.`);
      if (openItems.length > 0) {
        parts.push(`Outstanding: ${openItems.map((i) => i.title).join(", ")}.`);
      }
    }
    parts.push(`Task force: ${taskForce.length} member${taskForce.length === 1 ? "" : "s"} active.`);
    return parts.join(" ");
  };

  const handleSmartDraft = () => {
    setNoteText(buildSmartDraft());
  };

  const insertMention = (name) => {
    setNoteText((prev) => prev.slice(0, -1) + `@${name} `);
    setMentionOpen(false);
  };

  if (loading) {
    return <div className="p-8 font-data-tabular text-data-tabular text-on-surface-variant">Loading workspace...</div>;
  }
  if (loadError && !caseRecord) {
    return <div className="p-8 font-data-tabular text-data-tabular text-status-critical">Couldn't load workspace: {loadError}</div>;
  }
  if (!caseRecord) {
    return <div className="p-8 font-data-tabular text-data-tabular text-status-critical">Case not found.</div>;
  }

  const isMember = taskForce.some((t) => t.member_id === session.user.id);

  return (
    <>
      {inCall && (
        <VideoCallRoom
          caseCode={caseCode}
          session={session}
          profile={profile}
          onClose={handleCloseCall}
          statusMessage={callStatusMessage}
        />
      )}
      {incomingCall && !inCall && (
        <div className="fixed top-4 right-4 z-[9997] bg-surface-container-high border border-data-focus rounded shadow-2xl p-4 w-80">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-data-focus animate-pulse">videocam</span>
            <p className="font-body-md text-body-md text-on-surface font-semibold">Incoming Case Call</p>
          </div>
          <p className="font-data-tabular text-data-tabular text-on-surface-variant mb-3">
            {incomingCall.fromName} is calling about {caseCode}.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAcceptCall}
              className="flex-1 bg-status-success text-on-primary-fixed py-2 rounded font-label-caps text-label-caps font-semibold"
            >
              Accept
            </button>
            <button
              onClick={handleDeclineCall}
              className="flex-1 border border-status-critical text-status-critical py-2 rounded font-label-caps text-label-caps"
            >
              Decline
            </button>
            <button
              onClick={handleDismissCall}
              className="px-3 border border-surface-border text-on-surface-variant py-2 rounded font-label-caps text-label-caps"
              title="Dismiss without responding"
            >
              Ignore
            </button>
          </div>
        </div>
      )}
    <div className="flex flex-col h-full bg-surface-container">
      {loadError && (
        <p className="font-data-tabular text-data-tabular text-status-critical bg-status-critical/10 px-5 py-2 border-b border-status-critical">
          Some workspace data couldn't load: {loadError}
        </p>
      )}
      <div className="flex items-center justify-between p-5 border-b border-surface-border shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-caps text-label-caps text-status-critical border border-status-critical rounded px-2 py-0.5">
              {caseRecord.risk_level.toUpperCase()} RISK
            </span>
            <span className="font-data-tabular text-data-tabular text-on-surface-variant">{caseRecord.case_code}</span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">{caseRecord.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleStartVideoCall} className="border border-secondary text-secondary px-3 py-2 rounded font-label-caps text-label-caps flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">videocam</span>
            Video Call
          </button>
          {!isMember && (
            <button onClick={handleJoin} className="bg-status-success text-on-primary-fixed px-3 py-2 rounded font-label-caps text-label-caps font-semibold">
              Join Task Force
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-2 text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5 grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-low border border-surface-border rounded p-4">
          <h2 className="font-headline-sm text-headline-sm text-data-focus mb-4">Joint Task Force</h2>
          {joinError && (
            <p className="font-data-tabular text-data-tabular text-status-critical mb-3">{joinError}</p>
          )}
          <div className="space-y-3">
            {taskForce.length === 0 && <p className="font-data-tabular text-data-tabular text-on-surface-variant">No members yet.</p>}
            {taskForce.map((t) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-container-high border border-surface-border flex items-center justify-center font-label-caps text-label-caps text-data-focus">
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

        <div className="lg:col-span-2 bg-surface-container-low border border-surface-border rounded flex flex-col overflow-hidden max-h-[600px]">
          <h2 className="font-headline-sm text-headline-sm text-data-focus p-4 pb-3 border-b border-surface-border shrink-0">Evidence &amp; Comm Log</h2>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {evidenceLog.length === 0 && <p className="font-data-tabular text-data-tabular text-on-surface-variant">No entries yet.</p>}
            {evidenceLog.map((n) => {
              const isOwn = n.author_id === session.user.id;
              const initials = n.profiles?.full_name?.split(" ").map((c) => c[0]).slice(0, 2).join("") ?? "?";
              return (
                <div key={n.id} className={`flex items-end gap-2 ${isOwn ? "justify-end" : "justify-start"}`}>
                  {!isOwn && (
                    <div className="w-7 h-7 rounded-full bg-surface-container-high border border-surface-border flex items-center justify-center font-label-caps text-label-caps text-data-focus shrink-0">
                      {initials}
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-lg px-3 py-2 ${isOwn ? "bg-secondary/15 border border-secondary/30 rounded-br-none" : "bg-surface-container-high border border-surface-border rounded-bl-none"}`}>
                    {!isOwn && <p className="font-label-caps text-label-caps text-data-focus mb-0.5">{n.profiles?.full_name}</p>}
                    {n.body && <p className="font-body-md text-body-md text-on-surface whitespace-pre-wrap">{renderBody(n.body, taskForce)}</p>}
                    {n.message_type === "voice" && n.attachment_url && (
                      <audio controls src={n.attachment_url} className="mt-1 max-w-full" />
                    )}
                    {n.message_type === "file" && n.attachment_url && (
                      <a href={n.attachment_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 mt-1.5 bg-surface-container border border-surface-border rounded px-2 py-1 hover:border-data-focus transition-colors">
                        <span className="material-symbols-outlined text-data-focus text-[16px]">description</span>
                        <span className="font-data-tabular text-data-tabular text-data-focus">{n.attachment_label}</span>
                      </a>
                    )}
                    <p className={`font-data-tabular text-data-tabular text-on-surface-variant mt-1 ${isOwn ? "text-right" : ""}`}>
                      {new Date(n.created_at).toISOString().slice(11, 16)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-surface-border p-3 shrink-0 relative">
            {mentionOpen && taskForce.length > 0 && (
              <div className="absolute bottom-full left-3 mb-1 bg-surface-container border border-surface-border rounded shadow-xl z-10 w-48">
                {taskForce.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => insertMention(t.profiles?.full_name)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-container-high font-body-md text-body-md text-on-surface"
                  >
                    {t.profiles?.full_name}
                  </button>
                ))}
              </div>
            )}
            {uploading && <p className="font-data-tabular text-data-tabular text-secondary mb-2">Uploading...</p>}
            <div className="flex items-center gap-1 mb-2">
              <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded hover:bg-surface-container-high transition-colors" title="Attach document or image">
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">attach_file</span>
              </button>
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`p-1.5 rounded transition-colors ${recording ? "bg-status-critical/20 text-status-critical" : "hover:bg-surface-container-high text-on-surface-variant"}`}
                title={recording ? "Stop recording" : "Record voice note"}
              >
                <span className="material-symbols-outlined text-[18px]">{recording ? "stop_circle" : "mic"}</span>
              </button>
              <button
                onClick={handleSmartDraft}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-container-high text-data-focus transition-colors"
                title="Fill the note field with a status summary drafted from this case's real data"
              >
                <span className="material-symbols-outlined text-[16px]">smart_toy</span>
                <span className="font-label-caps text-label-caps">Smart Draft</span>
              </button>
              <span className="font-data-tabular text-data-tabular text-on-surface-variant">Type @ to mention</span>
            </div>
            {postError && (
              <p className="font-data-tabular text-data-tabular text-status-critical mb-2">{postError}</p>
            )}
            <div className="flex gap-2">
              <input
                value={noteText}
                onChange={handleNoteChange}
                onKeyDown={(e) => e.key === "Enter" && handlePostNote()}
                placeholder="Add evidence note..."
                className="flex-1 bg-primary-container border border-surface-border text-on-surface px-3 py-2 rounded text-sm focus:outline-none focus:border-data-focus"
              />
              <button onClick={handlePostNote} disabled={posting} className="bg-secondary text-on-secondary px-4 py-2 rounded font-label-caps text-label-caps font-semibold disabled:opacity-60 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">send</span>
                Post
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-surface-container-low border border-surface-border rounded p-4">
            <h2 className="font-headline-sm text-headline-sm text-data-focus mb-4">Key Milestones</h2>
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

          <div className="bg-surface-container-low border border-surface-border rounded p-4">
            <h2 className="font-headline-sm text-headline-sm text-data-focus mb-4">Action Items</h2>
            {actionItemError && (
              <p className="font-data-tabular text-data-tabular text-status-critical mb-3">{actionItemError}</p>
            )}
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
    </div>
    </>
  );
}
