import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, profile } = useAuth();

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
    if (profile === null) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-data-tabular text-data-tabular">
          LOADING PROFILE...
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
