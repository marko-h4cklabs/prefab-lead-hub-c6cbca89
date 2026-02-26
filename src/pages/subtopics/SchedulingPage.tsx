import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SchedulingSettings from "@/components/settings/SchedulingSettings";

const SchedulingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="h-full p-6 overflow-auto">
      <button onClick={() => navigate(-1 as any)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
        <ArrowLeft size={14} /> Back
      </button>
      <h2 className="text-lg font-bold text-foreground mb-4">Scheduling & Booking</h2>
      <SchedulingSettings />
    </div>
  );
};

export default SchedulingPage;
