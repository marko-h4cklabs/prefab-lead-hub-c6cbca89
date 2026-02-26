/**
 * Scheduling request data normalization utility.
 * Tolerates both camelCase and snake_case keys from backend.
 */

export interface NormalizedSchedulingRequest {
  id: string;
  leadId: string;
  status: string;
  requestType: string;
  preferredDate: string;
  preferredTime: string;
  preferredTimeWindow: string;
  convertedAppointmentId: string | null;
  source: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    name: string;
    channel: string;
  };
}

/** Safe string coercion – returns "" for null, undefined, and objects (e.g. {}) */
function str(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return "";
  return String(v);
}

function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && !(typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0)) return v;
  }
  return undefined;
}

export function normalizeSchedulingRequest(raw: any): NormalizedSchedulingRequest {
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
    status: str(raw.status) || "open",
    requestType: str(pick(raw, "requestType", "request_type", "type")) || "call",
    preferredDate: str(pick(raw, "preferredDate", "preferred_date")),
    preferredTime: str(pick(raw, "preferredTime", "preferred_time")),
    preferredTimeWindow: str(pick(raw, "preferredTimeWindow", "preferred_time_window")),
    convertedAppointmentId: str(pick(raw, "convertedAppointmentId", "converted_appointment_id")) || null,
    source: str(raw.source) || "manual",
    notes: str(raw.notes),
    createdAt: str(pick(raw, "createdAt", "created_at")),
    updatedAt: str(pick(raw, "updatedAt", "updated_at")),
    lead,
  };
}

export function normalizeSchedulingRequestList(raw: unknown): NormalizedSchedulingRequest[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.data)
      ? (raw as any).data
      : Array.isArray((raw as any)?.requests)
        ? (raw as any).requests
        : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : [];
  return list.map(normalizeSchedulingRequest);
}

export const REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  converted: "Converted",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const REQUEST_STATUS_CLASSES: Record<string, string> = {
  open: "status-new",
  converted: "status-qualified",
  closed: "status-pending",
  cancelled: "status-disqualified",
};

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  site_visit: "Site Visit",
  meeting: "Meeting",
  follow_up: "Follow-up",
};

export const REQUEST_SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  chatbot: "Chatbot",
  simulation: "Simulation",
};
