import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, Plus, Trash2, ChevronDown, Loader2 } from "lucide-react";
import CompanyInfoSection from "@/components/chatbot/CompanyInfoSection";
import ChatbotBehaviorSection from "@/components/chatbot/ChatbotBehaviorSection";
import QuoteFieldsSection from "@/components/chatbot/QuoteFieldsSection";

const Fields = () => {
  const [systemContext, setSystemContext] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);

  const loadSystemContext = () => {
    if (systemContext !== null) {
      setContextOpen(!contextOpen);
      return;
    }
    setContextLoading(true);
    api.getSystemContext()
      .then((res) => {
        setSystemContext(typeof res === "string" ? res : JSON.stringify(res, null, 2));
        setContextOpen(true);
      })
      .catch(() => setSystemContext("Failed to load system context."))
      .finally(() => setContextLoading(false));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">Chatbot</h1>

      <CompanyInfoSection />
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
        {contextOpen && systemContext && (
          <div className="px-6 pb-4">
            <pre className="overflow-auto max-h-64 rounded-sm bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
              {systemContext}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default Fields;
