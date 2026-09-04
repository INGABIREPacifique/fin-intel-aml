import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "./lib/AuthContext";
import { ThemeProvider } from "./lib/ThemeContext";
import { MobileNavProvider } from "./lib/MobileNavContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import IdleWarningBanner from "./components/IdleWarningBanner";

// Every other page is lazy-loaded (route-based code splitting) so a user
// only downloads the JS for the screens they actually visit, instead of
// one ~800kB bundle containing every page in the app up front — this
// matters in practice, not just as a best-practice checkbox, given the
// platform's stated focus on markets where mobile data can be slow or
// costly. Login stays eagerly loaded since it's the very first thing an
// unauthenticated user sees; lazy-loading it would add an extra network
// round-trip before they could even see the login form.
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const BiometricVerification = lazy(() => import("./pages/BiometricVerification"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CaseDetail = lazy(() => import("./pages/CaseDetail"));
const SarFiling = lazy(() => import("./pages/SarFiling"));
const AlertQueue = lazy(() => import("./pages/AlertQueue"));
const InstitutionsList = lazy(() => import("./pages/InstitutionsList"));
const InstitutionProfile = lazy(() => import("./pages/InstitutionProfile"));
const GlobalAuditTrail = lazy(() => import("./pages/GlobalAuditTrail"));
const RiskEngineConfig = lazy(() => import("./pages/RiskEngineConfig"));
const NewInvestigation = lazy(() => import("./pages/NewInvestigation"));
const Investigations = lazy(() => import("./pages/Investigations"));
const DataHealth = lazy(() => import("./pages/DataHealth"));
const SecurityConfig = lazy(() => import("./pages/SecurityConfig"));
const AccessPermissions = lazy(() => import("./pages/AccessPermissions"));
const ApiGateway = lazy(() => import("./pages/ApiGateway"));
const InstitutionOnboarding = lazy(() => import("./pages/InstitutionOnboarding"));
const NetworkAnalysis = lazy(() => import("./pages/NetworkAnalysis"));
const EntitySearch = lazy(() => import("./pages/EntitySearch"));
const EntityProfile = lazy(() => import("./pages/EntityProfile"));
const GraphExplorer = lazy(() => import("./pages/GraphExplorer"));
const RiskModelDetail = lazy(() => import("./pages/RiskModelDetail"));
const CaseWorkspace = lazy(() => import("./pages/CaseWorkspace"));
const Settings = lazy(() => import("./pages/Settings"));
const MobileFieldHub = lazy(() => import("./pages/MobileFieldHub"));
const MobileAlertDetail = lazy(() => import("./pages/MobileAlertDetail"));

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant font-data-tabular text-data-tabular">
      Loading...
    </div>
  );
}

const ALL_ROLES = ["investigator", "compliance_officer", "admin"];
const OFFICER_AND_ADMIN = ["compliance_officer", "admin"];
const ADMIN_ONLY = ["admin"];

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <MobileNavProvider>
      <IdleWarningBanner />
      <BrowserRouter>
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/biometric-verification"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <BiometricVerification />
              </ProtectedRoute>
            }
          />

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
                <NetworkAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/entities"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <EntitySearch />
              </ProtectedRoute>
            }
          />
          <Route
            path="/entities/:id"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <EntityProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/graph-explorer"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <GraphExplorer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <MobileFieldHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mobile/alerts/:caseCode"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <MobileAlertDetail />
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
            path="/risk-engine/:modelId"
            element={
              <ProtectedRoute allowedRoles={ADMIN_ONLY}>
                <RiskModelDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseCode/workspace"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <CaseWorkspace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={ALL_ROLES}>
                <Settings />
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
        </Suspense>
      </BrowserRouter>
    </MobileNavProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
