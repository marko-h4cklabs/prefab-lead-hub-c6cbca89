import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import {
  Loader2,
  CalendarDays,
  Clock,
  User,
  Mail,
  Video,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Link2,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CalendlyEvent {
  id: string;
  name: string;
  event_type: string;
  start_time: string;
  end_time: string;
  status: string;
  location: string;
  invitee_name: string;
  invitee_email: string;
  invitees: { name: string; email: string; status: string }[];
}

interface CalendlyStatus {
  connected: boolean;
  calendly_name?: string;
  calendly_email?: string;
  scheduling_url?: string;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getDuration = (start: string, end: string) => {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
};

const groupByDate = (events: CalendlyEvent[]) => {
  const groups: Record<string, CalendlyEvent[]> = {};
  for (const ev of events) {
    const dateKey = new Date(ev.start_time).toISOString().split("T")[0];
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(ev);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
};

const isToday = (dateKey: string) => {
  const today = new Date().toISOString().split("T")[0];
  return dateKey === today;
};

const isFuture = (dateKey: string) => {
  const today = new Date().toISOString().split("T")[0];
  return dateKey > today;
};

const CopilotCalendar = () => {
  const [status, setStatus] = useState<CalendlyStatus | null>(null);
  const [events, setEvents] = useState<CalendlyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "canceled">("all");
  const [weekOffset, setWeekOffset] = useState(0);

  // Setup state
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Check Calendly connection status
  useEffect(() => {
    api.getCalendlyStatus()
      .then((res) => {
        setStatus(res);
        if (res?.connected) fetchEvents();
      })
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  }, []);

  // Fetch events
  const fetchEvents = useCallback(
    async (offset = weekOffset) => {
      setEventsLoading(true);
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() + offset * 7 - 7);
        const end = new Date(now);
        end.setDate(end.getDate() + offset * 7 + 28);

        const res = await api.getCalendlyEvents({
          min_date: start.toISOString(),
          max_date: end.toISOString(),
          status: statusFilter === "all" ? undefined : statusFilter,
        });
        setEvents(Array.isArray(res?.events) ? res.events : []);
      } catch {
        toast({ title: "Failed to load Calendly events", variant: "destructive" });
      } finally {
        setEventsLoading(false);
      }
    },
    [weekOffset, statusFilter]
  );

  useEffect(() => {
    if (status?.connected) fetchEvents();
  }, [weekOffset, statusFilter]);

  // Save Calendly token
  const handleConnect = async () => {
    if (!apiToken.trim()) return;
    setSaving(true);
    try {
      const res = await api.saveCalendlyToken(apiToken.trim());
      setStatus({
        connected: true,
        calendly_name: res?.calendly_name,
        calendly_email: res?.calendly_email,
        scheduling_url: res?.scheduling_url,
      });
      setApiToken("");
      toast({ title: "Calendly connected successfully" });
      fetchEvents();
    } catch (err: any) {
      toast({
        title: "Failed to connect Calendly",
        description: err?.message || "Invalid API token",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    try {
      await api.disconnectCalendly();
      setStatus({ connected: false });
      setEvents([]);
      toast({ title: "Calendly disconnected" });
    } catch {
      toast({ title: "Failed to disconnect", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not connected — show setup screen
  if (!status?.connected) {
    return (
      <div className="h-full p-6 overflow-auto">
        <div className="max-w-lg mx-auto mt-12">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <CalendarDays size={28} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Connect Calendly</h2>
            <p className="text-sm text-muted-foreground">
              Connect your Calendly account to see all your booked calls here.
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-2">
                Calendly API Token
              </label>
              <p className="text-[11px] text-muted-foreground mb-3">
                Go to{" "}
                <a
                  href="https://calendly.com/integrations/api_webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Calendly Settings &rarr; API & Webhooks
                </a>{" "}
                and generate a Personal Access Token.
              </p>
              <div className="relative">
                <input
                  type={showToken ? "text" : "password"}
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="eyJraWQiOi..."
                  className="dark-input w-full pr-16"
                />
                <button
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded"
                  type="button"
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={!apiToken.trim() || saving}
              className="w-full dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-10 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin mx-auto" />
              ) : (
                "Connect Calendly"
              )}
            </button>
          </div>

          <div className="mt-6 p-4 rounded-xl bg-secondary/50 border border-border">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                Your token is encrypted and stored securely. It's only used to read your
                scheduled events — we never modify or create events on your behalf.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Connected — show calendar
  const grouped = groupByDate(events);
  const todayKey = new Date().toISOString().split("T")[0];
  const upcoming = events.filter(
    (e) => e.status === "active" && new Date(e.start_time) >= new Date()
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border bg-[hsl(0_0%_4%)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Calendar</h2>
            <p className="text-xs text-muted-foreground">
              Calendly &middot; {status.calendly_name || status.calendly_email || "Connected"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchEvents()}
              disabled={eventsLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary"
            >
              <RefreshCw size={12} className={eventsLoading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={handleDisconnect}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1.5 rounded-lg hover:bg-secondary"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Filters + Nav */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {(["all", "active", "canceled"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
                  statusFilter === f
                    ? "bg-primary/15 text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="shrink-0 px-6 py-3 border-b border-border bg-[hsl(0_0%_3%)] flex items-center gap-6">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{upcoming.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Upcoming</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {events.filter((e) => e.status === "active" && isToday(new Date(e.start_time).toISOString().split("T")[0])).length}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{events.length}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-destructive">
            {events.filter((e) => e.status === "canceled").length}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Canceled</p>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {eventsLoading && events.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {!eventsLoading && events.length === 0 && (
          <div className="text-center py-16">
            <CalendarDays size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No events found in this time range.</p>
          </div>
        )}

        {grouped.map(([dateKey, dayEvents]) => {
          const today = isToday(dateKey);
          const future = isFuture(dateKey);
          return (
            <div key={dateKey}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold ${
                    today
                      ? "bg-primary/15 text-primary"
                      : future
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <CalendarDays size={12} />
                  {today ? "Today" : formatDate(dateKey)}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
                </span>
                <div className="flex-1 border-t border-border" />
              </div>

              {/* Events */}
              <div className="space-y-2 ml-1">
                {dayEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      ev.status === "canceled"
                        ? "border-destructive/20 bg-destructive/5 opacity-60"
                        : today
                        ? "border-primary/20 bg-primary/5"
                        : "border-border bg-card hover:bg-card/80"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Event name + status */}
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {ev.event_type || ev.name}
                          </h4>
                          {ev.status === "canceled" ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-destructive/15 text-destructive">
                              <X size={8} /> Canceled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-success/15 text-success">
                              <Check size={8} /> Confirmed
                            </span>
                          )}
                        </div>

                        {/* Time + Duration */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatTime(ev.start_time)} - {formatTime(ev.end_time)}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary">
                            {getDuration(ev.start_time, ev.end_time)}
                          </span>
                        </div>

                        {/* Invitee */}
                        {ev.invitee_name && (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1 text-foreground">
                              <User size={11} className="text-muted-foreground" />
                              {ev.invitee_name}
                            </span>
                            {ev.invitee_email && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Mail size={11} />
                                {ev.invitee_email}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Location / meeting link */}
                      {ev.location && (
                        <a
                          href={ev.location}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/15 transition-colors"
                        >
                          <Video size={11} />
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CopilotCalendar;
