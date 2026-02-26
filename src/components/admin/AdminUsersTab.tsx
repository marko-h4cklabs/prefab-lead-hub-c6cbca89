import { useState, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

const str = (v: unknown): string => (v == null ? "" : typeof v === "object" ? "" : String(v));

function normalizeList(payload: unknown, keys: string[] = []): any[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const k of keys) {
      if (Array.isArray((payload as any)[k])) return (payload as any)[k];
    }
  }
  return [];
}

export default function AdminUsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    api.adminGetUsers()
      .then((res) => setUsers(normalizeList(res, ["data", "users", "items"])))
      .catch((e: any) => setError(e?.message || "Failed"))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (user: any) => {
    const isCurrentlyAdmin = user.is_admin || user.role === "admin";

    // If granting admin, show confirmation first
    if (!isCurrentlyAdmin) {
      setConfirmingId(user.id);
      return;
    }

    await doToggle(user);
  };

  const doToggle = async (user: any) => {
    setTogglingId(user.id);
    setConfirmingId(null);
    try {
      await api.adminToggleAdmin(user.id);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, is_admin: !u.is_admin, role: u.is_admin ? "user" : "admin" }
            : u
        )
      );
    } catch (e: any) {
      setError(e?.message || "Failed to toggle admin");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border overflow-hidden" style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  }

  return (
    <div>
      {error && <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

      <div className="rounded-lg border overflow-x-auto" style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "#2A2A2A" }}>
              {["Name", "Email", "Company", "Created", "Admin"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No users</td></tr>
            ) : (
              users.map((u) => {
                const isAdmin = u.is_admin || u.role === "admin";
                return (
                  <tr key={u.id} className="border-b hover:bg-secondary/20 transition-colors" style={{ borderColor: "#2A2A2A" }}>
                    <td className="px-4 py-3 font-semibold">{str(u.name) || str(u.full_name) || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{str(u.email) || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{str(u.company_name) || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{str(u.created_at) ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      {togglingId === u.id ? (
                        <Loader2 size={16} className="animate-spin text-muted-foreground" />
                      ) : (
                        <button
                          onClick={() => handleToggle(u)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            isAdmin ? "bg-red-500" : "bg-secondary"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              isAdmin ? "translate-x-4" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation dialog */}
      {confirmingId && (() => {
        const user = users.find((u) => u.id === confirmingId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70" onClick={() => setConfirmingId(null)} />
            <div className="relative rounded-lg border p-6 max-w-sm w-full" style={{ background: "#1A1A1A", borderColor: "#2A2A2A" }}>
              <h3 className="text-sm font-bold mb-2">Grant Admin Access</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to give admin access to <span className="font-semibold text-foreground">{str(user?.name) || str(user?.email) || "this user"}</span>? This gives full platform access.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmingId(null)}
                  className="text-sm px-3 py-1.5 rounded border transition-colors hover:bg-secondary"
                  style={{ borderColor: "#2A2A2A" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => user && doToggle(user)}
                  className="text-sm px-3 py-1.5 rounded font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
