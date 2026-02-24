import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { CalendarDays, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GoogleStatus {
  connected: boolean;
  calendar_id?: string;
  upcoming_events_count?: number;
}

export default function GoogleCalendarSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [eventsModalOpen, setEventsModalOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const fetchStatus = () => {
    setLoading(true);
    api.getGoogleCalendarStatus()
      .then((res) => setStatus(res))
      .catch(() => setStatus({ connected: false }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Handle OAuth redirect callback
  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      toast({ title: "Google Calendar connected successfully! 🎉" });
      searchParams.delete("google");
      setSearchParams(searchParams, { replace: true });
      fetchStatus();
    }
  }, [searchParams, setSearchParams]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.getGoogleAuthUrl();
      const url = res?.auth_url || res?.url;
      if (url) {
        window.location.href = url;
      } else {
        toast({ title: "Could not get auth URL", variant: "destructive" });
      }
    } catch (err: unknown) {
      toast({ title: "Connection failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.disconnectGoogleCalendar();
      setStatus({ connected: false });
      setShowDisconnectDialog(false);
      toast({ title: "Google Calendar disconnected" });
    } catch (err: unknown) {
      toast({ title: "Disconnect failed", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleViewEvents = async () => {
    setEventsModalOpen(true);
    setEventsLoading(true);
    try {
      const res = await api.getGoogleUpcomingEvents();
      const list = Array.isArray(res) ? res : Array.isArray(res?.events) ? res.events : Array.isArray(res?.data) ? res.data : [];
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  return (
    <>
      <div className="mt-6 rounded-lg border border-border bg-card border-l-4 border-l-primary space-y-4 p-6">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-primary" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Google Calendar</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : status?.connected ? (
          /* Connected state */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span className="text-xs font-medium text-success">Connected</span>
            </div>

            {status.calendar_id && (
              <p className="text-xs text-muted-foreground">Calendar: {status.calendar_id}</p>
            )}
            {status.upcoming_events_count !== undefined && (
              <p className="text-xs text-muted-foreground">Upcoming events: {status.upcoming_events_count}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleViewEvents}
              >
                <CalendarDays size={12} /> View upcoming events
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-destructive hover:text-destructive gap-1.5"
                onClick={() => setShowDisconnectDialog(true)}
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          /* Not connected state */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Not connected</span>
            </div>

            <p className="text-sm text-muted-foreground">
              Connect your Google Calendar to automatically create events when calls are booked and check your availability in real time.
            </p>

            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-foreground text-background font-semibold py-3 px-4 hover:bg-foreground/90 transition-colors disabled:opacity-60"
            >
              {connecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <CalendarDays size={18} />
                  Connect Google Calendar
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing appointments to Google Calendar. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upcoming Events Modal */}
      <Dialog open={eventsModalOpen} onOpenChange={setEventsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
              <CalendarDays size={14} /> Upcoming Google Calendar Events
            </DialogTitle>
          </DialogHeader>
          {eventsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {events.map((ev: any, i: number) => {
                const start = ev.start?.dateTime || ev.start?.date || ev.start_at || "";
                const dt = start ? new Date(start) : null;
                return (
                  <div key={i} className="rounded-lg bg-secondary p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{ev.summary || ev.title || "Event"}</p>
                      {dt && (
                        <p className="text-xs text-muted-foreground">
                          {dt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                    {(ev.htmlLink || ev.link) && (
                      <a href={ev.htmlLink || ev.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0 ml-2">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming events in the next 7 days.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
