import { useEffect } from "react";
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
import Leads from "./pages/Leads";
import Simulation from "./pages/Simulation";
import LeadDetail from "./pages/LeadDetail";
import Conversation from "./pages/Conversation";
import Fields from "./pages/Fields";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Session restore: validate existing token on app load
    const token = localStorage.getItem("plcs_token");
    if (token) {
      api.me().then((res) => {
        if (res.company_id) {
          localStorage.setItem("plcs_company_id", res.company_id);
        }
      }).catch(() => {
        // 401/403 handled globally in apiClient — token cleared, redirected to /login
      });
    }
  }, []);

  // Global safety net: catch unhandled promise rejections to prevent blank-page crashes
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
          <Route element={<AppLayout />}>
            <Route path="/leads" element={<Leads />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/leads/:leadId" element={<LeadDetail />} />
            <Route path="/leads/:leadId/conversation" element={<Conversation />} />
            <Route path="/fields" element={<Fields />} />
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
