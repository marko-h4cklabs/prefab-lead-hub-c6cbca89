import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Mail, Settings, LogOut } from "lucide-react";
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
  const [todayLeadCount, setTodayLeadCount] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [operatingMode, setOperatingMode] = useState<string | null>(null);

  // Determine hierarchy
  const path = location.pathname;
  const isMainHub = path === "/dashboard";
  const isSection = ["/dashboard/leads", "/dashboard/agent", "/dashboard/settings"].includes(path);
  const isSubTopic = !isMainHub && !isSection && path.startsWith("/dashboard/");

  const sectionTitle = path.startsWith("/dashboard/leads") ? "LEADS & CRM"
    : path.startsWith("/dashboard/agent") ? "AI AGENT"
    : path.startsWith("/dashboard/settings") ? "SETTINGS & TOOLS"
    : "";

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

    // Real unread message count
    api.getUnreadCount().then((res) => {
      setUnreadCount(res?.count ?? res?.unread_count ?? res?.total ?? 0);
    }).catch(() => {
      // Fallback to notifications endpoint
      api.getNotifications({ limit: 1 }).then((res) => {
        setUnreadCount(res?.unread_count ?? res?.total ?? 0);
      }).catch(() => {});
    });

    // Leads created in last 24h
    api.getLeads(companyId, { limit: 200 }).then((res) => {
      const leads = normalizeList(res, ["leads", "data", "items"]);
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const todayCount = leads.filter((l: any) => {
        const created = new Date(l.created_at || l.createdAt || 0).getTime();
        return created >= cutoff;
      }).length;
      setTodayLeadCount(todayCount);
    }).catch(() => {});

    api.getDealStats().then((res) => {
      setRevenue(res?.total_revenue ?? res?.revenue_this_month ?? 0);
    }).catch(() => {});

    api.getOperatingMode().then((res) => {
      setOperatingMode(res?.operating_mode || res?.mode || null);
    }).catch(() => {});
  }, [companyId]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const modeIsAutopilot = operatingMode === "autopilot";
  const modeIsCopilot = operatingMode === "copilot";

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[hsl(0_0%_13%)] bg-[hsl(0_0%_0%)] z-20">
      {/* LEFT */}
      <div className="flex items-center gap-3">
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
          onClick={() => navigate("/dashboard/leads/inbox")}
          className="flex items-center gap-1.5 rounded-full bg-[hsl(24_95%_53%/0.15)] px-3 py-1 text-xs font-semibold text-[hsl(24_95%_53%)] hover:bg-[hsl(24_95%_53%/0.25)] transition-colors"
        >
          Leads today 🔥
          <motion.span
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="font-bold"
          >
            {todayLeadCount}
          </motion.span>
        </button>
      </div>

      {/* CENTER */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
        {isSubTopic && sectionTitle && (
          <span className="text-xs text-muted-foreground">{sectionTitle} ›</span>
        )}
        <h1 className="text-sm font-bold text-foreground uppercase tracking-wider">
          {isMainHub ? companyName : isSection ? sectionTitle : getBreadcrumb()}
        </h1>
        {isMainHub && operatingMode && (
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            modeIsAutopilot
              ? "bg-[hsl(142_71%_45%/0.15)] text-[hsl(142_71%_45%)]"
              : modeIsCopilot
              ? "bg-[hsl(217_91%_60%/0.15)] text-[hsl(217_91%_60%)]"
              : "bg-secondary text-muted-foreground"
          }`}>
            {modeIsAutopilot ? "🤖 Autopilot" : modeIsCopilot ? "🧠 Copilot" : operatingMode}
          </span>
        )}
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
