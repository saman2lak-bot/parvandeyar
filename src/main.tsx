import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import RequireAuth from "./components/RequireAuth";
import AuthSessionGuard from "./components/AuthSessionGuard";
import "./styles.css";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const SimplePage = lazy(() => import("./pages/SimplePage"));
const protectedElement = (element: React.ReactNode) => (
  <RequireAuth>{element}</RequireAuth>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename="/parvandeyar">
      <AuthSessionGuard />
      <Suspense
        fallback={
          <div className="auth-loading" dir="rtl">
            در حال بارگذاری...
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/cases"
            element={protectedElement(<App page="cases" />)}
          />
          <Route
            path="/experts"
            element={protectedElement(<SimplePage type="experts" />)}
          />
          <Route
            path="/activity"
            element={protectedElement(<SimplePage type="activity" />)}
          />
          <Route
            path="/settings"
            element={protectedElement(<SimplePage type="settings" />)}
          />
          <Route path="*" element={protectedElement(<App />)} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
