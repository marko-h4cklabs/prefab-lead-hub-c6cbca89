const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

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

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();

  const companyId = getCompanyId();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (companyId) {
    headers["x-company-id"] = companyId;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    clearAuth();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (res.status === 403) {
    let message = "Not authorized";
    try {
      const json = await res.json();
      message = json.error || json.message || message;
    } catch { /* ignore */ }
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
      try {
        const text = await res.text();
        if (text) message = text;
      } catch { /* ignore */ }
    }
    toast({ title: `Error ${res.status}`, description: message, variant: "destructive" });
    throw Object.assign(new Error(message), details ? { details } : {});
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  // --- Auth ---
  login: (email: string, password: string) =>
    request<{ token: string; company_id?: string; user?: { companyId: string }; role?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signup: (companyName: string, email: string, password: string) =>
    request<{ token: string; companyId: string }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ companyName, email, password }),
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

  // --- Admin ---
  runSnapshot: () =>
    request<any>("/api/admin/snapshot", { method: "POST" }),
};
