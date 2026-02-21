/**
 * Appointment data normalization utility.
 * Tolerates both camelCase and snake_case keys from backend.
 */

export interface NormalizedAppointment {
  id: string;
  leadId: string;
  title: string;
  appointmentType: string;
  startAt: string;
  endAt: string;
  timezone: string;
  notes: string;
  source: string;
  status: string;
  reminderMinutesBefore: number | null;
  lead?: {
    id: string;
    name: string;
    channel: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Pick first truthy value from an object for a set of candidate keys */
function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

/** Normalize a single appointment object from backend (snake_case or camelCase) */
export function normalizeAppointment(raw: any): NormalizedAppointment {
  if (!raw) return raw;

  const lead = raw.lead
    ? {
        id: raw.lead.id || "",
        name: raw.lead.name || raw.lead.external_id || "",
        channel: raw.lead.channel || "",
      }
    : undefined;

  return {
    id: raw.id || "",
    leadId: pick(raw, "leadId", "lead_id") || "",
    title: raw.title || "",
    appointmentType: pick(raw, "appointmentType", "appointment_type", "type") || "call",
    startAt: pick(raw, "startAt", "start_at") || "",
    endAt: pick(raw, "endAt", "end_at") || "",
    timezone: raw.timezone || "Europe/Zagreb",
    notes: raw.notes || "",
    source: raw.source || "manual",
    status: raw.status || "scheduled",
    reminderMinutesBefore: pick(raw, "reminderMinutesBefore", "reminder_minutes_before") ?? null,
    lead,
    createdAt: pick(raw, "createdAt", "created_at") || "",
    updatedAt: pick(raw, "updatedAt", "updated_at") || "",
  };
}

/** Normalize an array of appointments */
export function normalizeAppointmentList(raw: unknown): NormalizedAppointment[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.data)
      ? (raw as any).data
      : Array.isArray((raw as any)?.appointments)
        ? (raw as any).appointments
        : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : [];
  return list.map(normalizeAppointment);
}

/** Format constants */
export const TYPE_LABELS: Record<string, string> = {
  call: "Call",
  site_visit: "Site Visit",
  meeting: "Meeting",
  follow_up: "Follow-up",
};

export const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const STATUS_CLASSES: Record<string, string> = {
  scheduled: "status-new",
  completed: "status-qualified",
  cancelled: "status-disqualified",
  no_show: "status-pending",
};

export const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  chatbot: "Chatbot",
  inbox: "Inbox",
  simulation: "Simulation",
};

/** Extract date string (YYYY-MM-DD) from ISO datetime */
export function extractDate(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Extract HH:MM from ISO datetime */
export function extractTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

/** Format appointment for display */
export function formatAppointmentTime(appt: NormalizedAppointment): string {
  const start = extractTime(appt.startAt);
  const end = extractTime(appt.endAt);
  if (!start) return "—";
  return end ? `${start} – ${end}` : start;
}

/** Compute duration in minutes between startAt and endAt */
export function computeDuration(appt: NormalizedAppointment): number {
  if (!appt.startAt || !appt.endAt) return 30;
  const diff = new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime();
  return Math.max(Math.round(diff / 60_000), 0);
}

/** Reminder value map */
export const REMINDER_MAP: Record<number, string> = {
  15: "15m",
  30: "30m",
  60: "1h",
  1440: "24h",
};

/** Convert NormalizedAppointment to form data for the modal */
export function appointmentToFormData(appt: NormalizedAppointment) {
  return {
    id: appt.id,
    lead_id: appt.leadId,
    lead_name: appt.lead?.name || "",
    title: appt.title,
    type: appt.appointmentType,
    date: extractDate(appt.startAt),
    start_time: extractTime(appt.startAt),
    duration_minutes: computeDuration(appt),
    timezone: appt.timezone,
    reminder: appt.reminderMinutesBefore ? (REMINDER_MAP[appt.reminderMinutesBefore] || "") : "",
    notes: appt.notes,
    status: appt.status,
  };
}
