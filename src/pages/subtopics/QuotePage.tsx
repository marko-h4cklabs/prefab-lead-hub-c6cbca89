import { useCallback, useState } from "react";
import QuoteFieldsSection from "@/components/chatbot/QuoteFieldsSection";
import TemplatesSection from "@/components/chatbot/TemplatesSection";
import SocialProofSection from "@/components/chatbot/SocialProofSection";

const QuotePage = () => {
  const [fieldsVersion, setFieldsVersion] = useState(0);
  const refreshFields = useCallback(() => setFieldsVersion((v) => v + 1), []);

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* LEFT — Quote fields */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <h2 className="text-lg font-bold text-foreground">Quote Builder</h2>
        <div className="dark-card border-l-4 border-l-primary">
          <QuoteFieldsSection onFieldsChanged={refreshFields} />
        </div>
      </div>

      {/* RIGHT — Presets + Social proof */}
      <div className="flex-1 overflow-y-auto space-y-4 pl-2">
        <h2 className="text-lg font-bold text-foreground">Templates & Social Proof</h2>
        <div className="dark-card border-l-4 border-l-primary">
          <TemplatesSection />
        </div>
        <div className="dark-card border-l-4 border-l-primary">
          <SocialProofSection onDirty={() => {}} onSaved={() => {}} />
        </div>
      </div>
    </div>
  );
};

export default QuotePage;
