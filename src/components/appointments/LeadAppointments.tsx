import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { CalendarPlus, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import AppointmentModal, { AppointmentFormData } from "./AppointmentModal";
import {
  normalizeAppointmentList,
  NormalizedAppointment,
  appointmentToFormData,
  TYPE_LABELS,
  STATUS_CLASSES,
  STATUS_LABELS,
  formatAppointmentTime,
  extractDate,
} from "@/lib/appointmentUtils";

interface Props {
  leadId: string;
  leadName?: string;
  collectedSummary?: string;
}

export default function LeadAppointments({ leadId, leadName, collectedSummary }: Props) {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<NormalizedAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<AppointmentFormData | null>(null);

  const fetchAppts = useCallback(() => {
    setLoading(true);
    api.getAppointments({ lead_id: leadId })
      .then((res) => setAppointments(normalizeAppointmentList(res)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { fetchAppts(); }, [fetchAppts]);

  const prefill: Partial<AppointmentFormData> = {
    lead_id: leadId,
    lead_name: leadName || "Lead",
    title: leadName ? `Call with ${leadName}` : "Follow-up",
    notes: collectedSummary || "",
  };

  const handleEdit = (appt: NormalizedAppointment) => {
    setEditingAppt(appointmentToFormData(appt));
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingAppt(null);
    setModalOpen(true);
  };

  const handleQuickStatus = async (id: string, action: "complete" | "cancel") => {
    try {
      if (action === "complete") {
        await api.updateAppointment(id, { status: "completed" });
        toast({ title: "Appointment completed" });
      } else {
        await api.cancelAppointment(id);
        toast({ title: "Appointment cancelled" });
      }
      fetchAppts();
    } catch (err) {
      toast({ title: "Action failed", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  // Split into upcoming vs past
  const now = new Date();
  const upcoming = appointments.filter((a) => a.status === "scheduled" && new Date(a.startAt) >= now);
  const past = appointments.filter((a) => a.status !== "scheduled" || new Date(a.startAt) < now);

  return (
    <div className="industrial-card p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-muted-foreground">
          Appointments
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/calendar")}
          >
            <ExternalLink size={12} />
            Open Calendar
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleNew}>
            <CalendarPlus size={14} />
            Add to Calendar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No appointments yet</p>
      ) : (
        <div className="space-y-3">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Upcoming</div>
              <div className="space-y-1.5">
                {upcoming.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    onClick={() => handleEdit(appt)}
                    onComplete={() => handleQuickStatus(appt.id, "complete")}
                    onCancel={() => handleQuickStatus(appt.id, "cancel")}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Past / completed / cancelled */}
          {past.length > 0 && (
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">Past</div>
              <div className="space-y-1.5">
                {past.map((appt) => (
                  <AppointmentRow
                    key={appt.id}
                    appt={appt}
                    onClick={() => handleEdit(appt)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AppointmentModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingAppt(null); }}
        onSaved={fetchAppts}
        prefill={prefill}
        existing={editingAppt}
        lockLead
      />
    </div>
  );
}

function AppointmentRow({
  appt,
  onClick,
  onComplete,
  onCancel,
}: {
  appt: NormalizedAppointment;
  onClick: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const dateStr = extractDate(appt.startAt);
  const isActive = appt.status === "scheduled";

  return (
    <div className="industrial-card p-3 hover:bg-muted/30 transition-colors group">
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium truncate">{appt.title}</span>
            <span className="status-badge bg-muted text-muted-foreground text-[10px]">
              {TYPE_LABELS[appt.appointmentType] || appt.appointmentType}
            </span>
          </div>
          <span className={`text-xs shrink-0 ${STATUS_CLASSES[appt.status] || "status-pending"}`}>
            {STATUS_LABELS[appt.status] || appt.status}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 font-mono">
          {dateStr ? new Date(dateStr + "T00:00:00").toLocaleDateString() : ""} {formatAppointmentTime(appt)}
        </div>
      </button>
      {/* Quick actions (visible on hover for active) */}
      {isActive && (onComplete || onCancel) && (
        <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onComplete && (
            <button
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
            >
              ✓ Complete
            </button>
          )}
          {onCancel && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
            >
              ✕ Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
