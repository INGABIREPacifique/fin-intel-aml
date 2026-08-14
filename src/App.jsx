import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CaseDetail from "./pages/CaseDetail";
import SarFiling from "./pages/SarFiling";
import AlertQueue from "./pages/AlertQueue";
import ComingSoon from "./pages/ComingSoon";
import InstitutionsList from "./pages/InstitutionsList";
import InstitutionProfile from "./pages/InstitutionProfile";

const ALL_ROLES = ["investigator", "compliance_officer", "admin"];
const OFFICER_AND_ADMIN = ["compliance_officer", "admin"];
const ADMIN_ONLY = ["admin"];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <AlertQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigations"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <ComingSoon title="Investigations" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/network-graph"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <ComingSoon title="Network Graph" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/institutions"
            element={
              <ProtectedRoute allowedRoles={OFFICER_AND_ADMIN}>
                <InstitutionsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/institutions/:code"
            element={
              <ProtectedRoute allowedRoles={OFFICER_AND_ADMIN}>
                <InstitutionProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/data-health"
            element={
              <ProtectedRoute allowedRoles={OFFICER_AND_ADMIN}>
                <ComingSoon title="Data Health" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/risk-engine"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ONLY}>
                <ComingSoon title="Risk Engine Configuration" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cases/:caseCode"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <CaseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseCode/sar"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <SarFiling />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
