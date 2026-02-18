import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AppLayout from "./components/AppLayout";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Conversation from "./pages/Conversation";
import Fields from "./pages/Fields";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/leads" replace />} />
          <Route element={<AppLayout />}>
            <Route path="/leads" element={<Leads />} />
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
);

export default App;
