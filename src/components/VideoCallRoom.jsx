import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Public STUN server for NAT traversal, which works on typical networks.
// A TURN server can be added later for restrictive/symmetric-NAT networks by
// setting these two env vars — no code changes needed. Until then, ICE just
// falls back to STUN-only, which is what's active by default.
function buildIceServers() {
  const servers = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls: turnUrl,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    });
  }
  return servers;
}

export default function VideoCallRoom({ caseCode, session, profile, onClose }) {
  const [localStream, setLocalStream] = useState(null);
  const [remotePeers, setRemotePeers] = useState({}); // { userId: { stream, name } }
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(true);

  const localVideoRef = useRef(null);
  const channelRef = useRef(null);
  const peerConnectionsRef = useRef({}); // { userId: RTCPeerConnection }
  const localStreamRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err) {
        if (!cancelled) {
          setError(
            err.name === "NotAllowedError"
              ? "Camera/microphone access was denied. Allow access in your browser to join the call."
              : `Couldn't access camera/microphone: ${err.message}`
          );
          setConnecting(false);
        }
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const myId = session.user.id;
      const myName = profile?.full_name ?? "Unknown";

      const channel = supabase.channel(`case-call:${caseCode}`, {
        config: { presence: { key: myId } },
      });
      channelRef.current = channel;

      const createPeerConnection = (remoteId) => {
        const pc = new RTCPeerConnection({ iceServers: buildIceServers() });
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            channel.send({
              type: "broadcast",
              event: "ice-candidate",
              payload: { from: myId, to: remoteId, candidate: e.candidate },
            });
          }
        };

        pc.ontrack = (e) => {
          setRemotePeers((prev) => ({
            ...prev,
            [remoteId]: { ...(prev[remoteId] ?? {}), stream: e.streams[0] },
          }));
        };

        pc.onconnectionstatechange = () => {
          if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
            setRemotePeers((prev) => {
              const next = { ...prev };
              delete next[remoteId];
              return next;
            });
          }
        };

        peerConnectionsRef.current[remoteId] = pc;
        return pc;
      };

      const connectToPeer = async (remoteId, remoteName) => {
        if (peerConnectionsRef.current[remoteId]) return;
        setRemotePeers((prev) => ({ ...prev, [remoteId]: { name: remoteName, stream: null } }));
        const pc = createPeerConnection(remoteId);
        // Deterministic offerer: whoever has the lexicographically smaller
        // user id initiates, avoiding both sides sending an offer at once.
        if (myId < remoteId) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.send({
            type: "broadcast",
            event: "offer",
            payload: { from: myId, fromName: myName, to: remoteId, sdp: offer },
          });
        }
      };

      channel
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (payload.to !== myId) return;
          const pc = peerConnectionsRef.current[payload.from] ?? createPeerConnection(payload.from);
          setRemotePeers((prev) => ({
            ...prev,
            [payload.from]: { ...(prev[payload.from] ?? {}), name: payload.fromName },
          }));
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({
            type: "broadcast",
            event: "answer",
            payload: { from: myId, to: payload.from, sdp: answer },
          });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (payload.to !== myId) return;
          const pc = peerConnectionsRef.current[payload.from];
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        })
        .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
          if (payload.to !== myId) return;
          const pc = peerConnectionsRef.current[payload.from];
          if (pc) {
            try {
              await pc.addIceCandidate(payload.candidate);
            } catch {
              // Benign: candidate can arrive before remote description is set.
            }
          }
        })
        .on("presence", { event: "sync" } , () => {
          const state = channel.presenceState();
          Object.entries(state).forEach(([remoteId, metas]) => {
            if (remoteId === myId) return;
            connectToPeer(remoteId, metas[0]?.name);
          });
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          const pc = peerConnectionsRef.current[key];
          if (pc) {
            pc.close();
            delete peerConnectionsRef.current[key];
          }
          setRemotePeers((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await channel.track({ name: myName });
            setConnecting(false);
            supabase.from("audit_logs").insert({
              actor_id: myId,
              action: "video_call_joined",
              target_type: "case",
              target_label: caseCode,
              details: {},
            });
          }
        });
    }

    setup();

    return () => {
      cancelled = true;
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
      peerConnectionsRef.current = {};
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseCode]);

  const handleLeave = async () => {
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "video_call_left",
      target_type: "case",
      target_label: caseCode,
      details: {},
    });
    onClose();
  };

  const toggleMic = () => {
    localStream?.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    localStream?.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((v) => !v);
  };

  const remoteList = Object.entries(remotePeers);

  return (
    <div className="fixed inset-0 z-[9998] bg-[#0b1120] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
        <div className="flex items-center gap-2 text-on-surface">
          <span className="material-symbols-outlined text-status-critical">fiber_manual_record</span>
          <span className="font-label-caps text-label-caps">Secure Case Call — {caseCode}</span>
        </div>
        <span className="font-data-tabular text-data-tabular text-on-surface-variant">
          End-to-end within FIN-INTEL AML — no external service
        </span>
      </div>

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <p className="font-data-tabular text-data-tabular text-status-critical max-w-md text-center">{error}</p>
        </div>
      )}

      {!error && (
        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3 p-4 overflow-auto content-start">
          <div className="relative bg-surface-container rounded overflow-hidden aspect-video">
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <span className="absolute bottom-2 left-2 font-label-caps text-label-caps bg-black/60 text-white px-2 py-0.5 rounded">
              You{!micOn && " · Muted"}
            </span>
          </div>
          {remoteList.map(([id, peer]) => (
            <RemoteTile key={id} peer={peer} />
          ))}
          {connecting && remoteList.length === 0 && (
            <div className="col-span-full flex items-center justify-center text-on-surface-variant font-data-tabular text-data-tabular py-12">
              Connecting...
            </div>
          )}
          {!connecting && remoteList.length === 0 && (
            <div className="col-span-full flex items-center justify-center text-on-surface-variant font-data-tabular text-data-tabular py-12">
              Waiting for other task force members to join this call.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 py-6 border-t border-surface-border">
        <button
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            micOn ? "bg-surface-container text-on-surface" : "bg-status-critical text-white"
          }`}
        >
          <span className="material-symbols-outlined">{micOn ? "mic" : "mic_off"}</span>
        </button>
        <button
          onClick={toggleCam}
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            camOn ? "bg-surface-container text-on-surface" : "bg-status-critical text-white"
          }`}
        >
          <span className="material-symbols-outlined">{camOn ? "videocam" : "videocam_off"}</span>
        </button>
        <button
          onClick={handleLeave}
          className="px-6 h-12 rounded-full bg-status-critical text-white font-label-caps text-label-caps flex items-center gap-2"
        >
          <span className="material-symbols-outlined">call_end</span>
          Leave Call
        </button>
      </div>
    </div>
  );
}

function RemoteTile({ peer }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && peer.stream) videoRef.current.srcObject = peer.stream;
  }, [peer.stream]);

  return (
    <div className="relative bg-surface-container rounded overflow-hidden aspect-video">
      {peer.stream ? (
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-data-tabular text-data-tabular">
          Connecting...
        </div>
      )}
      <span className="absolute bottom-2 left-2 font-label-caps text-label-caps bg-black/60 text-white px-2 py-0.5 rounded">
        {peer.name ?? "Unknown"}
      </span>
    </div>
  );
}
