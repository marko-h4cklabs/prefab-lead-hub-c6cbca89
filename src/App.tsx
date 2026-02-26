import { useEffect, useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import VerifyEmailPending from "./pages/VerifyEmailPending";
import AuthCallback from "./pages/AuthCallback";
import AdminPanel from "./pages/AdminPanel";
import Onboarding from "./pages/Onboarding";
import ModeSelectionScreen from "./components/ModeSelectionScreen";
import CatalogLayout from "./components/catalog/CatalogLayout";
import MainHub from "./pages/MainHub";
import LeadsSection from "./pages/sections/LeadsSection";
import AgentSection from "./pages/sections/AgentSection";
import SettingsSection from "./pages/sections/SettingsSection";
import LeadBoardPage from "./pages/subtopics/LeadBoardPage";
import InboxPage from "./pages/subtopics/InboxPage";
import PipelinePage from "./pages/subtopics/PipelinePage";
import CalendarPage from "./pages/subtopics/CalendarPage";
import IdentityPage from "./pages/subtopics/IdentityPage";
import BehaviorPage from "./pages/subtopics/BehaviorPage";
import QuotePage from "./pages/subtopics/QuotePage";
import TestChatPage from "./pages/subtopics/TestChatPage";
import IntegrationsPage from "./pages/subtopics/IntegrationsPage";
import SchedulingPage from "./pages/subtopics/SchedulingPage";
import AnalyticsPage from "./pages/subtopics/AnalyticsPage";
import AccountBillingPage from "./pages/subtopics/AccountBillingPage";
import LeadDetail from "./pages/LeadDetail";
import Conversation from "./pages/Conversation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ModeGate = ({ children }: { children: React.ReactNode }) => {
  const [checking, setChecking] = useState(true);
  const [needsMode, setNeedsMode] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("auth_token") || localStorage.getItem("plcs_token");
    if (!token) { setChecking(false); return; }
    api.me()
      .then((res) => {
        if (res.company_id) localStorage.setItem("plcs_company_id", res.company_id);
        const mode = (res as any).operating_mode ?? (res.user as any)?.operating_mode ?? null;
        setNeedsMode(mode === null || mode === undefined);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (needsMode) return <ModeSelectionScreen onModeSet={() => setNeedsMode(false)} />;
  return <>{children}</>;
};

const App = () => {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", event.reason);
      toast({ title: "Error", description: getErrorMessage(event.reason), variant: "destructive" });
      event.preventDefault();
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email-pending" element={<VerifyEmailPending />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/leads" element={<Navigate to="/dashboard/leads/inbox" replace />} />
          <Route path="/pipeline" element={<Navigate to="/dashboard/leads/pipeline" replace />} />
          <Route path="/analytics" element={<Navigate to="/dashboard/settings/analytics" replace />} />
          <Route path="/calendar" element={<Navigate to="/dashboard/leads/calendar" replace />} />
          <Route path="/fields" element={<Navigate to="/dashboard/agent" replace />} />
          <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
          <Route path="/billing" element={<Navigate to="/dashboard/settings/account" replace />} />
          <Route path="/account" element={<Navigate to="/dashboard/settings/account" replace />} />

          {/* Catalog layout */}
          <Route element={<ModeGate><CatalogLayout /></ModeGate>}>
            <Route path="/dashboard" element={<MainHub />} />

            {/* Leads & CRM */}
            <Route path="/dashboard/leads" element={<LeadsSection />} />
            <Route path="/dashboard/leads/board" element={<LeadBoardPage />} />
            <Route path="/dashboard/leads/inbox" element={<InboxPage />}>
              <Route path=":leadId" element={<LeadDetail />} />
              <Route path=":leadId/conversation" element={<Conversation />} />
            </Route>
            <Route path="/dashboard/leads/pipeline" element={<PipelinePage />} />
            <Route path="/dashboard/leads/calendar" element={<CalendarPage />} />

            {/* AI Agent */}
            <Route path="/dashboard/agent" element={<AgentSection />} />
            <Route path="/dashboard/agent/identity" element={<IdentityPage />} />
            <Route path="/dashboard/agent/behavior" element={<BehaviorPage />} />
            <Route path="/dashboard/agent/quote" element={<QuotePage />} />
            <Route path="/dashboard/agent/test" element={<TestChatPage />} />

            {/* Settings & Tools */}
            <Route path="/dashboard/settings" element={<SettingsSection />} />
            <Route path="/dashboard/settings/integrations" element={<IntegrationsPage />} />
            <Route path="/dashboard/settings/scheduling" element={<SchedulingPage />} />
            <Route path="/dashboard/settings/analytics" element={<AnalyticsPage />} />
            <Route path="/dashboard/settings/account" element={<AccountBillingPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
