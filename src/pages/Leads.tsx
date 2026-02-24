import { LayoutList, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Leads = () => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center">
          <LayoutList size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">No leads yet</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Once you connect ManyChat and your Instagram DMs start flowing in, leads will appear here automatically.
        </p>
        <button onClick={() => navigate("/settings")} className="dark-btn-primary text-sm mt-2">
          <MessageSquare size={14} /> Connect ManyChat →
        </button>
      </div>
    </div>
  );
};

export default Leads;
