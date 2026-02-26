import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AdvancedFollowUpSection from "@/components/followups/AdvancedFollowUpSection";

const FollowUpPage = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full p-6 overflow-hidden flex flex-col">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-3 shrink-0 self-start">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="flex-1 overflow-y-auto">
        <h2 className="text-lg font-bold text-foreground mb-4">Advanced Follow-up</h2>
        <div className="dark-card border-l-4 border-l-primary">
          <AdvancedFollowUpSection />
        </div>
      </div>
    </div>
  );
};

export default FollowUpPage;
