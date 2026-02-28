import { useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare, BarChart3, TrendingUp, CalendarDays, Settings, Users, LayoutDashboard,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: MessageSquare, label: "Conversations", path: "/copilot/conversations" },
  { icon: BarChart3, label: "Dashboard", path: "/copilot/dashboard" },
  { icon: TrendingUp, label: "Pipeline", path: "/copilot/pipeline" },
  { icon: CalendarDays, label: "Calendar", path: "/copilot/calendar" },
  { icon: Settings, label: "Settings", path: "/copilot/settings" },
  { icon: Users, label: "Team", path: "/copilot/team" },
];

const CopilotNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="w-[60px] shrink-0 bg-[hsl(0_0%_4%)] border-r border-border flex flex-col items-center py-4 gap-1">
      {/* Logo */}
      <button
        onClick={() => navigate("/copilot")}
        className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center mb-4"
      >
        <span className="text-primary-foreground font-bold text-sm">P</span>
      </button>

      {/* Nav Items */}
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            title={item.label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <item.icon size={18} />
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Switch to Dashboard */}
      <button
        onClick={() => navigate("/dashboard")}
        title="Switch to Dashboard"
        className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <LayoutDashboard size={18} />
      </button>
    </nav>
  );
};

export default CopilotNav;
