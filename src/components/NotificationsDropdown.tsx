import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { api } from "@/lib/apiClient";

interface HotLeadAlert {
  id: string;
  lead_id: string;
  lead_name?: string;
  intent_score?: number;
  trigger_reason?: string;
  created_at: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isAppointmentNotification(n: AppNotification): boolean {
  const t = (n.title || "").toLowerCase();
  const b = (n.body || "").toLowerCase();
  return t.includes("appointment") || t.includes("reminder") || t.includes("scheduling request") ||
    b.includes("appointment") || b.includes("scheduling") ||
    (n as any).type === "appointment_reminder" || (n as any).type === "scheduling_request";
}

const NotificationsDropdown = () => {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hotAlerts, setHotAlerts] = useState<HotLeadAlert[]>([]);
  const hotPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHotLeads = useCallback(async () => {
    try {
      const res = await api.getHotLeads();
      const alerts: HotLeadAlert[] = Array.isArray(res?.alerts) ? res.alerts : Array.isArray(res) ? res : [];
      setHotAlerts(alerts);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchHotLeads();
    hotPollRef.current = setInterval(fetchHotLeads, 60_000);
    return () => { if (hotPollRef.current) clearInterval(hotPollRef.current); };
  }, [fetchHotLeads]);

  const dismissAlert = async (alertId: string) => {
    try {
      await api.dismissHotLead(alertId);
      setHotAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch { /* silent */ }
  };

  const handleClick = async (n: AppNotification) => {
    if (!n.read) {
      await markRead(n.id);
    }
    const payload = n as any;
    if (payload.lead_id || payload.leadId) {
      navigate(`/leads/${payload.lead_id || payload.leadId}`);
    } else if (isAppointmentNotification(n)) {
      navigate("/calendar");
    } else if (n.url) {
      navigate(n.url);
    }
    setOpen(false);
  };

  const hasHotAlerts = hotAlerts.length > 0;
  const totalBadge = unreadCount + hotAlerts.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-sm hover:bg-muted transition-colors" aria-label="Notifications">
          <Bell size={18} className="text-muted-foreground" />
          {totalBadge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1">
              {totalBadge > 99 ? "99+" : totalBadge}
            </span>
          )}
          {hasHotAlerts && (
            <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive animate-pulse" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[420px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-accent hover:text-accent" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Hot Lead Alerts */}
          {hasHotAlerts && (
            <>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
                Hot Lead Alerts
              </div>
              {hotAlerts.map((alert) => (
                <div key={alert.id} className="px-4 py-3 border-b border-border bg-card border-l-[3px] border-l-primary">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                      🔥 Hot Lead
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{alert.lead_name || "Unknown"}</p>
                  {alert.intent_score !== undefined && (
                    <p className="text-xs text-muted-foreground">Score: {alert.intent_score}/100</p>
                  )}
                  {alert.trigger_reason && (
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.trigger_reason}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">{timeAgo(alert.created_at)}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => { navigate(`/leads/${alert.lead_id}`); setOpen(false); }}
                      className="text-xs font-semibold px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      View Lead
                    </button>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Regular Notifications */}
          {items.length === 0 && !hasHotAlerts ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            items.map((n) => {
              const isAppt = isAppointmentNotification(n);
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors ${!n.read ? "bg-accent/5" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                    <div className={`flex-1 ${n.read ? "pl-4" : ""}`}>
                      <div className="flex items-center gap-1.5">
                        {isAppt && <CalendarDays size={12} className="text-accent shrink-0" />}
                        <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>{n.title}</p>
                      </div>
                      {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {isAppt && <span className="text-[10px] font-mono text-accent">Appointment</span>}
                        <p className="text-[10px] text-muted-foreground font-mono">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsDropdown;
