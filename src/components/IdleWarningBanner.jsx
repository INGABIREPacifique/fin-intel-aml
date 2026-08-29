import { useAuth } from "../lib/AuthContext";

export default function IdleWarningBanner() {
  const { idleWarning, session } = useAuth();

  if (!idleWarning || !session) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-status-warning text-surface-container-lowest px-4 py-2 flex items-center justify-center gap-2 font-label-caps text-label-caps">
      <span className="material-symbols-outlined text-[18px]">schedule</span>
      Your session will expire soon due to inactivity. Move your mouse or press a key to stay signed in.
    </div>
  );
}
