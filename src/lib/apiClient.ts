const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// --- SWR-style cache & request deduplication ---

interface CacheEntry {
  data: any;
  timestamp: number;
}

const requestCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<any>>();
const CACHE_TTL = 30_000; // 30 seconds

function getCacheKey(path: string, options: RequestInit): string | null {
  // Only cache GET requests (no method or GET)
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET") return null;
  return path;
}

function getCached(key: string): any | undefined {
  const entry = requestCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    requestCache.delete(key);
    return undefined;
  }
  return entry.data;
}

/** Invalidate cache entries matching a path prefix. */
export function invalidateCache(pathPrefix?: string) {
  if (!pathPrefix) { requestCache.clear(); return; }
  for (const key of requestCache.keys()) {
    if (key.startsWith(pathPrefix)) requestCache.delete(key);
  }
}

// --- Token management ---

export function getAuthToken(): string | null {
  return localStorage.getItem("auth_token") || localStorage.getItem("plcs_token");
}

export function setAuthToken(token: string) {
  localStorage.setItem("auth_token", token);
}

export function clearAuth() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("company_id");
  localStorage.removeItem("plcs_token");
  localStorage.removeItem("plcs_company_id");
  localStorage.removeItem("authToken");
  localStorage.removeItem("companyId");
}

/** Returns stored companyId. */
export function getCompanyId(): string | null {
  return localStorage.getItem("company_id") || localStorage.getItem("plcs_company_id") || localStorage.getItem("companyId");
}

export function setCompanyId(id: string) {
  localStorage.setItem("company_id", id);
}

export function requireCompanyId(): string {
  const id = getCompanyId();
  if (!id) {
    window.location.href = "/login";
    throw new Error("No companyId");
  }
  return id;
}

export function clearCompanyId() {
  localStorage.removeItem("companyId");
}

// --- HTTP wrapper ---

import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";

async function rawRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const companyId = getCompanyId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (companyId) headers["x-company-id"] = companyId;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 403) {
    let message = "Not authorized";
    try { const json = await res.json(); message = json.error || json.message || message; } catch {}
    clearAuth();
    window.location.href = "/login";
    toast({ title: "Access denied", description: message, variant: "destructive" });
    throw new Error(message);
  }

  if (!res.ok) {
    let message = `API error ${res.status}`;
    let details: any = undefined;
    try {
      const json = await res.json();
      details = json?.details;
      const raw = json?.error?.message || json?.error || json?.message || json;
      message = typeof raw === "string" ? raw : JSON.stringify(raw);
    } catch {
      try { const text = await res.text(); if (text) message = text; } catch {}
    }
    toast({ title: `Error ${res.status}`, description: message, variant: "destructive" });
    throw Object.assign(new Error(message), details ? { details } : {});
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const cacheKey = getCacheKey(path, options);

  // For GET requests: check cache, then dedup
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached !== undefined) return cached as T;

    // Dedup: reuse in-flight request for same path
    const pending = pendingRequests.get(cacheKey);
    if (pending) return pending as Promise<T>;

    const promise = rawRequest<T>(path, options).then((data) => {
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
      pendingRequests.delete(cacheKey);
      return data;
    }).catch((err) => {
      pendingRequests.delete(cacheKey);
      throw err;
    });

    pendingRequests.set(cacheKey, promise);
    return promise;
  }

  // For mutations: execute and invalidate related cache
  const result = await rawRequest<T>(path, options);
  // Invalidate cache for the resource path (strip last segment for PUT/PATCH)
  const basePath = path.replace(/\/[^/]*$/, '');
  invalidateCache(basePath);
  invalidateCache(path);
  return result;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  // --- Auth ---
  login: (email: string, password: string) =>
    request<{ token: string; company_id?: string; user?: { companyId: string }; role?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signup: (companyName: string, email: string, password: string, extra?: { phone_number?: string; country_code?: string }) =>
    request<{ token: string; companyId: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ companyName, email, password, ...extra }),
    }),

  me: () =>
    request<{ user: any; company_id: string }>("/api/auth/me"),

  // --- Company ---
  getCompany: (companyId: string) =>
    request<any>(`/api/companies/${companyId}`),

  patchCompany: (companyId: string, data: any) =>
    request<any>(`/api/companies/${companyId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // --- Leads ---
  getLeads: (companyId: string, params: { statusId?: string; limit?: number; offset?: number; query?: string; source?: string }) => {
    const search = new URLSearchParams();
    if (params.statusId) search.set("status_id", params.statusId);
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    if (params.offset !== undefined) search.set("offset", String(params.offset));
    if (params.query) search.set("query", params.query);
    if (params.source) search.set("source", params.source);
    return request<any>(`/api/companies/${companyId}/leads?${search.toString()}`, { cache: "no-store" });
  },

  createLead: (companyId: string, data: { name: string; channel: string; source?: string }) =>
    request<any>(`/api/companies/${companyId}/leads`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getLead: (companyId: string, leadId: string) =>
    request<any>(`/api/companies/${companyId}/leads/${leadId}`),

  getConversation: (companyId: string, leadId: string) =>
    request<any>(`/api/companies/${companyId}/leads/${leadId}/conversation`),

  sendMessage: (companyId: string, leadId: string, data: { role: string; content: string }) =>
    request<any>(`/api/companies/${companyId}/leads/${leadId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  aiReply: (companyId: string, leadId: string) =>
    request<any>(`/api/companies/${companyId}/leads/${leadId}/ai-reply`, {
      method: "POST",
    }),

  getLeadStatuses: () =>
    request<{ id: string; name: string; sort_order: number; is_default: boolean }[]>("/api/leads/statuses", { cache: "no-store" }),

  updateLeadStatus: (leadId: string, statusId: string) =>
    request<any>(`/api/leads/${leadId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status_id: statusId }),
    }),

  updateLeadName: (leadId: string, name: string) =>
    request<any>(`/api/leads/${leadId}/name`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  // --- Fields ---
  getFields: (companyId: string) =>
    request<any>(`/api/companies/${companyId}/fields`),

  createField: (companyId: string, data: any) =>
    request<any>(`/api/companies/${companyId}/fields`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  patchField: (companyId: string, fieldId: string, data: any) =>
    request<any>(`/api/companies/${companyId}/fields/${fieldId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteField: (companyId: string, fieldId: string) =>
    request<any>(`/api/companies/${companyId}/fields/${fieldId}`, {
      method: "DELETE",
    }),

  // --- Chatbot ---
  getCompanyInfo: () =>
    request<any>("/api/chatbot/company-info"),

  putCompanyInfo: (data: { website_url?: string; business_description?: string; additional_notes?: string }) =>
    request<any>("/api/chatbot/company-info", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  scrapeCompanyInfo: (data: { website_url: string }) =>
    request<any>("/api/chatbot/company-info/scrape", { method: "POST", body: JSON.stringify(data) }),

  getChatbotBehavior: () =>
    request<any>("/api/chatbot/behavior"),

  putChatbotBehavior: (data: {
    tone?: string;
    response_length?: string;
    emojis_enabled?: boolean;
    persona_style?: string;
    forbidden_topics?: string[];
  }) =>
    request<any>("/api/chatbot/behavior", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getQuoteFields: () =>
    request<any>("/api/chatbot/quote-fields"),

  putQuoteFields: (data: { presets: any[] }) =>
    request<any>("/api/chatbot/quote-fields", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getSystemContext: () =>
    request<any>("/api/chatbot/system-context"),

  // --- Account ---
  getMe: () =>
    request<any>("/api/me"),

  updateEmail: (email: string) =>
    request<any>("/api/me/email", {
      method: "PUT",
      body: JSON.stringify({ email }),
    }),

  updatePassword: (currentPassword: string, newPassword: string) =>
    request<any>("/api/me/password", {
      method: "PUT",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  // --- Attachments ---
  uploadAttachment: (leadId: string, file: File) => {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return fetch(`${API_BASE}/api/leads/${leadId}/attachments`, {
      method: "POST",
      headers,
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        let message = `Upload failed (${res.status})`;
        try {
          const json = await res.json();
          message = json?.error || json?.message || message;
        } catch { /* ignore */ }
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      if (res.status === 204) return undefined;
      return res.json();
    });
  },

  // --- Notifications ---
  getNotifications: (params: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    if (params.offset !== undefined) search.set("offset", String(params.offset));
    return request<any>(`/api/notifications?${search.toString()}`);
  },

  markNotificationRead: (id: string) =>
    request<any>(`/api/notifications/${id}/read`, { method: "POST" }),

  markAllNotificationsRead: () =>
    request<any>("/api/notifications/read-all", { method: "POST" }),

  // --- Notification Settings ---
  getNotificationSettings: () =>
    request<any>("/api/settings/notifications"),

  updateNotificationSettings: (data: {
    email_enabled: boolean;
    email_recipients: string[];
    notify_new_inquiry_inbox: boolean;
    notify_new_inquiry_simulation: boolean;
  }) =>
    request<any>("/api/settings/notifications", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // --- CRM ---
  getLeadCrmSummary: (leadId: string) =>
    request<any>(`/api/leads/${leadId}/crm/summary`),

  getLeadActivity: (leadId: string, params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    return request<any>(`/api/leads/${leadId}/crm/activity?${search.toString()}`);
  },

  getLeadNotes: (leadId: string, params?: { limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    return request<any>(`/api/leads/${leadId}/crm/notes?${search.toString()}`);
  },

  createLeadNote: (leadId: string, body: { content: string }) =>
    request<any>(`/api/leads/${leadId}/crm/notes`, { method: "POST", body: JSON.stringify(body) }),

  updateLeadNote: (leadId: string, noteId: string, body: { content: string }) =>
    request<any>(`/api/leads/${leadId}/crm/notes/${noteId}`, { method: "PATCH", body: JSON.stringify(body) }),

  deleteLeadNote: (leadId: string, noteId: string) =>
    request<any>(`/api/leads/${leadId}/crm/notes/${noteId}`, { method: "DELETE" }),

  getLeadTasks: (leadId: string, params?: { limit?: number; offset?: number; status?: string }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    if (params?.status) search.set("status", params.status);
    return request<any>(`/api/leads/${leadId}/crm/tasks?${search.toString()}`);
  },

  createLeadTask: (leadId: string, payload: { title: string; description?: string; due_at?: string }) =>
    request<any>(`/api/leads/${leadId}/crm/tasks`, { method: "POST", body: JSON.stringify(payload) }),

  updateLeadTask: (leadId: string, taskId: string, payload: { title?: string; description?: string; due_at?: string; status?: string }) =>
    request<any>(`/api/leads/${leadId}/crm/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }),

  deleteLeadTask: (leadId: string, taskId: string) =>
    request<any>(`/api/leads/${leadId}/crm/tasks/${taskId}`, { method: "DELETE" }),

  // --- Analytics ---
  getAnalyticsDashboard: (params: { range?: number; source?: string; channel?: string }) => {
    const search = new URLSearchParams();
    if (params.range !== undefined) search.set("range", String(params.range));
    if (params.source && params.source !== "all") search.set("source", params.source);
    if (params.channel && params.channel !== "all") search.set("channel", params.channel);
    return request<any>(`/api/analytics/dashboard?${search.toString()}`);
  },

  // --- Appointments ---
  getAppointments: (params?: { from?: string; to?: string; status?: string; type?: string; source?: string; lead_id?: string }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.status && params.status !== "all") search.set("status", params.status);
    if (params?.type && params.type !== "all") search.set("type", params.type);
    if (params?.source && params.source !== "all") search.set("source", params.source);
    if (params?.lead_id) search.set("lead_id", params.lead_id);
    return request<any>(`/api/appointments?${search.toString()}`);
  },

  getAppointment: (id: string) =>
    request<any>(`/api/appointments/${id}`),

  getUpcomingAppointments: () =>
    request<any>("/api/appointments/upcoming"),

  createAppointment: (data: any) =>
    request<any>("/api/appointments", { method: "POST", body: JSON.stringify(data) }),

  updateAppointment: (id: string, data: any) =>
    request<any>(`/api/appointments/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  cancelAppointment: (id: string) =>
    request<any>(`/api/appointments/${id}/cancel`, { method: "POST" }),

  // --- Availability ---
  getAvailableSlots: (params: { type?: string; from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params.type) search.set("type", params.type);
    if (params.from) search.set("from", params.from);
    if (params.to) search.set("to", params.to);
    return request<any>(`/api/appointments/availability?${search.toString()}`);
  },

  // --- Scheduling Settings ---
  getSchedulingSettings: () =>
    request<any>("/api/settings/scheduling"),

  updateSchedulingSettings: (data: any) =>
    request<any>("/api/settings/scheduling", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // --- Scheduling Requests ---
  getSchedulingRequests: (params?: { status?: string; type?: string; source?: string; search?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.status && params.status !== "all") search.set("status", params.status);
    if (params?.type && params.type !== "all") search.set("type", params.type);
    if (params?.source && params.source !== "all") search.set("source", params.source);
    if (params?.search) search.set("search", params.search);
    if (params?.limit) search.set("limit", String(params.limit));
    return request<any>(`/api/scheduling-requests?${search.toString()}`);
  },

  getLeadSchedulingRequests: (leadId: string) =>
    request<any>(`/api/leads/${leadId}/scheduling-requests`),

  updateSchedulingRequest: (id: string, data: any) =>
    request<any>(`/api/scheduling-requests/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  convertSchedulingRequest: (id: string, appointmentData?: any) =>
    request<any>(`/api/scheduling-requests/${id}/convert`, {
      method: "POST",
      body: appointmentData ? JSON.stringify(appointmentData) : undefined,
    }),

  closeSchedulingRequest: (id: string) =>
    request<any>(`/api/scheduling-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) }),

  // --- Chatbot Booking ---
  bookSlot: async (companyId: string, leadId: string, data: {
    slot_id?: string; startAt: string; endAt?: string; conversation_id?: string;
    appointment_type?: string; timezone?: string; source?: string; title?: string; notes?: string;
  }) => {
    // Canonical payload with both snake_case and camelCase for backend compat
    const payload = {
      company_id: companyId,
      companyId,
      lead_id: leadId,
      leadId,
      slot_id: data.slot_id,
      startAt: data.startAt,
      start_at: data.startAt,
      start: data.startAt,
      endAt: data.endAt,
      end_at: data.endAt,
      end: data.endAt,
      appointment_type: data.appointment_type,
      appointmentType: data.appointment_type,
      timezone: data.timezone,
      source: data.source || "chatbot",
      title: data.title,
      notes: data.notes,
      conversation_id: data.conversation_id,
    };
    // Try canonical endpoint first, fallback to legacy
    try {
      return await request<any>(`/api/scheduling/book-slot`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      if (err?.message?.includes("404") || err?.message?.includes("Not Found")) {
        return request<any>(`/api/companies/${companyId}/leads/${leadId}/book-slot`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      throw err;
    }
  },

  // --- ManyChat Settings ---
  saveManychatSettings: (data: { manychat_api_key: string; manychat_page_id: string }) =>
    request<any>("/api/settings/manychat", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // --- Admin ---
  runSnapshot: () =>
    request<any>("/api/admin/snapshot", { method: "POST" }),

  adminGetStats: () =>
    request<any>("/api/admin/stats"),

  adminGetWorkspaces: (params?: { limit?: number; offset?: number; search?: string }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    if (params?.search) search.set("search", params.search);
    return request<any>(`/api/admin/workspaces?${search.toString()}`);
  },

  adminGetWorkspace: (companyId: string) =>
    request<any>(`/api/admin/workspaces/${companyId}`),

  adminImpersonate: (companyId: string) =>
    request<any>(`/api/admin/workspaces/${companyId}/impersonate`, { method: "POST" }),

  // --- Admin Companies ---
  adminGetCompanies: (params?: { limit?: number; offset?: number; search?: string }) => {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    if (params?.search) search.set("search", params.search);
    return request<any>(`/api/admin/companies?${search.toString()}`);
  },

  adminGetCompany: (companyId: string) =>
    request<any>(`/api/admin/companies/${companyId}`),

  adminGetHotLeads: () =>
    request<any>("/api/admin/hot-leads"),

  adminImpersonateCompany: (companyId: string) =>
    request<any>("/api/admin/impersonate", {
      method: "POST",
      body: JSON.stringify({ company_id: companyId }),
    }),

  adminEndImpersonation: () =>
    request<any>("/api/admin/impersonate/end", { method: "POST" }),

  // --- Admin Users ---
  adminGetUsers: () =>
    request<any>("/api/admin/users"),

  adminToggleAdmin: (userId: string) =>
    request<any>(`/api/admin/users/${userId}/toggle-admin`, { method: "PUT" }),

  // --- ManyChat Settings (read) ---
  getManychatSettings: () =>
    request<any>("/api/settings/manychat"),

  // --- Voice Messages ---
  sendVoiceMessage: (conversationId: string, audioBlob: Blob) => {
    const token = getAuthToken();
    const companyId = getCompanyId();
    const formData = new FormData();
    formData.append("audio", audioBlob, "voice.webm");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (companyId) headers["x-company-id"] = companyId;
    return fetch(`${API_BASE}/api/conversations/${conversationId}/voice-message`, {
      method: "POST",
      headers,
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        let message = `Upload failed (${res.status})`;
        try { const json = await res.json(); message = json?.error || json?.message || message; } catch {}
        throw new Error(typeof message === "string" ? message : JSON.stringify(message));
      }
      if (res.status === 204) return undefined;
      return res.json();
    });
  },

  // --- Follow-up Queue ---
  getQueueStats: () =>
    request<any>("/api/queue/stats"),

  scheduleFollowUp: (data: { lead_id: string; type: string; delay_minutes: number; message?: string }) =>
    request<any>("/api/queue/follow-up", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // --- Operating Mode ---
  getOperatingMode: () =>
    request<any>("/api/settings/mode"),

  setOperatingMode: (mode: string) =>
    request<any>("/api/settings/mode", {
      method: "PUT",
      body: JSON.stringify({ operating_mode: mode }),
    }),

  // --- Lead Intelligence ---
  getLeadIntelligence: (leadId: string) =>
    request<any>(`/api/leads/${leadId}/intelligence`),

  // --- Suggestions ---
  getLatestSuggestions: (leadId: string) =>
    request<any>(`/api/leads/${leadId}/suggestions/latest`),

  generateSuggestions: (conversationId: string) =>
    request<any>(`/api/conversations/${conversationId}/suggestions`, { method: "POST" }),

  sendSuggestion: (conversationId: string, suggestionId: string, suggestionIndex: number) =>
    request<any>(`/api/conversations/${conversationId}/suggestions/${suggestionId}/send`, {
      method: "POST",
      body: JSON.stringify({ suggestion_index: suggestionIndex }),
    }),

  // --- Hot Leads ---
  getHotLeads: () =>
    request<any>("/api/hot-leads/my"),

  dismissHotLead: (alertId: string) =>
    request<any>(`/api/hot-leads/${alertId}/dismiss`, { method: "POST" }),

  // --- Pipeline ---
  getPipeline: () =>
    request<any>("/api/pipeline"),

  getPipelineStats: () =>
    request<any>("/api/pipeline/stats"),

  updateLeadPipelineStage: (leadId: string, data: { stage: string; notes?: string; deal_value?: number; lost_reason?: string }) =>
    request<any>(`/api/leads/${leadId}/pipeline-stage`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // --- Deals ---
  createDeal: (data: {
    lead_id: string;
    amount: number;
    currency?: string;
    setter_name?: string;
    closer_name?: string;
    source_content?: string;
    campaign?: string;
    notes?: string;
  }) =>
    request<any>("/api/deals", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getDealStats: (params?: { range?: string }) => {
    const qs = params?.range ? `?range=${params.range}` : "";
    return request<any>(`/api/deals/stats${qs}`);
  },

  getDeals: (params?: { from?: string; to?: string; setter?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    if (params?.setter) search.set("setter", params.setter);
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    return request<any>(`/api/deals?${search.toString()}`);
  },

  getAnalyticsOverview: () =>
    request<any>("/api/analytics/overview"),

  // --- Billing ---
  getBillingStatus: () =>
    request<any>("/api/billing/status"),

  createCheckout: (plan: string) =>
    request<any>("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan }) }),

  createBillingPortal: () =>
    request<any>("/api/billing/portal", { method: "POST" }),

  cancelSubscription: () =>
    request<any>("/api/billing/cancel", { method: "POST" }),

  // --- Team ---
  getTeam: () =>
    request<any>("/api/team"),

  addTeamMember: (data: { name: string; email?: string; role: string }) =>
    request<any>("/api/team", { method: "POST", body: JSON.stringify(data) }),

  updateTeamMember: (id: string, data: any) =>
    request<any>(`/api/team/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  removeTeamMember: (id: string) =>
    request<any>(`/api/team/${id}`, { method: "DELETE" }),

  getTeamPerformance: (params?: { from?: string; to?: string }) => {
    const search = new URLSearchParams();
    if (params?.from) search.set("from", params.from);
    if (params?.to) search.set("to", params.to);
    return request<any>(`/api/team/performance?${search.toString()}`);
  },

  // --- Lead Actions ---
  assignLead: (leadId: string, assigneeId: string) =>
    request<any>(`/api/leads/${leadId}/assign`, { method: "PUT", body: JSON.stringify({ assignee_id: assigneeId }) }),

  blockLead: (leadId: string) =>
    request<any>(`/api/leads/${leadId}/block`, { method: "POST" }),

  exportLeadsCsv: () =>
    request<any>("/api/leads/export/csv"),

  importLeadsCsv: (file: File) => {
    const token = getAuthToken();
    const companyId = getCompanyId();
    const formData = new FormData();
    formData.append("file", file);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (companyId) headers["x-company-id"] = companyId;
    return fetch(`${API_BASE}/api/leads/import/csv`, { method: "POST", headers, body: formData }).then(async (res) => {
      if (!res.ok) { const json = await res.json().catch(() => ({})); throw new Error(json?.error || `Import failed (${res.status})`); }
      return res.json();
    });
  },

  importLeadsManual: (data: string) =>
    request<any>("/api/leads/import/manual", { method: "POST", body: JSON.stringify({ data }) }),

  // --- Personas ---
  getPersonas: () =>
    request<any>("/api/chatbot/personas"),

  createPersona: (data: any) =>
    request<any>("/api/chatbot/personas", { method: "POST", body: JSON.stringify(data) }),

  updatePersona: (id: string, data: any) =>
    request<any>(`/api/chatbot/personas/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deletePersona: (id: string) =>
    request<any>(`/api/chatbot/personas/${id}`, { method: "DELETE" }),

  activatePersona: (id: string) =>
    request<any>(`/api/chatbot/personas/${id}/activate`, { method: "PUT" }),

  // --- Message Templates ---
  getTemplates: () =>
    request<any>("/api/chatbot/templates"),

  createTemplate: (data: any) =>
    request<any>("/api/chatbot/templates", { method: "POST", body: JSON.stringify(data) }),

  updateTemplate: (id: string, data: any) =>
    request<any>(`/api/chatbot/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteTemplate: (id: string) =>
    request<any>(`/api/chatbot/templates/${id}`, { method: "DELETE" }),

  // --- Autoresponder Rules ---
  getAutoresponderRules: () =>
    request<any>("/api/autoresponder/rules"),

  createAutoresponderRule: (data: any) =>
    request<any>("/api/autoresponder/rules", { method: "POST", body: JSON.stringify(data) }),

  updateAutoresponderRule: (id: string, data: any) =>
    request<any>(`/api/autoresponder/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteAutoresponderRule: (id: string) =>
    request<any>(`/api/autoresponder/rules/${id}`, { method: "DELETE" }),

  toggleAutoresponder: (enabled: boolean) =>
    request<any>("/api/autoresponder/toggle", { method: "PUT", body: JSON.stringify({ enabled }) }),

  // --- Unread count ---
  getUnreadCount: () =>
    request<any>("/api/notifications/unread-count"),

  // --- Clear all leads ---
  clearAllLeads: () =>
    request<any>("/api/leads/clear", { method: "DELETE" }),

  resetChatbotSettings: () =>
    request<any>("/api/chatbot/reset", { method: "POST" }),

  // --- Voice ---
  getVoiceSettings: () =>
    request<any>("/api/voice/settings"),

  updateVoiceSettings: (data: any) =>
    request<any>("/api/voice/settings", { method: "PUT", body: JSON.stringify(data) }),

  getVoices: () =>
    request<any>("/api/voice/voices"),

  getVoiceUsage: () =>
    request<any>("/api/voice/usage"),

  getVoiceClones: () =>
    request<any>("/api/voice/clones"),

  previewVoice: (data: { voice_id: string; text: string }) =>
    request<any>("/api/voice/preview", { method: "POST", body: JSON.stringify(data) }),

  testVoice: (data: { text: string }) =>
    request<any>("/api/voice/test", { method: "POST", body: JSON.stringify(data) }),

  cloneVoice: (name: string, description: string, files: File[]) => {
    const token = getAuthToken();
    const companyId = getCompanyId();
    const formData = new FormData();
    formData.append("name", name);
    if (description) formData.append("description", description);
    files.forEach((f) => formData.append("samples", f));
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (companyId) headers["x-company-id"] = companyId;
    return fetch(`${API_BASE}/api/voice/clone`, { method: "POST", headers, body: formData }).then(async (res) => {
      if (!res.ok) { const json = await res.json().catch(() => ({})); throw new Error(json?.error || `Clone failed (${res.status})`); }
      return res.json();
    });
  },

  deleteVoiceClone: (voiceId: string) =>
    request<any>(`/api/voice/clone/${voiceId}`, { method: "DELETE" }),

  compareVoices: (data: { text: string; voice_a: any; voice_b: any }) =>
    request<any>("/api/voice/compare", { method: "POST", body: JSON.stringify(data) }),

  // --- Handoff / Human-Break ---
  getHandoffRules: () =>
    request<any>("/api/handoff/rules"),

  createHandoffRule: (data: any) =>
    request<any>("/api/handoff/rules", { method: "POST", body: JSON.stringify(data) }),

  updateHandoffRule: (id: string, data: any) =>
    request<any>(`/api/handoff/rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteHandoffRule: (id: string) =>
    request<any>(`/api/handoff/rules/${id}`, { method: "DELETE" }),

  pauseBot: (leadId: string, reason?: string) =>
    request<any>(`/api/handoff/pause/${leadId}`, { method: "POST", body: JSON.stringify({ reason }) }),

  resumeBot: (leadId: string, instruction?: string) =>
    request<any>(`/api/handoff/resume/${leadId}`, { method: "POST", body: JSON.stringify({ instruction }) }),

  getHandoffStatus: (leadId: string) =>
    request<any>(`/api/handoff/status/${leadId}`),

  getActiveHandoffs: () =>
    request<any>("/api/handoff/active"),

  getHandoffLog: (params?: { limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return request<any>(`/api/handoff/log?${q.toString()}`);
  },

  getHandoffSettings: () =>
    request<any>("/api/handoff/settings"),

  updateHandoffSettings: (data: any) =>
    request<any>("/api/handoff/settings", { method: "PUT", body: JSON.stringify(data) }),

  // --- Warming / Follow-up Dashboard ---
  getWarmingSequences: () =>
    request<any>("/api/warming/sequences"),

  createWarmingSequence: (data: any) =>
    request<any>("/api/warming/sequences", { method: "POST", body: JSON.stringify(data) }),

  updateWarmingSequence: (id: string, data: any) =>
    request<any>(`/api/warming/sequences/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  deleteWarmingSequence: (id: string) =>
    request<any>(`/api/warming/sequences/${id}`, { method: "DELETE" }),

  getWarmingEnrollments: (status?: string) =>
    request<any>(`/api/warming/enrollments${status ? `?status=${status}` : ""}`),

  enrollLead: (data: { lead_id: string; sequence_id: string }) =>
    request<any>("/api/warming/enroll", { method: "POST", body: JSON.stringify(data) }),

  cancelEnrollment: (id: string) =>
    request<any>(`/api/warming/enrollments/${id}/cancel`, { method: "POST" }),

  pauseEnrollment: (id: string) =>
    request<any>(`/api/warming/enrollments/${id}/pause`, { method: "POST" }),

  resumeEnrollment: (id: string) =>
    request<any>(`/api/warming/enrollments/${id}/resume`, { method: "POST" }),

  skipEnrollmentStep: (id: string) =>
    request<any>(`/api/warming/enrollments/${id}/skip`, { method: "POST" }),

  getFollowUpDashboard: () =>
    request<any>("/api/warming/dashboard"),

  getFollowUpUpcoming: (limit?: number) =>
    request<any>(`/api/warming/dashboard/upcoming${limit ? `?limit=${limit}` : ""}`),

  getFollowUpTimeline: (leadId: string) =>
    request<any>(`/api/warming/dashboard/timeline/${leadId}`),

  getFollowUpStats: () =>
    request<any>("/api/warming/dashboard/stats"),

  getFollowUpAnalytics: (days?: number) =>
    request<any>(`/api/warming/analytics${days ? `?days=${days}` : ""}`),

  updateWarmingStep: (id: string, data: any) =>
    request<any>(`/api/warming/steps/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  markMessageReplied: (messageId: string, sentiment?: string) =>
    request<any>(`/api/warming/message-log/${messageId}/reply`, { method: "POST", body: JSON.stringify({ sentiment }) }),

  // --- Behavior Preview & Test ---
  getBehaviorPreview: () =>
    request<any>("/api/chatbot/behavior/preview"),

  testBehavior: (data: { message: string }) =>
    request<any>("/api/chatbot/behavior/test", { method: "POST", body: JSON.stringify(data) }),

  // --- Agent Identity (extended) ---
  getAgentIdentity: () =>
    request<any>("/api/chatbot/identity"),

  putAgentIdentity: (data: any) =>
    request<any>("/api/chatbot/identity", { method: "PUT", body: JSON.stringify(data) }),

  // --- AI Learning Ground ---
  analyzeStyle: (data: { texts: string[]; images?: string[] }) =>
    request<any>("/api/chatbot/learn-style", { method: "POST", body: JSON.stringify(data) }),

  // --- Conversation Strategy ---
  getConversationStrategy: () =>
    request<any>("/api/chatbot/strategy"),

  putConversationStrategy: (data: any) =>
    request<any>("/api/chatbot/strategy", { method: "PUT", body: JSON.stringify(data) }),

  // --- Guardrails ---
  getGuardrails: () =>
    request<any>("/api/chatbot/guardrails"),

  putGuardrails: (data: any) =>
    request<any>("/api/chatbot/guardrails", { method: "PUT", body: JSON.stringify(data) }),

  // --- Social Proof ---
  getSocialProof: () =>
    request<any>("/api/chatbot/social-proof"),

  putSocialProof: (data: any) =>
    request<any>("/api/chatbot/social-proof", { method: "PUT", body: JSON.stringify(data) }),

  getSocialProofImages: () =>
    request<any>("/api/chatbot/social-proof-images"),

  deleteSocialProofImage: (id: string) =>
    request<any>(`/api/chatbot/social-proof-images/${id}`, { method: "DELETE" }),

  uploadSocialProofImage: (file: File, caption: string) => {
    const token = getAuthToken();
    const companyId = getCompanyId();
    const formData = new FormData();
    formData.append("image", file);
    if (caption) formData.append("caption", caption);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (companyId) headers["x-company-id"] = companyId;
    return fetch(`${API_BASE}/api/chatbot/social-proof-images`, { method: "POST", headers, body: formData })
      .then(async (res) => {
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j?.error || "Upload failed"); }
        return res.json();
      });
  },

  // --- Booking Trigger ---
  getBookingSettings: () =>
    request<any>("/api/chatbot/booking-settings"),

  putBookingSettings: (data: any) =>
    request<any>("/api/chatbot/booking-settings", { method: "PUT", body: JSON.stringify(data) }),

  // --- Custom Quote Fields ---
  createCustomQuoteField: (data: { label: string; field_type: string }) =>
    request<any>("/api/chatbot/quote-fields/custom", { method: "POST", body: JSON.stringify(data) }),

  deleteQuoteField: (id: string) =>
    request<any>(`/api/chatbot/quote-fields/${id}`, { method: "DELETE" }),

  saveOperatingMode: (mode: string) =>
    request<any>("/api/settings/mode", { method: "PUT", body: JSON.stringify({ mode }) }),

  // --- Onboarding ---
  getOnboardingStatus: () =>
    request<any>("/api/onboarding/status"),

  completeOnboarding: () =>
    request<any>("/api/onboarding/complete", { method: "POST" }),

  // --- Webhook URL ---
  getWebhookUrl: () =>
    request<any>("/api/settings/webhook-url"),

  regenerateWebhookUrl: () =>
    request<any>("/api/settings/webhook-url/regenerate", { method: "POST" }),

  // --- Account ---
  updateProfile: (data: { name: string }) =>
    request<any>("/api/auth/profile", { method: "PUT", body: JSON.stringify(data) }),

  deleteAccount: () =>
    request<any>("/api/auth/account", { method: "DELETE" }),

  // --- Verification ---
  resendVerification: () =>
    request<any>("/api/auth/resend-verification", { method: "POST" }),

  sendPhoneCode: (phone_number: string) =>
    request<any>("/api/auth/send-phone-code", { method: "POST", body: JSON.stringify({ phone_number }) }),

  verifyPhone: (code: string) =>
    request<any>("/api/auth/verify-phone", { method: "POST", body: JSON.stringify({ code }) }),
};
