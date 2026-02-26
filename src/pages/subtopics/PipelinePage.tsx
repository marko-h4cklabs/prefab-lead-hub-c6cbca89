import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Pipeline from "@/pages/Pipeline";

const PipelinePage = () => {
  const navigate = useNavigate();
  return (
    <div className="h-full p-6 overflow-hidden">
      <button onClick={() => navigate(-1 as any)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
        <ArrowLeft size={14} /> Back
      </button>
      <Pipeline />
    </div>
  );
};

export default PipelinePage;
