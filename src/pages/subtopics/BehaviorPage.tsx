import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CommunicationStyleSection from "@/components/chatbot/CommunicationStyleSection";
import ConversationStrategySection from "@/components/chatbot/ConversationStrategySection";
import GuardrailsSection from "@/components/chatbot/GuardrailsSection";
import BookingTriggerSection from "@/components/chatbot/BookingTriggerSection";

const BehaviorPage = () => {
  const navigate = useNavigate();
  const [previewKey, setPreviewKey] = useState(0);
  const refreshPreview = useCallback(() => setPreviewKey((k) => k + 1), []);

  return (
    <div className="h-full p-6 overflow-hidden flex flex-col">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-3 shrink-0">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <h2 className="text-lg font-bold text-foreground">Behavior & Strategy</h2>
          <div className="dark-card border-l-4 border-l-primary">
            <CommunicationStyleSection onDirty={() => {}} onSaved={refreshPreview} />
          </div>
          <div className="dark-card border-l-4 border-l-primary">
            <ConversationStrategySection onDirty={() => {}} onSaved={refreshPreview} />
          </div>
          <div className="dark-card border-l-4 border-l-primary">
            <BookingTriggerSection onDirty={() => {}} onSaved={refreshPreview} quoteFieldsVersion={0} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pl-2">
          <h2 className="text-lg font-bold text-foreground">Guardrails</h2>
          <div className="dark-card border-l-4 border-l-primary">
            <GuardrailsSection onDirty={() => {}} onSaved={refreshPreview} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BehaviorPage;
