import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { CalendarPlus, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import AppointmentModal, { AppointmentFormData } from "@/components/appointments/AppointmentModal";
import { addDays, format, startOfDay } from "date-fns";

const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  site_visit: "Site Visit",
  meeting: "Meeting",
  follow_up: "Follow-up",
};

const STATUS_CLASSES: Record<string, string> = {
  scheduled: "status-new",
  completed: "status-qualified",
  cancelled: "status-disqualified",
  no_show: "status-pending",
};

const RANGE_OPTIONS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

const SOURCE_OPTIONS = ["all", "manual", "chatbot"];
const STATUS_OPTIONS = ["all", "scheduled", "completed", "cancelled", "no_show"];
const TYPE_OPTIONS = ["all", "call", "site_visit", "meeting", "follow_up"];

const Calendar = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(30);
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<AppointmentFormData | null>(null);

  const fetchAppointments = useCallback(() => {
    setLoading(true);
    const from = format(startOfDay(new Date()), "yyyy-MM-dd");
    const to = rangeDays > 0 ? format(addDays(new Date(), rangeDays), "yyyy-MM-dd") : from;

    api.getAppointments({ from, to, status, type, source })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || res?.appointments || res?.items || []);
        setAppointments(list);
      })
      .catch((err) => {
        toast({ title: "Failed to load appointments", description: getErrorMessage(err), variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [rangeDays, source, status, type]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments;
    const q = searchQuery.toLowerCase();
    return appointments.filter((a) =>
      (a.title || "").toLowerCase().includes(q) ||
      (a.lead?.name || "").toLowerCase().includes(q)
    );
  }, [appointments, searchQuery]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredAppointments.forEach((a) => {
      const day = a.date ? a.date.slice(0, 10) : "Unknown";
      if (!groups[day]) groups[day] = [];
      groups[day].push(a);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredAppointments]);

  const handleEdit = (appt: any) => {
    setEditingAppt({
      id: appt.id,
      lead_id: appt.lead_id || "",
      lead_name: appt.lead?.name || appt.lead_name || "",
      title: appt.title || "",
      type: appt.type || "call",
      date: appt.date ? appt.date.slice(0, 10) : "",
      start_time: appt.start_time || "",
      duration_minutes: appt.duration_minutes || 30,
      timezone: appt.timezone || "Europe/Zagreb",
      reminder: appt.reminder || "",
      notes: appt.notes || "",
      status: appt.status || "scheduled",
    });
    setModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-xl font-bold">Calendar</h1>
          <p className="text-sm text-muted-foreground">Manage appointments and scheduled activities</p>
        </div>
        <Button className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { setEditingAppt(null); setModalOpen(true); }}>
          <CalendarPlus size={16} />
          New Appointment
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 my-4">
        {/* Range */}
        <div className="flex rounded-sm border border-border overflow-hidden">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${rangeDays === r.days ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted/50"}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select className="industrial-input py-1.5 text-xs" value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s === "all" ? "All Sources" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>

        <select className="industrial-input py-1.5 text-xs" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "all" ? "All Statuses" : s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}</option>)}
        </select>

        <select className="industrial-input py-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t === "all" ? "All Types" : TYPE_LABELS[t] || t}</option>)}
        </select>

        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="pl-8 h-8 text-xs w-40"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="industrial-card p-4">
              <div className="h-4 w-32 bg-muted animate-pulse rounded-sm mb-3" />
              <div className="h-16 bg-muted animate-pulse rounded-sm" />
            </div>
          ))}
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="industrial-card p-12 text-center">
          <p className="text-muted-foreground text-sm">No appointments in this range</p>
          <Button variant="outline" className="mt-4 gap-1.5" onClick={() => { setEditingAppt(null); setModalOpen(true); }}>
            <CalendarPlus size={14} /> Create your first appointment
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, appts]) => (
            <div key={day}>
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {day !== "Unknown" ? format(new Date(day + "T00:00:00"), "EEEE, MMM d, yyyy") : "Unscheduled"}
              </h3>
              <div className="space-y-1.5">
                {appts.map((appt: any) => (
                  <button
                    key={appt.id}
                    onClick={() => handleEdit(appt)}
                    className="w-full text-left industrial-card p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-12 shrink-0">
                          {appt.start_time || "—"}
                        </span>
                        <span className="text-sm font-medium truncate">{appt.title}</span>
                        {appt.lead?.name && (
                          <span className="text-xs text-muted-foreground truncate">• {appt.lead.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {appt.lead?.channel && (
                          <span className="status-badge bg-muted text-muted-foreground">{appt.lead.channel}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{TYPE_LABELS[appt.type] || appt.type}</span>
                        <span className={`text-xs ${STATUS_CLASSES[appt.status] || "status-pending"}`}>
                          {appt.status?.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    {appt.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 ml-[60px] truncate">{appt.notes}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAppt(null); }}
        onSaved={fetchAppointments}
        existing={editingAppt}
      />
    </div>
  );
};

export default Calendar;
