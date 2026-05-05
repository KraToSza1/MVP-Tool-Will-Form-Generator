import React, { useEffect } from "react";
import { Buffer } from "buffer";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import logo from "./assets/aristone-logo.svg";
import { FormDefinitionProvider } from "./context/FormDefinitionContext.jsx";
import PublicIntakePage from "./pages/PublicIntakePage.jsx";
import SolicitorLoginPage from "./pages/SolicitorLoginPage.jsx";
import SolicitorDashboardPage from "./pages/SolicitorDashboardPage.jsx";
import MatterDetailPage from "./pages/MatterDetailPage.jsx";
import MatterEditorPage from "./pages/MatterEditorPage.jsx";
import QuestionnaireEditorPage from "./pages/QuestionnaireEditorPage.jsx";
import GuardianFlowDemoPage from "./pages/GuardianFlowDemoPage.jsx";
import SolicitorUrgentPage from "./pages/SolicitorUrgentPage.jsx";
import SolicitorCalendarPage from "./pages/SolicitorCalendarPage.jsx";
import SolicitorAvailabilityPage from "./pages/SolicitorAvailabilityPage.jsx";
import SolicitorReportsPage from "./pages/SolicitorReportsPage.jsx";
import SolicitorStaffPage from "./pages/SolicitorStaffPage.jsx";
import SolicitorSignInEventsPage from "./pages/SolicitorSignInEventsPage.jsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import SolicitorLayout from "./components/solicitor/SolicitorLayout.jsx";
import ThemeToggleButton from "./components/ThemeToggleButton.jsx";
import { LEGACY_SOLICITOR_LOGIN_PATH, SOLICITOR_LOGIN_PATH } from "./lib/auth.js";

function LegacySolicitorLoginRoute() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const hasOAuthQuery = params.has("code") || params.has("error") || params.has("error_description");
  const hash = String(location.hash || "");
  const hasOAuthHash = hash.includes("access_token=") || hash.includes("error=");

  if (hasOAuthQuery || hasOAuthHash) {
    return <SolicitorLoginPage />;
  }
  return <Navigate to="/" replace />;
}

function PublicShell() {
  return (
    <div className="min-h-dvh w-full flex flex-col text-gray-800 bg-gray-50 transition-colors">
      <main className="flex-1 w-full">
        <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 lg:py-10">
          <header className="relative border shadow-md px-4 sm:px-5 md:px-6 py-4 sm:py-5 rounded-lg sm:rounded-xl mb-4 sm:mb-6 bg-white border-gray-200">
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="text-center mx-auto sm:justify-self-center">
                  <img
                    src={logo}
                    alt="Aristone Logo"
                    className="h-8 sm:h-10 md:h-12 mx-auto mb-2"
                  />
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Will Tool</h1>
                  <p className="mt-2 text-sm text-gray-600 max-w-2xl">
                    Client-friendly intake for Will instructions, with secure solicitor continuation and matter review.
                  </p>
                </div>

                <div className="flex flex-row flex-wrap items-center gap-2 sm:items-end">
                  <ThemeToggleButton compact />
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                <p className="text-sm font-medium text-indigo-900">
                  Clients complete the questionnaire here. Solicitors can sign in separately to continue matters and complete Testamentary Capacity.
                </p>
              </div>
            </div>
          </header>

          <PublicIntakePage />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    window.Buffer = window.Buffer || Buffer;
  }, []);

  return (
    <FormDefinitionProvider>
      <Routes>
        <Route path="/" element={<PublicShell />} />
        <Route path="/dev/guardian-flow" element={<GuardianFlowDemoPage />} />
        <Route path={SOLICITOR_LOGIN_PATH} element={<SolicitorLoginPage />} />
        <Route path={LEGACY_SOLICITOR_LOGIN_PATH} element={<LegacySolicitorLoginRoute />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/solicitor" element={<SolicitorLayout />}>
            <Route index element={<SolicitorDashboardPage />} />
            <Route path="urgent" element={<SolicitorUrgentPage />} />
            <Route path="calendar" element={<SolicitorCalendarPage />} />
            <Route path="availability" element={<SolicitorAvailabilityPage />} />
            <Route path="reports" element={<SolicitorReportsPage />} />
            <Route path="staff" element={<SolicitorStaffPage />} />
            <Route path="sign-in-events" element={<SolicitorSignInEventsPage />} />
            <Route path="matters/:matterId" element={<MatterDetailPage />} />
            <Route path="matters/:matterId/form" element={<MatterEditorPage />} />
            <Route path="questionnaire" element={<QuestionnaireEditorPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </FormDefinitionProvider>
  );
}
