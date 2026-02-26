import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, Settings, LogOut, CheckCheck, Loader2, User, MessageSquare, Calendar, Flame, Zap, Bot, CreditCard, ArrowRightCircle } from "lucide-react";
import { api, requireCompanyId, clearAuth } from "@/lib/apiClient";
import { motion } from "framer-motion";

const str = (v: unknown): string => (v == null ? "" : typeof v === "object" ? "" : String(v));

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  url?: string;
  is_read: boolean;
  created_at: string;
  lead_id?: string;
}

const NOTIF_ICONS: Record<string, React.ElementType> = {
  new_lead: User,
  new_message: MessageSquare,
  appointment: Calendar,
  appointment_created: Calendar,
  booking_confirmed: Calendar,
  deal_logged: CreditCard,
  scheduling_request: Calendar,
  hot_lead: Flame,
  autoresponder: Bot,
  status_change: ArrowRightCircle,
  budget_detected: Zap,
};

const NOTIF_COLORS: Record<string, string> = {
  new_lead: "text-[hsl(48_92%_53%)]",
  new_message: "text-blue-400",
  appointment: "text-purple-400",
  appointment_created: "text-purple-400",
  booking_confirmed: "text-green-400",
  deal_logged: "text-green-400",
  scheduling_request: "text-orange-400",
  hot_lead: "text-red-400",
  autoresponder: "text-teal-400",
  status_change: "text-blue-400",
  budget_detected: "text-[hsl(48_92%_53%)]",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
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
  const [revenueRange, setRevenueRange] = useState<"1D" | "1W" | "1M" | "1Y">("1M");
  const [revenueDropdownOpen, setRevenueDropdownOpen] = useState(false);
  const revenueRef = useRef<HTMLDivElement>(null);
  const [operatingMode, setOperatingMode] = useState<string | null>(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const logoutRef = useRef<HTMLDivElement>(null);

  // Notification panel state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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
      calendar: "Calendar", identity: "Database", behavior: "Behavior & Strategy",
      quote: "Lead Qualification", test: "Test Chat", integrations: "Integrations",
      analytics: "Analytics", account: "Account & Billing",
    };
    return labels[last] || last;
  };

  const fetchUnreadCount = useCallback(() => {
    api.getUnreadCount().then((res) => {
      setUnreadCount(res?.count ?? res?.unread_count ?? res?.total ?? 0);
    }).catch(() => {
      api.getNotifications({ limit: 1 }).then((res) => {
        setUnreadCount(res?.unread_count ?? res?.total ?? 0);
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    api.getCompany(companyId).then((c) => setCompanyName(str(c.company_name) || str(c.name) || "")).catch(() => {});

    fetchUnreadCount();

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

    api.getDealStats({ range: revenueRange }).then((res) => {
      setRevenue(res?.total_revenue ?? res?.revenue_this_month ?? 0);
    }).catch(() => {});

    api.getOperatingMode().then((res) => {
      setOperatingMode(str(res?.operating_mode) || str(res?.mode) || null);
    }).catch(() => {});

    // Poll unread count every 30s
    const pollInterval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(pollInterval);
  }, [companyId, fetchUnreadCount, revenueRange]);

  const fetchNotifications = useCallback(() => {
    setNotifLoading(true);
    api.getNotifications({ limit: 20 })
      .then((res) => {
        const list = normalizeList(res, ["data", "notifications", "items"]);
        setNotifications(list);
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  const handleBellClick = () => {
    if (!notifOpen) {
      fetchNotifications();
    }
    setNotifOpen((o) => !o);
    setLogoutOpen(false);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* best effort */ }
  };

  const handleMarkAllRead = async () => {
    setMarkingAllRead(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* best effort */ }
    setMarkingAllRead(false);
  };

  const handleNotifClick = (notif: Notification) => {
    if (!notif.is_read) handleMarkRead(notif.id);
    setNotifOpen(false);
    if (notif.url) {
      navigate(notif.url);
    } else if (notif.lead_id) {
      navigate(`/dashboard/leads/inbox/${notif.lead_id}`);
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (logoutRef.current && !logoutRef.current.contains(e.target as Node)) {
        setLogoutOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (revenueRef.current && !revenueRef.current.contains(e.target as Node)) {
        setRevenueDropdownOpen(false);
      }
    };
    if (logoutOpen || notifOpen || revenueDropdownOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [logoutOpen, notifOpen, revenueDropdownOpen]);

  const modeIsAutopilot = operatingMode === "autopilot";
  const modeIsCopilot = operatingMode === "copilot";

  return (
    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[hsl(0_0%_13%)] bg-[hsl(0_0%_0%)] z-20">
      {/* LEFT */}
      <div className="flex items-center gap-3">
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleBellClick}
            className="relative flex items-center justify-center w-8 h-8 text-muted-foreground hover:text-foreground transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_5%)] shadow-xl shadow-black/50 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0_0%_13%)]">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Notifications</span>
                {notifications.some((n) => !n.is_read) && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead}
                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {markingAllRead ? <Loader2 size={10} className="animate-spin" /> : <CheckCheck size={10} />}
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell size={20} className="mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const Icon = NOTIF_ICONS[notif.type] || Bell;
                    const color = NOTIF_COLORS[notif.type] || "text-muted-foreground";
                    return (
                      <button
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[hsl(0_0%_8%)] transition-colors border-b border-[hsl(0_0%_10%)] last:border-b-0 ${
                          !notif.is_read ? "bg-[hsl(48_92%_53%/0.03)]" : ""
                        }`}
                      >
                        <div className={`mt-0.5 shrink-0 ${color}`}>
                          <Icon size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium truncate ${!notif.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                              {str(notif.title)}
                            </span>
                            {!notif.is_read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(48_92%_53%)] shrink-0" />
                            )}
                          </div>
                          {str(notif.body) && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{str(notif.body)}</p>
                          )}
                          {str(notif.created_at) && (
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">{timeAgo(notif.created_at)}</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

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
        <div className="relative" ref={revenueRef}>
          <button
            onClick={() => { setRevenueDropdownOpen((o) => !o); setLogoutOpen(false); setNotifOpen(false); }}
            className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors"
          >
            €{Number(revenue).toLocaleString()} Revenue
            <span className="text-[10px] opacity-70 ml-0.5">{revenueRange}</span>
          </button>
          {revenueDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-32 rounded-xl border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_5%)] shadow-xl shadow-black/50 z-50 overflow-hidden">
              {(["1D", "1W", "1M", "1Y"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => { setRevenueRange(range); setRevenueDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                    revenueRange === range
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_8%)]"
                  }`}
                >
                  {{ "1D": "Today", "1W": "This Week", "1M": "This Month", "1Y": "This Year" }[range]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onSettingsClick || (() => navigate("/dashboard/settings"))}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
        >
          <Settings size={18} />
        </button>
        <div className="relative" ref={logoutRef}>
          <button
            onClick={() => { setLogoutOpen((o) => !o); setNotifOpen(false); }}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            <LogOut size={18} />
          </button>
          {logoutOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_7%)] shadow-lg shadow-black/40 p-3 z-50">
              <p className="text-xs text-muted-foreground mb-3">Do you want to sign out?</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogoutOpen(false)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_12%)] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all font-semibold"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
