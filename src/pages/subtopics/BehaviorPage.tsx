import { useCallback, useState } from "react";
import CommunicationStyleSection from "@/components/chatbot/CommunicationStyleSection";
import ConversationStrategySection from "@/components/chatbot/ConversationStrategySection";
import GuardrailsSection from "@/components/chatbot/GuardrailsSection";
import BookingTriggerSection from "@/components/chatbot/BookingTriggerSection";

const BehaviorPage = () => {
  const [previewKey, setPreviewKey] = useState(0);
  const refreshPreview = useCallback(() => setPreviewKey((k) => k + 1), []);

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* LEFT — Behavior settings */}
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

      {/* RIGHT — Guardrails */}
      <div className="flex-1 overflow-y-auto space-y-4 pl-2">
        <h2 className="text-lg font-bold text-foreground">Guardrails</h2>
        <div className="dark-card border-l-4 border-l-primary">
          <GuardrailsSection onDirty={() => {}} onSaved={refreshPreview} />
        </div>
      </div>
    </div>
  );
};

export default BehaviorPage;
