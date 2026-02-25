import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Settings, ArrowLeft, LogOut } from "lucide-react";
import { api, requireCompanyId, clearAuth } from "@/lib/apiClient";
import { motion } from "framer-motion";

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

interface TopBarProps {
  onSettingsClick?: () => void;
}

export default function TopBar({ onSettingsClick }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const companyId = requireCompanyId();
  const [companyName, setCompanyName] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [revenue, setRevenue] = useState(0);

  // Determine hierarchy
  const path = location.pathname;
  const isMainHub = path === "/dashboard";
  const isSection = ["/dashboard/leads", "/dashboard/agent", "/dashboard/settings"].includes(path);
  const isSubTopic = !isMainHub && !isSection && path.startsWith("/dashboard/");

  const sectionTitle = path.startsWith("/dashboard/leads") ? "LEADS & CRM"
    : path.startsWith("/dashboard/agent") ? "AI AGENT"
    : path.startsWith("/dashboard/settings") ? "SETTINGS & TOOLS"
    : "";

  const getBackPath = () => {
    if (isSubTopic) {
      const parts = path.split("/");
      return parts.slice(0, 3).join("/");
    }
    return "/dashboard";
  };

  const getBreadcrumb = () => {
    if (!isSubTopic) return null;
    const last = path.split("/").pop() || "";
    const labels: Record<string, string> = {
      board: "Lead Board", inbox: "Inbox", pipeline: "Pipeline & Deals",
      calendar: "Calendar", identity: "Identity & Persona", behavior: "Behavior & Strategy",
      quote: "Quote Builder", test: "Test Chat", integrations: "Integrations",
      scheduling: "Scheduling", analytics: "Analytics", account: "Account & Billing",
    };
    return labels[last] || last;
  };

  useEffect(() => {
    api.getCompany(companyId).then((c) => setCompanyName(c.company_name || c.name || "")).catch(() => {});
    api.getNotifications({ limit: 1 }).then((res) => {
      const total = res?.unread_count ?? res?.total ?? 0;
      setUnreadCount(total);
    }).catch(() => {});
    api.getLeads(companyId, { limit: 1 }).then((res) => {
      const total = res?.total ?? res?.count ?? normalizeList(res, ["leads", "data"]).length;
      setNewLeadCount(total);
    }).catch(() => {});
    api.getDealStats().then((res) => {
      setRevenue(res?.total_revenue ?? res?.revenue_this_month ?? 0);
    }).catch(() => {});
  }, [companyId]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[hsl(0_0%_13%)] bg-[hsl(0_0%_0%)] z-20">
      {/* LEFT */}
      <div className="flex items-center gap-3">
        {(!isMainHub) && (
          <button
            onClick={() => navigate(getBackPath())}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <button
          onClick={() => navigate("/dashboard/leads/inbox")}
          className="relative flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Mail size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => navigate("/dashboard/leads/board")}
          className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors"
        >
          New Leads
          <motion.span
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="font-bold"
          >
            {newLeadCount}
          </motion.span>
        </button>
      </div>

      {/* CENTER */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        {isSubTopic && sectionTitle && (
          <span className="text-xs text-muted-foreground">{sectionTitle} ›</span>
        )}
        <h1 className="text-sm font-bold text-foreground uppercase tracking-wider">
          {isMainHub ? companyName : isSection ? sectionTitle : getBreadcrumb()}
        </h1>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          €{Number(revenue).toLocaleString()} Revenue
        </span>
        <button
          onClick={onSettingsClick || (() => navigate("/dashboard/settings"))}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
        >
          <Settings size={18} />
        </button>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
