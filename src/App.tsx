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
import AppLayout from "./components/AppLayout";
import InboxLayout from "./components/InboxLayout";
import Leads from "./pages/Leads";
import Simulation from "./pages/Simulation";
import Calendar from "./pages/Calendar";
import LeadDetail from "./pages/LeadDetail";
import Conversation from "./pages/Conversation";
import Fields from "./pages/Fields";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AdminPanel from "./pages/AdminPanel";
import Onboarding from "./pages/Onboarding";
import ModeSelectionScreen from "./components/ModeSelectionScreen";

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
  // Global safety net
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
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<Navigate to="/leads" replace />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<ModeGate><AppLayout /></ModeGate>}>
            {/* Inbox routes wrapped in InboxLayout (Zone 2 lead list) */}
            <Route element={<InboxLayout />}>
              <Route path="/leads" element={<Leads />} />
              <Route path="/leads/:leadId" element={<LeadDetail />} />
              <Route path="/leads/:leadId/conversation" element={<Conversation />} />
            </Route>
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/fields" element={<Fields />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;
