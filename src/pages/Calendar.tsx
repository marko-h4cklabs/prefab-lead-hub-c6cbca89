import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/apiClient";
import { CalendarPlus, Loader2, Search, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import AppointmentModal, { AppointmentFormData } from "@/components/appointments/AppointmentModal";
import AppointmentDetailDrawer from "@/components/appointments/AppointmentDetailDrawer";
import UpcomingPanel from "@/components/appointments/UpcomingPanel";
import CalendarSchedulingRequests from "@/components/scheduling/CalendarSchedulingRequests";
import { NormalizedSchedulingRequest, REQUEST_TYPE_LABELS } from "@/lib/schedulingRequestUtils";
import FollowUpQueue from "@/components/calendar/FollowUpQueue";
import {
  normalizeAppointmentList,
  NormalizedAppointment,
  appointmentToFormData,
  TYPE_LABELS,
  STATUS_CLASSES,
  STATUS_LABELS,
  SOURCE_LABELS,
  formatAppointmentTime,
  extractDate,
} from "@/lib/appointmentUtils";
import { addDays, format, startOfDay } from "date-fns";

const RANGE_OPTIONS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const SOURCE_OPTIONS = ["all", "manual", "chatbot", "inbox", "simulation"];
const STATUS_OPTIONS = ["all", "scheduled", "completed", "cancelled", "no_show"];
const TYPE_OPTIONS = ["all", "call", "site_visit", "meeting", "follow_up"];

const CALENDAR_TABS = ["Appointments", "Scheduling Requests", "Follow-ups"] as const;
type CalendarTab = (typeof CALENDAR_TABS)[number];

const Calendar = () => {
  const [calendarTab, setCalendarTab] = useState<CalendarTab>("Appointments");
  const [appointments, setAppointments] = useState<NormalizedAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeDays, setRangeDays] = useState(30);
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<AppointmentFormData | null>(null);
  const [detailAppt, setDetailAppt] = useState<NormalizedAppointment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [schedulingRequestPrefill, setSchedulingRequestPrefill] = useState<Partial<AppointmentFormData> | null>(null);
  const [convertingReqId, setConvertingReqId] = useState<string | null>(null);
  const [schedulingRequestInfo, setSchedulingRequestInfo] = useState<string | undefined>(undefined);

  const fetchAppointments = useCallback(() => {
    setLoading(true);
    setError(null);
    const from = format(startOfDay(new Date()), "yyyy-MM-dd");
    const to = rangeDays > 0 ? format(addDays(new Date(), rangeDays), "yyyy-MM-dd") : from;

    api.getAppointments({ from, to, status, type, source })
      .then((res) => {
        setAppointments(normalizeAppointmentList(res));
      })
      .catch((err) => {
        setError(getErrorMessage(err));
        toast({ title: "Failed to load appointments", description: getErrorMessage(err), variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [rangeDays, source, status, type]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const filteredAppointments = useMemo(() => {
    if (!searchQuery.trim()) return appointments;
    const q = searchQuery.toLowerCase();
    return appointments.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      (a.lead?.name || "").toLowerCase().includes(q) ||
      (a.lead?.channel || "").toLowerCase().includes(q)
    );
  }, [appointments, searchQuery]);

  // Group by date
  const grouped = useMemo(() => {
    const sorted = [...filteredAppointments].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    const groups: Record<string, NormalizedAppointment[]> = {};
    sorted.forEach((a) => {
      const day = extractDate(a.startAt) || "Unknown";
      if (!groups[day]) groups[day] = [];
      groups[day].push(a);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredAppointments]);

  const handleEdit = (appt: NormalizedAppointment) => {
    setEditingAppt(appointmentToFormData(appt));
    setDetailOpen(false);
    setModalOpen(true);
  };

  const handleQuickAction = async (action: "complete" | "cancel", id: string) => {
    try {
      if (action === "complete") {
        await api.updateAppointment(id, { status: "completed" });
        toast({ title: "Appointment completed" });
      } else {
        await api.cancelAppointment(id);
        toast({ title: "Appointment cancelled" });
      }
      setDetailOpen(false);
      fetchAppointments();
    } catch (err) {
      toast({ title: "Action failed", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleRowClick = (appt: NormalizedAppointment) => {
    setDetailAppt(appt);
    setDetailOpen(true);
  };

  const handleConvertRequest = (req: NormalizedSchedulingRequest) => {
    const typeName = REQUEST_TYPE_LABELS[req.requestType] || req.requestType;
    const leadName = req.lead?.name || "Lead";
    setSchedulingRequestPrefill({
      lead_id: req.leadId,
      lead_name: leadName,
      title: `${typeName} with ${leadName}`,
      type: req.requestType,
      date: req.preferredDate || undefined,
      start_time: req.preferredTime || undefined,
      notes: req.notes || "",
    });
    setConvertingReqId(req.id);
    setSchedulingRequestInfo(`Created from scheduling request · ${leadName}`);
    setEditingAppt(null);
    setModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Calendar</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage appointments and scheduled activities</p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(48_92%_53%)] text-[hsl(0_0%_4%)] text-sm font-semibold hover:bg-[hsl(48_92%_53%/0.9)] transition-colors"
          onClick={() => { setEditingAppt(null); setModalOpen(true); }}
        >
          <CalendarPlus size={16} />
          New Appointment
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 border-b border-[hsl(0_0%_13%)]">
        {CALENDAR_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setCalendarTab(tab)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors -mb-px ${
              calendarTab === tab
                ? "border-b-2 border-[hsl(48_92%_53%)] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {calendarTab === "Follow-ups" ? (
        <FollowUpQueue />
      ) : calendarTab === "Scheduling Requests" ? (
        <CalendarSchedulingRequests onConvertToAppointment={handleConvertRequest} />
      ) : (
      <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 my-4">
        {/* Range */}
        <div className="flex rounded-lg border border-[hsl(0_0%_16%)] overflow-hidden">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${rangeDays === r.days ? "bg-[hsl(48_92%_53%)] text-[hsl(0_0%_4%)]" : "bg-[hsl(0_0%_7%)] text-muted-foreground hover:bg-[hsl(0_0%_12%)] hover:text-foreground"}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <select className="dark-input py-1.5 text-xs rounded-lg" value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Sources" : SOURCE_LABELS[s] || s}</option>
          ))}
        </select>

        <select className="dark-input py-1.5 text-xs rounded-lg" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Statuses" : STATUS_LABELS[s] || s}</option>
          ))}
        </select>

        <select className="dark-input py-1.5 text-xs rounded-lg" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === "all" ? "All Types" : TYPE_LABELS[t] || t}</option>
          ))}
        </select>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search…"
            className="dark-input pl-9 pr-3 py-1.5 text-xs w-40 rounded-lg"
          />
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="dark-card p-5 flex items-center gap-3 mb-4 border-destructive/30 rounded-xl">
          <AlertCircle size={18} className="text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Failed to load appointments</p>
            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
          </div>
          <button onClick={fetchAppointments} className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_12%)] transition-all">
            Retry
          </button>
        </div>
      )}

      {/* Upcoming panel */}
      {!loading && !error && (
        <UpcomingPanel appointments={appointments} onSelect={handleRowClick} />
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="dark-card p-5 rounded-xl">
              <div className="h-4 w-32 bg-[hsl(0_0%_12%)] animate-pulse rounded-lg mb-3" />
              <div className="h-16 bg-[hsl(0_0%_12%)] animate-pulse rounded-lg" />
            </div>
          ))}
        </div>
      ) : !error && filteredAppointments.length === 0 ? (
        <div className="dark-card p-12 text-center rounded-xl">
          <p className="text-muted-foreground text-sm">No appointments in this range</p>
          <button
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[hsl(0_0%_18%)] text-sm text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_12%)] transition-all"
            onClick={() => { setEditingAppt(null); setModalOpen(true); }}
          >
            <CalendarPlus size={14} /> Create your first appointment
          </button>
        </div>
      ) : !error && (
        <div className="space-y-5">
          {grouped.map(([day, appts]) => (
            <div key={day}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5 pl-1">
                {day !== "Unknown"
                  ? format(new Date(day + "T00:00:00"), "EEEE, MMM d, yyyy")
                  : "Unscheduled"}
              </h3>
              <div className="space-y-2">
                {appts.map((appt) => (
                  <button
                    key={appt.id}
                    onClick={() => handleRowClick(appt)}
                    className="w-full text-left rounded-xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_7%)] p-4 hover:bg-[hsl(0_0%_9%)] hover:border-[hsl(0_0%_18%)] transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">
                          {formatAppointmentTime(appt)}
                        </span>
                        <span className="text-sm font-medium truncate">{appt.title}</span>
                        {appt.lead?.name && (
                          <span className="text-xs text-muted-foreground truncate hidden sm:inline">• {appt.lead.name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {appt.lead?.channel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(0_0%_12%)] text-muted-foreground hidden md:inline-flex">{appt.lead.channel}</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(0_0%_12%)] text-muted-foreground">
                          {TYPE_LABELS[appt.appointmentType] || appt.appointmentType}
                        </span>
                        {appt.source !== "manual" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(0_0%_12%)] text-muted-foreground hidden lg:inline-flex">
                            {SOURCE_LABELS[appt.source] || appt.source}
                          </span>
                        )}
                        {appt.reminderMinutesBefore && (
                          <span className="text-muted-foreground text-[10px] hidden lg:inline" title="Reminder set">🔔</span>
                        )}
                        <span className={`text-xs ${STATUS_CLASSES[appt.status] || "status-pending"}`}>
                          {STATUS_LABELS[appt.status] || appt.status}
                        </span>
                      </div>
                    </div>
                    {appt.notes && (
                      <p className="text-xs text-muted-foreground mt-1.5 ml-[108px] truncate hidden sm:block">{appt.notes}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAppt(null);
          setSchedulingRequestPrefill(null);
          setConvertingReqId(null);
          setSchedulingRequestInfo(undefined);
        }}
        onSaved={async () => {
          fetchAppointments();
          if (convertingReqId) {
            try {
              await api.updateSchedulingRequest(convertingReqId, { status: "converted" });
            } catch { /* best effort */ }
            setConvertingReqId(null);
          }
        }}
        existing={editingAppt}
        prefill={schedulingRequestPrefill || undefined}
        lockLead={!!schedulingRequestPrefill}
        schedulingRequestInfo={schedulingRequestInfo}
      />

      <AppointmentDetailDrawer
        appointment={detailAppt}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailAppt(null); }}
        onEdit={handleEdit}
        onMarkCompleted={(id) => handleQuickAction("complete", id)}
        onCancel={(id) => handleQuickAction("cancel", id)}
      />
    </div>
  );
};

export default Calendar;
