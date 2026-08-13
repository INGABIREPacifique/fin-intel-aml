import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CaseDetail from "./pages/CaseDetail";
import SarFiling from "./pages/SarFiling";
import AlertQueue from "./pages/AlertQueue";
import ComingSoon from "./pages/ComingSoon";

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
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertQueue />
              </ProtectedRoute>
            }
          />
          <Route
            path="/investigations"
            element={
              <ProtectedRoute>
                <ComingSoon title="Investigations" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/network-graph"
            element={
              <ProtectedRoute>
                <ComingSoon title="Network Graph" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/data-health"
            element={
              <ProtectedRoute>
                <ComingSoon title="Data Health" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseCode"
            element={
              <ProtectedRoute>
                <CaseDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:caseCode/sar"
            element={
              <ProtectedRoute>
                <SarFiling />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
