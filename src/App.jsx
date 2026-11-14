import React, { Suspense, lazy, useEffect } from "react";
import { Buffer } from "buffer";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import logo from "./assets/aristone-logo.svg";
import { FormDefinitionProvider } from "./context/FormDefinitionContext.jsx";
import PublicIntakePage from "./pages/PublicIntakePage.jsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import ThemeToggleButton from "./components/ThemeToggleButton.jsx";
import { LEGACY_SOLICITOR_LOGIN_PATH, SOLICITOR_LOGIN_PATH } from "./lib/auth.js";
import { isStaleChunkLoadError } from "./utils/loadPdfGeneratorModule.js";

const STALE_CHUNK_RELOAD_KEY = "will-tool-stale-chunk-reload";

/**
 * React.lazy plus one automatic page reload if the chunk is gone after a new deploy
 * (an open tab still references the old hashed file names).
 */
function lazyPage(loader) {
  return lazy(() =>
    loader()
      .then((mod) => {
        try { sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY); } catch { /* storage unavailable */ }
        return mod;
      })
      .catch((err) => {
        let alreadyReloaded = false;
        try { alreadyReloaded = sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) === "1"; } catch { /* ignore */ }
        if (isStaleChunkLoadError(err) && !alreadyReloaded) {
          try { sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, "1"); } catch { /* ignore */ }
          window.location.reload();
          return new Promise(() => {}); // keep Suspense fallback while the page reloads
        }
        throw err;
      })
  );
}

// Staff-only screens are loaded on demand so clients on phones don't download the solicitor portal.
const SolicitorLoginPage = lazyPage(() => import("./pages/SolicitorLoginPage.jsx"));
const SolicitorDashboardPage = lazyPage(() => import("./pages/SolicitorDashboardPage.jsx"));
const MatterDetailPage = lazyPage(() => import("./pages/MatterDetailPage.jsx"));
const MatterEditorPage = lazyPage(() => import("./pages/MatterEditorPage.jsx"));
const QuestionnaireEditorPage = lazyPage(() => import("./pages/QuestionnaireEditorPage.jsx"));
const GuardianFlowDemoPage = lazyPage(() => import("./pages/GuardianFlowDemoPage.jsx"));
const SolicitorUrgentPage = lazyPage(() => import("./pages/SolicitorUrgentPage.jsx"));
const SolicitorCalendarPage = lazyPage(() => import("./pages/SolicitorCalendarPage.jsx"));
const SolicitorAvailabilityPage = lazyPage(() => import("./pages/SolicitorAvailabilityPage.jsx"));
const SolicitorReportsPage = lazyPage(() => import("./pages/SolicitorReportsPage.jsx"));
const SolicitorStaffPage = lazyPage(() => import("./pages/SolicitorStaffPage.jsx"));
const SolicitorSignInEventsPage = lazyPage(() => import("./pages/SolicitorSignInEventsPage.jsx"));
const SolicitorLayout = lazyPage(() => import("./components/solicitor/SolicitorLayout.jsx"));

function RouteLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-sm text-slate-300" role="status">
      Loading…
    </div>
  );
}

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
      <Suspense fallback={<RouteLoading />}>
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
      </Suspense>
    </FormDefinitionProvider>
  );
}
