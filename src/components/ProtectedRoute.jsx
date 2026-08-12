import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function ProtectedRoute({ children }) {
  const { session } = useAuth();

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

  return children;
}
