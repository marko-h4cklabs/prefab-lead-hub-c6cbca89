import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Pipeline from "@/pages/Pipeline";

const PipelinePage = () => {
  const navigate = useNavigate();
  return (
    <div className="h-full p-6 overflow-hidden">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-3">
        <ArrowLeft size={14} /> Back
      </button>
      <Pipeline />
    </div>
  );
};

export default PipelinePage;
