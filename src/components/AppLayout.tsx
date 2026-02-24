import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { api, requireCompanyId, clearAuth } from "@/lib/apiClient";
import { LayoutList, FlaskConical, Bot, BarChart3, CalendarDays, Settings, LogOut, Columns3, Home, Users } from "lucide-react";
import NotificationsDropdown from "@/components/NotificationsDropdown";
import ImpersonationBanner from "@/components/admin/ImpersonationBanner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/leads", label: "Inbox", icon: LayoutList },
  { to: "/pipeline", label: "Pipeline", icon: Columns3 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/team", label: "Team", icon: Users },
  { to: "/fields", label: "AI Agent", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

const AppLayout = () => {
  const [companyName, setCompanyName] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const companyId = requireCompanyId();
    api.getCompany(companyId).then((c) => {
      setCompanyName(c.company_name || c.name || "Company");
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  // Check if current route is an inbox route (needs special layout)
  const isInboxRoute = location.pathname.startsWith("/leads");
  const isDashboardRoute = location.pathname === "/dashboard";

  return (
    <div className="flex min-h-screen w-full flex-col">
      <ImpersonationBanner />
      <div className="flex flex-1 min-h-0">
      {/* Zone 1 — Icon Rail */}
      <aside className="flex w-14 flex-col items-center bg-background border-r border-border shrink-0">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 w-full border-b border-border">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">P</span>
          </div>
        </div>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-1 py-3">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = to === "/leads"
              ? location.pathname.startsWith("/leads")
              : location.pathname === to || location.pathname.startsWith(to + "/");

            return (
              <Tooltip key={to} delayDuration={0}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={to}
                    className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Icon size={20} />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-card text-foreground border-border">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Bottom: notifications + user avatar + logout */}
        <div className="flex flex-col items-center gap-2 py-3 border-t border-border">
          <NotificationsDropdown />
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <LogOut size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-card text-foreground border-border">
              Logout
            </TooltipContent>
          </Tooltip>
          <div className="text-[9px] text-muted-foreground/40 font-mono">v1.0.0</div>
        </div>
      </aside>

      {/* Zones 2-4: Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — only show for non-inbox routes (inbox has its own header) */}
        {!isInboxRoute && !isDashboardRoute && (
          <header className="flex items-center justify-between border-b border-border bg-card px-6 h-14 shrink-0">
            <h2 className="text-sm font-semibold text-foreground">{companyName}</h2>
            <div className="text-xs text-muted-foreground font-mono">
              {new Date().toLocaleDateString()}
            </div>
          </header>
        )}
        <main className={`flex-1 ${isInboxRoute ? "" : isDashboardRoute ? "overflow-auto" : "p-6 overflow-auto"}`}>
          <Outlet />
        </main>
      </div>
      </div>
    </div>
  );
};

export default AppLayout;
