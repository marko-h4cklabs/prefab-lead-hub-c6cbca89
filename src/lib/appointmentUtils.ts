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
  google_meet_link?: string | null;
  synced_to_google?: boolean;
  sync_error?: string | null;
}

/** Safe string coercion – returns "" for null, undefined, and objects (e.g. {}) */
function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return "";
  return String(v);
}

/** Pick first truthy value from an object for a set of candidate keys (skips objects like {}) */
function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)) return v;
  }
  return undefined;
}

/** Normalize a single appointment object from backend (snake_case or camelCase) */
export function normalizeAppointment(raw: any): NormalizedAppointment {
  if (!raw) return raw;

  const rawLead = raw.lead && typeof raw.lead === "object" && Object.keys(raw.lead).length > 0
    ? raw.lead
    : undefined;

  const lead = rawLead
    ? {
        id: str(rawLead.id),
        name: str(rawLead.name) || str(rawLead.external_id),
        channel: str(rawLead.channel),
      }
    : undefined;

  return {
    id: str(raw.id),
    leadId: str(pick(raw, "leadId", "lead_id")),
    title: str(raw.title),
    appointmentType: str(pick(raw, "appointmentType", "appointment_type", "type")) || "call",
    startAt: str(pick(raw, "startAt", "start_at")),
    endAt: str(pick(raw, "endAt", "end_at")),
    timezone: str(raw.timezone) || "Europe/Zagreb",
    notes: str(raw.notes),
    source: str(raw.source) || "manual",
    status: str(raw.status) || "scheduled",
    reminderMinutesBefore: pick(raw, "reminderMinutesBefore", "reminder_minutes_before") ?? null,
    lead,
    createdAt: str(pick(raw, "createdAt", "created_at")),
    updatedAt: str(pick(raw, "updatedAt", "updated_at")),
    google_meet_link: str(pick(raw, "google_meet_link", "googleMeetLink")) || null,
    synced_to_google: pick(raw, "synced_to_google", "syncedToGoogle") ?? false,
    sync_error: str(pick(raw, "sync_error", "syncError")) || null,
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
