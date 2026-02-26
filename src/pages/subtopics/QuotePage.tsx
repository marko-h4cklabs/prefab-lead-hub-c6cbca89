import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import QuoteFieldsSection from "@/components/chatbot/QuoteFieldsSection";
import TemplatesSection from "@/components/chatbot/TemplatesSection";
import SocialProofSection from "@/components/chatbot/SocialProofSection";

const QuotePage = () => {
  const navigate = useNavigate();
  const [fieldsVersion, setFieldsVersion] = useState(0);
  const refreshFields = useCallback(() => setFieldsVersion((v) => v + 1), []);

  return (
    <div className="h-full p-6 overflow-hidden flex flex-col">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-3 shrink-0 self-start">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <h2 className="text-lg font-bold text-foreground">Lead Qualification</h2>
          <div className="dark-card border-l-4 border-l-primary">
            <QuoteFieldsSection onFieldsChanged={refreshFields} />
          </div>
        </div>
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
    </div>
  );
};

export default QuotePage;
