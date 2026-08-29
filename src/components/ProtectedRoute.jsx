import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile, profileError, profileLoading, retryProfile, signOut } = useAuth();

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-data-tabular text-data-tabular">
        VERIFYING SESSION...
      </div>
    );
  }

  if (session === null) {
    return <Navigate to="/login" replace />;
  }

  // If roles are restricted on this route, wait for the profile to load,
  // then block anyone whose role isn't in the allow-list.
  if (allowedRoles) {
    if (profileError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-status-critical font-data-tabular text-data-tabular p-8 text-center">
          <p>Couldn't load your profile: {profileError}</p>
          <div className="flex gap-3">
            <button
              onClick={retryProfile}
              className="px-4 py-2 border border-status-critical rounded font-label-caps text-label-caps hover:bg-status-critical/10"
            >
              Retry
            </button>
            <button
              onClick={signOut}
              className="px-4 py-2 border border-surface-border text-on-surface-variant rounded font-label-caps text-label-caps hover:bg-surface-variant"
            >
              Log Out
            </button>
          </div>
        </div>
      );
    }
    if (profile === null && profileLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-data-tabular text-data-tabular">
          LOADING PROFILE...
        </div>
      );
    }
    if (profile === null && !profileLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-status-critical font-data-tabular text-data-tabular p-8 text-center">
          <p>No staff profile is associated with this account. Contact an administrator.</p>
          <button
            onClick={signOut}
            className="px-4 py-2 border border-surface-border text-on-surface-variant rounded font-label-caps text-label-caps hover:bg-surface-variant"
          >
            Log Out
          </button>
        </div>
      );
    }
    if (profile && !allowedRoles.includes(profile.role)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-status-critical font-data-tabular text-data-tabular p-8 text-center">
          ACCESS DENIED — your role ({profile.role.replace("_", " ").toUpperCase()}) does not have
          permission to view this section.
        </div>
      );
    }
  }

  return children;
}
