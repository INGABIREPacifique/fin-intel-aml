import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function BiometricVerification() {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    await supabase.from("audit_logs").insert({
      actor_id: session.user.id,
      action: "session_identity_confirmed",
      target_type: "session",
      target_label: profile?.full_name ?? "Unknown",
      details: { note: "Manual identity confirmation — no biometric hardware available in this environment" },
    });
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container border border-surface-border rounded-lg p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary-container border border-surface-border flex items-center justify-center">
          <span className="material-symbols-outlined text-secondary text-[36px]">fingerprint</span>
        </div>
        <h1 className="font-headline-md text-headline-md text-on-surface mb-2">
          Identity Verification Required
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Level 5 Access Protocol Invoked
        </p>

        <div className="bg-surface-container-low border border-surface-border rounded p-4 mb-6 text-left">
          <p className="font-label-caps text-label-caps text-status-warning uppercase mb-1">
            Manual Verification Mode
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant">
            No biometric reader is available in this browser environment. Confirm your identity manually
            to proceed — this action is logged to the audit trail as a real session event.
          </p>
        </div>

        {profile && (
          <p className="font-data-tabular text-data-tabular text-on-surface mb-6">
            Confirming as: <span className="text-data-focus font-semibold">{profile.full_name}</span>
          </p>
        )}

        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="w-full bg-status-success text-white font-label-caps text-label-caps font-bold py-4 rounded disabled:opacity-60"
        >
          {confirming ? "CONFIRMING..." : "CONFIRM IDENTITY & CONTINUE"}
        </button>
      </div>
    </div>
  );
}
