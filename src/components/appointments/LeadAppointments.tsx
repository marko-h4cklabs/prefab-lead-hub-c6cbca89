import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppointmentModal, { AppointmentFormData } from "./AppointmentModal";

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

interface Props {
  leadId: string;
  leadName?: string;
  collectedSummary?: string;
}

export default function LeadAppointments({ leadId, leadName, collectedSummary }: Props) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<AppointmentFormData | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    api.getAppointments({ lead_id: leadId })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || res?.appointments || res?.items || []);
        setAppointments(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { fetch(); }, [fetch]);

  const prefill: Partial<AppointmentFormData> = {
    lead_id: leadId,
    lead_name: leadName || "Lead",
    title: leadName ? `Follow-up with ${leadName}` : "Follow-up",
    notes: collectedSummary || "",
  };

  const handleEdit = (appt: any) => {
    setEditingAppt({
      id: appt.id,
      lead_id: appt.lead_id || leadId,
      lead_name: appt.lead?.name || leadName || "",
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

  const handleNew = () => {
    setEditingAppt(null);
    setModalOpen(true);
  };

  return (
    <div className="industrial-card p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground">
          Appointments
        </h2>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleNew}>
          <CalendarPlus size={14} />
          Add to Calendar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No appointments yet</p>
      ) : (
        <div className="space-y-2">
          {appointments.map((appt) => (
            <button
              key={appt.id}
              onClick={() => handleEdit(appt)}
              className="w-full text-left industrial-card p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{appt.title}</span>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[appt.type] || appt.type}</span>
                </div>
                <span className={`text-xs ${STATUS_CLASSES[appt.status] || "status-pending"}`}>
                  {appt.status}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {appt.date ? new Date(appt.date).toLocaleDateString() : ""} {appt.start_time || ""}
              </div>
            </button>
          ))}
        </div>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAppt(null); }}
        onSaved={fetch}
        prefill={prefill}
        existing={editingAppt}
        lockLead
      />
    </div>
  );
}
