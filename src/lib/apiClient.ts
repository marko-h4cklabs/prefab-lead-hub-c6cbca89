const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// --- Token management ---

export function getAuthToken(): string | null {
  return localStorage.getItem("authToken");
}

export function setAuthToken(token: string) {
  localStorage.setItem("authToken", token);
}

export function clearAuth() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("companyId"); // clean up legacy key
}

/** Returns stored companyId (legacy helper used by pages to build URLs). */
export function getCompanyId(): string | null {
  return localStorage.getItem("companyId");
}

export function setCompanyId(id: string) {
  localStorage.setItem("companyId", id);
}

export function requireCompanyId(): string {
  const id = getCompanyId();
  if (!id) {
    window.location.href = "/login";
    throw new Error("No companyId");
  }
  return id;
}

// Legacy export kept so existing call-sites don't break
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // x-company-id is no longer sent — tenant is derived from JWT on the backend.

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
    } catch {
      // ignore
    }
    toast({ title: "Access denied", description: message, variant: "destructive" });
    throw new Error(message);
  }

  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const json = await res.json();
      message = json.error || json.message || JSON.stringify(json);
    } catch {
      try {
        const text = await res.text();
        if (text) message = text;
      } catch {
        // ignore
      }
    }
    toast({ title: `Error ${res.status}`, description: message, variant: "destructive" });
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  getCompany: (companyId: string) =>
    request<any>(`/api/companies/${companyId}`),

  patchCompany: (companyId: string, data: any) =>
    request<any>(`/api/companies/${companyId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

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

  // --- Auth ---
  login: (companyId: string) =>
    request<{ token: string; company_id: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ company_id: companyId }),
    }),
};
