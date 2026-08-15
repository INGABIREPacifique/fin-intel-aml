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
import GlobalAuditTrail from "./pages/GlobalAuditTrail";
import RiskEngineConfig from "./pages/RiskEngineConfig";
import NewInvestigation from "./pages/NewInvestigation";
import Investigations from "./pages/Investigations";
import DataHealth from "./pages/DataHealth";
import SecurityConfig from "./pages/SecurityConfig";
import AccessPermissions from "./pages/AccessPermissions";
import ApiGateway from "./pages/ApiGateway";
import InstitutionOnboarding from "./pages/InstitutionOnboarding";

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
                <Investigations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigations/new"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <NewInvestigation />
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
                <DataHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-trail"
            element={
              <ProtectedRoute allowedRoles={OFFICER_AND_ADMIN}>
                <GlobalAuditTrail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/risk-engine"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ONLY}>
                <RiskEngineConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/security"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ONLY}>
                <SecurityConfig />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/access"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ONLY}>
                <AccessPermissions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/integrations"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ONLY}>
                <ApiGateway />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/api-keys"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ONLY}>
                <ApiGateway />
              </ProtectedRoute>
            }
          />
          <Route
            path="/institutions/new"
            element={
              <ProtectedRoute allowedRoles={OFFICER_AND_ADMIN}>
                <InstitutionOnboarding />
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
