import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { api, requireCompanyId } from "@/lib/apiClient";

const TYPES = ["call", "site_visit", "meeting", "follow_up"] as const;
const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  site_visit: "Site Visit",
  meeting: "Meeting",
  follow_up: "Follow-up",
};

const DURATIONS = [15, 30, 45, 60, 90, 120];
const REMINDERS = [
  { value: "", label: "None", minutes: null as number | null },
  { value: "15m", label: "15 min before", minutes: 15 },
  { value: "30m", label: "30 min before", minutes: 30 },
  { value: "1h", label: "1 hour before", minutes: 60 },
  { value: "24h", label: "24 hours before", minutes: 1440 },
];

const STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export interface AppointmentFormData {
  id?: string;
  lead_id: string;
  lead_name?: string;
  title: string;
  type: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  timezone: string;
  reminder: string;
  notes: string;
  status: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pre-fill for create from lead detail */
  prefill?: Partial<AppointmentFormData>;
  /** Existing appointment for edit mode */
  existing?: AppointmentFormData | null;
  /** If true, lead field is read-only */
  lockLead?: boolean;
}

function defaultForm(prefill?: Partial<AppointmentFormData>): AppointmentFormData {
  const today = new Date();
  return {
    lead_id: prefill?.lead_id || "",
    lead_name: prefill?.lead_name || "",
    title: prefill?.title || "",
    type: prefill?.type || "call",
    date: prefill?.date || today.toISOString().slice(0, 10),
    start_time: prefill?.start_time || "09:00",
    duration_minutes: prefill?.duration_minutes || 30,
    timezone: prefill?.timezone || "Europe/Zagreb",
    reminder: prefill?.reminder || "",
    notes: prefill?.notes || "",
    status: prefill?.status || "scheduled",
  };
}

export default function AppointmentModal({ open, onClose, onSaved, prefill, existing, lockLead }: Props) {
  const isEdit = !!existing?.id;
  const [form, setForm] = useState<AppointmentFormData>(() =>
    existing ? { ...existing } : defaultForm(prefill)
  );
  const [saving, setSaving] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [leadSearch, setLeadSearch] = useState("");

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setForm(existing ? { ...existing } : defaultForm(prefill));
    }
  }, [open, existing, prefill]);

  // Load leads for picker (only if lead not locked)
  useEffect(() => {
    if (!open || lockLead) return;
    const companyId = requireCompanyId();
    api.getLeads(companyId, { limit: 100, offset: 0, source: "inbox" })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.data || res?.leads || res?.items || []);
        setLeads(list);
      })
      .catch(() => {});
  }, [open, lockLead]);

  const endTime = useMemo(() => {
    if (!form.start_time) return "";
    const [h, m] = form.start_time.split(":").map(Number);
    const total = h * 60 + m + form.duration_minutes;
    const eh = Math.floor(total / 60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  }, [form.start_time, form.duration_minutes]);

  const isValid = form.lead_id && form.title.trim() && form.date && form.start_time && form.type;

  const isDirty = useMemo(() => {
    if (!isEdit) return true; // create mode always dirty if valid
    if (!existing) return true;
    return (
      form.title !== existing.title ||
      form.type !== existing.type ||
      form.date !== existing.date ||
      form.start_time !== existing.start_time ||
      form.duration_minutes !== existing.duration_minutes ||
      form.reminder !== existing.reminder ||
      form.notes !== existing.notes ||
      form.status !== existing.status
    );
  }, [form, existing, isEdit]);

  const buildPayload = () => {
    const [h, m] = form.start_time.split(":").map(Number);
    const startDate = new Date(`${form.date}T${form.start_time}:00`);
    const endDate = new Date(startDate.getTime() + form.duration_minutes * 60_000);
    const reminderEntry = REMINDERS.find((r) => r.value === form.reminder);

    return {
      leadId: form.lead_id,
      title: form.title.trim(),
      appointmentType: form.type,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      timezone: form.timezone,
      notes: form.notes.trim() || null,
      source: "manual",
      reminderMinutesBefore: reminderEntry?.minutes ?? null,
    };
  };

  const extractValidationMessage = (err: any): string => {
    try {
      const details = err?.response?.data?.details || err?.details;
      if (Array.isArray(details) && details.length > 0) {
        return details[0].message || details[0].msg || JSON.stringify(details[0]);
      }
    } catch {}
    return getErrorMessage(err);
  };

  const handleSave = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      console.log("appointment submit payload", payload);

      if (isEdit && existing?.id) {
        await api.updateAppointment(existing.id, payload);
        toast({ title: "Appointment updated" });
      } else {
        await api.createAppointment(payload);
        toast({ title: "Appointment created" });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to save appointment", description: extractValidationMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!existing?.id || saving) return;
    setSaving(true);
    try {
      await api.cancelAppointment(existing.id);
      toast({ title: "Appointment cancelled" });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Failed to cancel", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!existing?.id || saving) return;
    setSaving(true);
    try {
      await api.updateAppointment(existing.id, { status: "completed" });
      toast({ title: "Appointment marked as completed" });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Failed to update", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const filteredLeads = leadSearch
    ? leads.filter((l) => {
        const name = (l.name || l.external_id || "").toLowerCase();
        return name.includes(leadSearch.toLowerCase());
      })
    : leads;

  const set = (key: keyof AppointmentFormData, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm uppercase tracking-wider">
            {isEdit ? "Edit Appointment" : "New Appointment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Lead */}
          <div>
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Lead</Label>
            {lockLead ? (
              <div className="mt-1 text-sm font-medium">{form.lead_name || form.lead_id}</div>
            ) : (
              <div className="mt-1 space-y-1">
                <Input
                  placeholder="Search leads..."
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                  className="text-sm"
                />
                {!form.lead_id && filteredLeads.length > 0 && (
                  <div className="max-h-32 overflow-y-auto border border-border rounded-sm bg-card">
                    {filteredLeads.slice(0, 20).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          set("lead_id", l.id);
                          set("lead_name", l.name || l.external_id || "Lead");
                          setLeadSearch("");
                        }}
                      >
                        {l.name || l.external_id || l.id} <span className="text-muted-foreground text-xs">({l.channel})</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.lead_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{form.lead_name}</span>
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => { set("lead_id", ""); set("lead_name", ""); }}>
                      Change
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Title</Label>
            <Input className="mt-1" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Follow-up call" />
          </div>

          {/* Type */}
          <div>
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Type</Label>
            <select className="industrial-input w-full mt-1" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Date</Label>
              <Input type="date" className="mt-1" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Start Time</Label>
              <Input type="time" className="mt-1" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </div>
          </div>

          {/* Duration + End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Duration</Label>
              <select className="industrial-input w-full mt-1" value={form.duration_minutes} onChange={(e) => set("duration_minutes", Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">End Time</Label>
              <div className="mt-1 text-sm font-mono text-muted-foreground leading-10">{endTime}</div>
            </div>
          </div>

          {/* Reminder */}
          <div>
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Reminder</Label>
            <select className="industrial-input w-full mt-1" value={form.reminder} onChange={(e) => set("reminder", e.target.value)}>
              {REMINDERS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Status (edit mode) */}
          {isEdit && (
            <div>
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Status</Label>
              <select className="industrial-input w-full mt-1" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Notes</Label>
            <textarea
              className="industrial-input w-full mt-1 min-h-[80px] resize-y"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-between">
          <div className="flex gap-2">
            {isEdit && existing?.status !== "cancelled" && (
              <>
                <Button variant="outline" size="sm" onClick={handleMarkCompleted} disabled={saving || existing?.status === "completed"}>
                  Mark Completed
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancel} disabled={saving}>
                  Cancel Appointment
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={!isValid || !isDirty || saving}
              className={isValid && isDirty ? "bg-accent text-accent-foreground hover:bg-accent/90" : ""}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? "Save Changes" : "Create"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
