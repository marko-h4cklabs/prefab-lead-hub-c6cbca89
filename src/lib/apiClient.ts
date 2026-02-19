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
    try {
      const json = await res.json();
      const raw = json?.error?.message || json?.error || json?.message || json;
      message = typeof raw === "string" ? raw : JSON.stringify(raw);
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch { /* ignore */ }
    }
    toast({ title: `Error ${res.status}`, description: String(message), variant: "destructive" });
    throw new Error(String(message));
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  // --- Auth ---
  login: (email: string, password: string) =>
    request<{ token: string; company_id: string }>("/api/auth/login", {
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
  getLeads: (companyId: string, params: { status?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    if (params.offset !== undefined) search.set("offset", String(params.offset));
    return request<any>(`/api/companies/${companyId}/leads?${search.toString()}`);
  },

  createLead: (companyId: string, data: { channel: string; external_id: string }) =>
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

  // --- Admin ---
  runSnapshot: () =>
    request<any>("/api/admin/snapshot", { method: "POST" }),
};
