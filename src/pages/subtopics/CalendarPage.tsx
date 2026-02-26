import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Calendar from "@/pages/Calendar";

const CalendarPage = () => {
  const navigate = useNavigate();
  return (
    <div className="h-full p-6 overflow-auto">
      <button onClick={() => navigate(-1 as any)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3">
        <ArrowLeft size={14} /> Back
      </button>
      <Calendar />
    </div>
  );
};

export default CalendarPage;
