import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MessageSquare, BarChart3, TrendingUp, CalendarDays, Settings, Users, LayoutDashboard,
} from "lucide-react";
import { api } from "@/lib/apiClient";

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  roles?: string[]; // if set, only show for these roles
}

const NAV_ITEMS: NavItem[] = [
  { icon: MessageSquare, label: "DMs", path: "/copilot/conversations" },
  { icon: BarChart3, label: "Dashboard", path: "/copilot/dashboard" },
  { icon: TrendingUp, label: "Pipeline", path: "/copilot/pipeline" },
  { icon: CalendarDays, label: "Calendar", path: "/copilot/calendar" },
  { icon: Settings, label: "Settings", path: "/copilot/settings", roles: ["owner", "admin"] },
  { icon: Users, label: "Team", path: "/copilot/team", roles: ["owner", "admin"] },
];

const CopilotNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [userRole, setUserRole] = useState<string>("owner");

  useEffect(() => {
    api.me().then((res: any) => {
      const role = res?.role || res?.user?.role || "owner";
      setUserRole(role);
    }).catch(() => {});
  }, []);

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  });

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
      {visibleItems.map((item) => {
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

      {/* Switch to Dashboard (owner/admin only) */}
      {["owner", "admin"].includes(userRole) && (
        <button
          onClick={() => navigate("/dashboard")}
          title="Switch to Dashboard"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LayoutDashboard size={18} />
        </button>
      )}
    </nav>
  );
};

export default CopilotNav;
