import { useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { ChevronDown, Loader2 } from "lucide-react";
import CompanyInfoSection from "@/components/chatbot/CompanyInfoSection";
import ChatbotBehaviorSection from "@/components/chatbot/ChatbotBehaviorSection";
import QuoteFieldsSection from "@/components/chatbot/QuoteFieldsSection";

const Fields = () => {
  const [systemContext, setSystemContext] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);

  const fetchSystemContext = () => {
    setContextLoading(true);
    api.getSystemContext()
      .then((res) => {
        let ctx = "";
        if (typeof res === "string") {
          ctx = res;
        } else if (res && typeof res === "object") {
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

  const handleScrapeComplete = useCallback(() => {
    fetchSystemContext();
  }, []);

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
      <h1 className="text-xl font-bold">Chatbot</h1>

      <CompanyInfoSection onScrapeComplete={handleScrapeComplete} />
      <ChatbotBehaviorSection />
      <QuoteFieldsSection />

      {/* System Context Preview */}
      <div className="industrial-card">
        <button
          onClick={loadSystemContext}
          className="flex w-full items-center justify-between px-6 py-4 text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          System Context Preview
          {contextLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ChevronDown size={14} className={`transition-transform ${contextOpen ? "rotate-180" : ""}`} />
          )}
        </button>
        {contextOpen && (
          <div className="px-6 pb-4">
            {systemContext ? (
              <pre className="overflow-auto max-h-64 rounded-sm bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
                {systemContext}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                No context yet — fill Company info / Behavior / Quote requirements and Save.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Fields;
