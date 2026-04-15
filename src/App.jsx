import React, { useEffect } from "react";
import { Buffer } from "buffer";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import logo from "./assets/aristone-logo.svg";
import { FormDefinitionProvider } from "./context/FormDefinitionContext.jsx";
import PublicIntakePage from "./pages/PublicIntakePage.jsx";
import SolicitorLoginPage from "./pages/SolicitorLoginPage.jsx";
import SolicitorDashboardPage from "./pages/SolicitorDashboardPage.jsx";
import MatterDetailPage from "./pages/MatterDetailPage.jsx";
import MatterEditorPage from "./pages/MatterEditorPage.jsx";
import QuestionnaireEditorPage from "./pages/QuestionnaireEditorPage.jsx";
import GuardianFlowDemoPage from "./pages/GuardianFlowDemoPage.jsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import SolicitorLayout from "./components/solicitor/SolicitorLayout.jsx";
import ThemeToggleButton from "./components/ThemeToggleButton.jsx";

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
                  <Link
                    to="/solicitor/login"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-600 via-violet-600 to-purple-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-indigo-700 hover:via-violet-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <LockKeyhole size={16} />
                    Solicitor login
                  </Link>
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
        <Route path="/solicitor/login" element={<SolicitorLoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/solicitor" element={<SolicitorLayout />}>
            <Route index element={<SolicitorDashboardPage />} />
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
