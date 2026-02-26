import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import InboxLayout from "@/components/InboxLayout";

const InboxPage = () => {
  const navigate = useNavigate();
  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="px-4 pt-3 pb-1 shrink-0">
        <button onClick={() => navigate(-1 as any)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <InboxLayout />
      </div>
    </div>
  );
};

export default InboxPage;
