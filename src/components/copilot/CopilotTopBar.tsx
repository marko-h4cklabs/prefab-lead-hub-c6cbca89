import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Power,
  Shield,
  LayoutDashboard,
  ChevronDown,
  User,
  CheckCheck,
  Loader2,
  MessageSquare,
  Calendar,
  Flame,
  Zap,
  Bot,
  CreditCard,
  ArrowRightCircle,
} from "lucide-react";
import { api } from "@/lib/apiClient";

const str = (v: unknown): string =>
  v == null ? "" : typeof v === "object" ? "" : String(v);

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

interface CopilotTopBarProps {
  activeCount?: number;
  waitingCount?: number;
}

export default function CopilotTopBar({
  activeCount = 0,
  waitingCount = 0,
}: CopilotTopBarProps) {
  const navigate = useNavigate();

  // Kill switch state
  const [aiActive, setAiActive] = useState(true);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);
  const [isAdminOrOwner, setIsAdminOrOwner] = useState(false);
  const killConfirmRef = useRef<HTMLDivElement>(null);

  // Operating mode state
  const [operatingMode, setOperatingMode] = useState<string>("");
  const [modeLoading, setModeLoading] = useState(false);
  const [showModeWarning, setShowModeWarning] = useState(false);
  const modeWarningRef = useRef<HTMLDivElement>(null);

  // Notifications state
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // User state
  const [userName, setUserName] = useState("");
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  // Fetch kill switch status, operating mode & user info on mount
  useEffect(() => {
    api.getCopilotKillSwitch().then((res) => {
      setAiActive(res?.enabled ?? true);
    }).catch(() => {});

    api.getOperatingMode().then((res) => {
      setOperatingMode(res?.operating_mode || "");
    }).catch(() => {});

    api.getMe().then((res) => {
      const role = str(res?.role || res?.user?.role || "");
      setIsAdminOrOwner(
        role === "owner" || role === "admin" || role === "superadmin"
      );
      setUserName(
        str(res?.name || res?.user?.name || res?.email || res?.user?.email || "")
      );
    }).catch(() => {});
  }, []);

  // Fetch & poll unread count
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
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications for dropdown
  const fetchNotifications = useCallback(() => {
    setNotifLoading(true);
    api.getNotifications({ limit: 10 })
      .then((res) => {
        const list = normalizeList(res, ["data", "notifications", "items"]);
        setNotifications(list);
      })
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  // Switch to copilot mode
  const handleSwitchToCopilot = async () => {
    setModeLoading(true);
    setShowModeWarning(false);
    try {
      await api.setOperatingMode("copilot");
      setOperatingMode("copilot");
    } catch { /* best effort */ }
    setModeLoading(false);
  };

  // Kill switch toggle
  const handleKillSwitchToggle = () => {
    if (aiActive) {
      // Turning OFF -- show confirmation
      setShowKillConfirm(true);
    } else {
      // Turning ON -- immediate
      performKillSwitchToggle(true);
    }
  };

  const performKillSwitchToggle = async (enabled: boolean) => {
    setKillSwitchLoading(true);
    setShowKillConfirm(false);
    try {
      await api.setCopilotKillSwitch(enabled);
      setAiActive(enabled);
    } catch { /* best effort */ }
    setKillSwitchLoading(false);
  };

  // Notification handlers
  const handleBellClick = () => {
    if (!notifOpen) fetchNotifications();
    setNotifOpen((o) => !o);
    setUserOpen(false);
    setShowKillConfirm(false);
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
      if (
        killConfirmRef.current &&
        !killConfirmRef.current.contains(e.target as Node)
      ) {
        setShowKillConfirm(false);
      }
      if (
        modeWarningRef.current &&
        !modeWarningRef.current.contains(e.target as Node)
      ) {
        setShowModeWarning(false);
      }
    };
    if (notifOpen || userOpen || showKillConfirm || showModeWarning) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen, userOpen, showKillConfirm, showModeWarning]);

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[hsl(0_0%_13%)] bg-[hsl(0_0%_4%)] z-20">
      {/* LEFT -- Mode Warning + Kill Switch */}
      <div className="flex items-center gap-3">
        {/* Mode warning: show if NOT in copilot mode */}
        {isAdminOrOwner && operatingMode && operatingMode !== "copilot" && (
          <div className="relative" ref={modeWarningRef}>
            <button
              onClick={() => setShowModeWarning(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold bg-[hsl(24_95%_53%/0.15)] text-[hsl(24_95%_53%)] hover:bg-[hsl(24_95%_53%/0.25)] transition-colors"
            >
              <Zap size={14} />
              Autopilot Active
            </button>

            {showModeWarning && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_7%)] shadow-lg shadow-black/40 p-3 z-50">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} className="text-[hsl(24_95%_53%)]" />
                  <span className="text-xs font-bold text-foreground">
                    Wrong Mode
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Your account is in <strong className="text-foreground">Autopilot</strong> mode.
                  The AI is auto-sending replies instead of generating suggestions for review.
                  Switch to Co-Pilot mode to use this workspace.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowModeWarning(false)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_12%)] transition-all"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={handleSwitchToCopilot}
                    disabled={modeLoading}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all font-semibold disabled:opacity-50"
                  >
                    {modeLoading ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Switch to Co-Pilot"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {isAdminOrOwner && (
          <div className="relative" ref={killConfirmRef}>
            <button
              onClick={handleKillSwitchToggle}
              disabled={killSwitchLoading}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                aiActive
                  ? "bg-success/15 text-success hover:bg-success/25"
                  : "bg-destructive/15 text-destructive hover:bg-destructive/25"
              }`}
            >
              {killSwitchLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Power size={14} />
              )}
              {aiActive ? "AI Active" : "AI Paused"}
            </button>

            {/* Confirmation dialog for turning OFF */}
            {showKillConfirm && (
              <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_7%)] shadow-lg shadow-black/40 p-3 z-50">
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={14} className="text-destructive" />
                  <span className="text-xs font-bold text-foreground">
                    Pause AI?
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  This will stop the AI from sending any automated responses
                  across all conversations.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowKillConfirm(false)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_12%)] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => performKillSwitchToggle(false)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all font-semibold"
                  >
                    Pause AI
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CENTER -- Active DMs count */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
        {activeCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            {activeCount} conversation{activeCount !== 1 ? "s" : ""}
          </span>
        )}
        {waitingCount > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-[hsl(48_92%_53%/0.12)] px-2.5 py-0.5 text-xs font-semibold text-[hsl(48_92%_53%)]">
            {waitingCount} waiting
          </span>
        )}
        {activeCount === 0 && waitingCount === 0 && (
          <span className="text-xs text-muted-foreground/60">
            No active conversations
          </span>
        )}
      </div>

      {/* RIGHT -- Bell, User, Dashboard link */}
      <div className="flex items-center gap-2">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleBellClick}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_5%)] shadow-xl shadow-black/50 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(0_0%_13%)]">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Notifications
                </span>
                {notifications.some((n) => !n.is_read) && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingAllRead}
                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {markingAllRead ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <CheckCheck size={10} />
                    )}
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto">
                {notifLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2
                      size={16}
                      className="animate-spin text-muted-foreground"
                    />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell
                      size={20}
                      className="mx-auto text-muted-foreground/40 mb-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      No notifications yet
                    </p>
                  </div>
                ) : (
                  notifications.map((notif) => {
                    const Icon = NOTIF_ICONS[notif.type] || Bell;
                    const color =
                      NOTIF_COLORS[notif.type] || "text-muted-foreground";
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
                            <span
                              className={`text-xs font-medium truncate ${
                                !notif.is_read
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {str(notif.title)}
                            </span>
                            {!notif.is_read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(48_92%_53%)] shrink-0" />
                            )}
                          </div>
                          {str(notif.body) && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {str(notif.body)}
                            </p>
                          )}
                          {str(notif.created_at) && (
                            <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                              {timeAgo(notif.created_at)}
                            </span>
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

        {/* User avatar / name */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => {
              setUserOpen((o) => !o);
              setNotifOpen(false);
              setShowKillConfirm(false);
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <User size={13} className="text-primary" />
            </div>
            {userName && (
              <span className="text-xs font-medium max-w-[100px] truncate hidden sm:block">
                {userName}
              </span>
            )}
            <ChevronDown size={12} />
          </button>

          {userOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[hsl(0_0%_16%)] bg-[hsl(0_0%_5%)] shadow-xl shadow-black/50 z-50 overflow-hidden">
              {userName && (
                <div className="px-4 py-3 border-b border-[hsl(0_0%_13%)]">
                  <p className="text-xs font-medium text-foreground truncate">
                    {userName}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setUserOpen(false);
                  navigate("/dashboard");
                }}
                className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_8%)] transition-colors"
              >
                <LayoutDashboard size={14} />
                Switch to Dashboard
              </button>
            </div>
          )}
        </div>

        {/* Dashboard link (always visible) */}
        <button
          onClick={() => navigate("/dashboard")}
          title="Switch to Dashboard"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LayoutDashboard size={18} />
        </button>
      </div>
    </header>
  );
}
