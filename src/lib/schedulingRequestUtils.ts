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

function pick(obj: any, ...keys: string[]): any {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

export function normalizeSchedulingRequest(raw: any): NormalizedSchedulingRequest {
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
    status: raw.status || "open",
    requestType: pick(raw, "requestType", "request_type", "type") || "call",
    preferredDate: pick(raw, "preferredDate", "preferred_date") || "",
    preferredTime: pick(raw, "preferredTime", "preferred_time") || "",
    preferredTimeWindow: pick(raw, "preferredTimeWindow", "preferred_time_window") || "",
    convertedAppointmentId: pick(raw, "convertedAppointmentId", "converted_appointment_id") || null,
    source: raw.source || "manual",
    notes: raw.notes || "",
    createdAt: pick(raw, "createdAt", "created_at") || "",
    updatedAt: pick(raw, "updatedAt", "updated_at") || "",
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
