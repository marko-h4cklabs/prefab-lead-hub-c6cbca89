import { useEffect, useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import AdminPanel from "./pages/AdminPanel";
import Onboarding from "./pages/Onboarding";
import ModeSelectionScreen from "./components/ModeSelectionScreen";
import CatalogLayout from "./components/catalog/CatalogLayout";
import MainHub from "./pages/MainHub";
import LeadsSection from "./pages/sections/LeadsSection";
import AgentSection from "./pages/sections/AgentSection";
import SettingsSection from "./pages/sections/SettingsSection";
import InboxPage from "./pages/subtopics/InboxPage";
import PipelinePage from "./pages/subtopics/PipelinePage";
import CalendarPage from "./pages/subtopics/CalendarPage";
import IdentityPage from "./pages/subtopics/IdentityPage";
import BehaviorPage from "./pages/subtopics/BehaviorPage";
import QuotePage from "./pages/subtopics/QuotePage";
import TestChatPage from "./pages/subtopics/TestChatPage";
import VoicePage from "./pages/subtopics/VoicePage";
import FollowUpPage from "./pages/subtopics/FollowUpPage";
import IntegrationsPage from "./pages/subtopics/IntegrationsPage";
import AnalyticsPage from "./pages/subtopics/AnalyticsPage";
import AccountBillingPage from "./pages/subtopics/AccountBillingPage";
import LeadDetail from "./pages/LeadDetail";
import Conversation from "./pages/Conversation";
import NotFound from "./pages/NotFound";
import CopilotLayout from "./pages/copilot/CopilotLayout";
import CopilotConversations from "./pages/copilot/CopilotConversations";
import CopilotDashboard from "./pages/copilot/CopilotDashboard";
import CopilotPipeline from "./pages/copilot/CopilotPipeline";
import CopilotCalendar from "./pages/copilot/CopilotCalendar";
import CopilotSettings from "./pages/copilot/CopilotSettings";
import CopilotTeam from "./pages/copilot/CopilotTeam";
import TeamMemberSetup from "./pages/TeamMemberSetup";
import { clearAuth } from "@/lib/apiClient";

const queryClient = new QueryClient();

/** Redirect old /join/:code to /team-member-setup/:code */
const JoinTeamRedirect = () => {
  const path = window.location.pathname;
  const code = path.split("/join/")[1] || "";
  return <Navigate to={`/team-member-setup/${code}`} replace />;
};

/** Redirect root: authenticated → /copilot, otherwise → /login */
const RootRedirect = () => {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("plcs_token");
  return <Navigate to={token ? "/copilot" : "/login"} replace />;
};

const ModeGate = ({ children }: { children: React.ReactNode }) => {
  const [checking, setChecking] = useState(true);
  const [needsMode, setNeedsMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("auth_token") || localStorage.getItem("plcs_token");
    if (!token) { setChecking(false); return; }
    api.me()
      .then((res: any) => {
        if (res.company_id) localStorage.setItem("plcs_company_id", res.company_id);

        const status = res.status;
        // Users that haven't completed verification — clear auth, send to login
        if (status === "email_unverified" || status === "team_pending") {
          clearAuth();
          navigate("/login", { replace: true });
          return;
        }
        // Users still in onboarding
        if (status === "pending_onboarding") {
          navigate("/onboarding", { replace: true });
          return;
        }
        // active / team_active — check operating mode
        const mode = res.operating_mode ?? res.user?.operating_mode ?? null;
        setNeedsMode(mode === null || mode === undefined);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [navigate]);

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
          <Route path="/verify-email-pending" element={<Navigate to="/login" replace />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/dashboard/admin" element={<AdminPanel />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/leads" element={<Navigate to="/dashboard/leads/inbox" replace />} />
          <Route path="/pipeline" element={<Navigate to="/dashboard/leads/pipeline" replace />} />
          <Route path="/analytics" element={<Navigate to="/dashboard/leads/analytics" replace />} />
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
            <Route path="/dashboard/leads/inbox" element={<InboxPage />}>
              <Route path=":leadId" element={<LeadDetail />} />
              <Route path=":leadId/conversation" element={<Conversation />} />
            </Route>
            <Route path="/dashboard/leads/pipeline" element={<PipelinePage />} />
            <Route path="/dashboard/leads/calendar" element={<CalendarPage />} />
            <Route path="/dashboard/leads/analytics" element={<AnalyticsPage />} />

            {/* AI Agent */}
            <Route path="/dashboard/agent" element={<AgentSection />} />
            <Route path="/dashboard/agent/identity" element={<IdentityPage />} />
            <Route path="/dashboard/agent/behavior" element={<BehaviorPage />} />
            <Route path="/dashboard/agent/quote" element={<QuotePage />} />
            <Route path="/dashboard/agent/test" element={<TestChatPage />} />
            <Route path="/dashboard/agent/voice" element={<VoicePage />} />
            <Route path="/dashboard/agent/followup" element={<FollowUpPage />} />

            {/* Settings & Tools */}
            <Route path="/dashboard/settings" element={<SettingsSection />} />
            <Route path="/dashboard/settings/integrations" element={<IntegrationsPage />} />
            <Route path="/dashboard/settings/scheduling" element={<Navigate to="/dashboard/settings" replace />} />
            <Route path="/dashboard/settings/analytics" element={<Navigate to="/dashboard/leads/analytics" replace />} />
            <Route path="/dashboard/settings/account" element={<AccountBillingPage />} />
          </Route>

          {/* Team member setup (public) */}
          <Route path="/team-member-setup/:code" element={<TeamMemberSetup />} />
          {/* Backward compat: old /join/:code redirects */}
          <Route path="/join/:code" element={<JoinTeamRedirect />} />

          {/* Co-Pilot layout */}
          <Route element={<ModeGate><CopilotLayout /></ModeGate>}>
            <Route path="/copilot" element={<Navigate to="/copilot/conversations" replace />} />
            <Route path="/copilot/conversations" element={<CopilotConversations />} />
            <Route path="/copilot/dashboard" element={<CopilotDashboard />} />
            <Route path="/copilot/pipeline" element={<CopilotPipeline />} />
            <Route path="/copilot/calendar" element={<CopilotCalendar />} />
            <Route path="/copilot/settings" element={<CopilotSettings />} />
            <Route path="/copilot/team" element={<CopilotTeam />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
