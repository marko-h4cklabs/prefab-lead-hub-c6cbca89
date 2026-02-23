import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { ChevronDown, Loader2, CalendarCheck, Settings, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CompanyInfoSection from "@/components/chatbot/CompanyInfoSection";
import ChatbotBehaviorSection from "@/components/chatbot/ChatbotBehaviorSection";
import QuoteFieldsSection from "@/components/chatbot/QuoteFieldsSection";

const Fields = () => {
  const navigate = useNavigate();
  const [systemContext, setSystemContext] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<{ loaded: boolean; enabled: boolean; mode: string }>({ loaded: false, enabled: false, mode: "off" });

  useEffect(() => {
    api.getSchedulingSettings()
      .then((res) => {
        const cb = res?.chatbot_booking && typeof res.chatbot_booking === "object" ? res.chatbot_booking : res;
        setBookingStatus({ loaded: true, enabled: Boolean(cb?.chatbot_booking_enabled), mode: cb?.booking_mode || "off" });
      })
      .catch(() => setBookingStatus({ loaded: true, enabled: false, mode: "off" }));
  }, []);

  const fetchSystemContext = () => {
    setContextLoading(true);
    api.getSystemContext()
      .then((res) => {
        let ctx = "";
        if (typeof res === "string") ctx = res;
        else if (res && typeof res === "object") {
          const r = res as Record<string, unknown>;
          if (typeof r.systemContext === "string") ctx = r.systemContext;
          else if (typeof r.system_context === "string") ctx = r.system_context;
          else ctx = JSON.stringify(res, null, 2);
        }
        setSystemContext(ctx);
      })
      .catch(() => setSystemContext(""))
      .finally(() => setContextLoading(false));
  };

  const loadSystemContext = () => {
    if (systemContext !== null) {
      setContextOpen(!contextOpen);
      if (contextOpen) return;
    }
    setContextOpen(true);
    fetchSystemContext();
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">AI Agent</h1>

      {/* Booking Status */}
      <div className="dark-card px-5 py-3 flex items-center justify-between border-l-4 border-l-primary">
        <div className="flex items-center gap-2.5">
          <CalendarCheck size={14} className="text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Booking offers</span>
          {!bookingStatus.loaded ? (
            <Loader2 size={12} className="animate-spin text-muted-foreground" />
          ) : bookingStatus.enabled ? (
            <span className="status-badge bg-primary/15 text-primary text-[10px]">
              Enabled · {bookingStatus.mode === "direct_booking" ? "Direct" : "Manual request"}
            </span>
          ) : (
            <span className="status-badge bg-secondary text-muted-foreground text-[10px]">Disabled</span>
          )}
        </div>
        <button onClick={() => navigate("/settings")} className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors">
          <Settings size={10} /> Scheduling settings <ExternalLink size={8} />
        </button>
      </div>

      {/* Agent Identity */}
      <div className="dark-card border-l-4 border-l-primary">
        <CompanyInfoSection />
      </div>

      {/* Behavior Rules */}
      <div className="dark-card border-l-4 border-l-primary">
        <ChatbotBehaviorSection />
      </div>

      {/* Data Collection */}
      <div className="dark-card border-l-4 border-l-primary">
        <QuoteFieldsSection />
      </div>

      {/* System Context Preview */}
      <div className="dark-card">
        <button onClick={loadSystemContext} className="flex w-full items-center justify-between px-6 py-4 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
          System Context Preview
          {contextLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} className={`transition-transform ${contextOpen ? "rotate-180" : ""}`} />}
        </button>
        {contextOpen && (
          <div className="px-6 pb-4">
            {systemContext ? (
              <pre className="overflow-auto max-h-64 rounded-md bg-secondary p-4 text-xs font-mono whitespace-pre-wrap">{systemContext}</pre>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No context yet — fill Agent Identity / Behavior / Data Collection and Save.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Fields;
