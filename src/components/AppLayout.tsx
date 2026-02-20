import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { api, requireCompanyId, clearAuth } from "@/lib/apiClient";
import { LayoutList, Bot, Settings, LogOut } from "lucide-react";

const navItems = [
  { to: "/leads", label: "Inbox", icon: LayoutList },
  { to: "/fields", label: "Chatbot", icon: Bot },
  { to: "/settings", label: "Settings", icon: Settings },
];

const AppLayout = () => {
  const [companyName, setCompanyName] = useState("");
  const navigate = useNavigate();

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

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-sidebar-foreground/50">
            Prefab Lead
          </div>
          <div className="font-bold text-sm text-sidebar-accent-foreground">
            Control System
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <button onClick={handleLogout} className="flex items-center gap-3 w-full rounded-sm px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors">
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
          <h2 className="text-sm font-semibold text-foreground">{companyName}</h2>
          <div className="font-mono text-xs text-muted-foreground">
            {new Date().toLocaleDateString()}
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
