import { useEffect, useState } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Save, Activity, Loader2 } from "lucide-react";

const Settings = () => {
  const companyId = requireCompanyId();
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [snapshotError, setSnapshotError] = useState("");

  useEffect(() => {
    api.getCompany(companyId)
      .then((c) => {
        setCompanyName(c.company_name || c.name || "");
        setCompanyRole(c.role || c.user_role || "");
      })
      .catch((err: Error) => setFetchError(err.message || "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (fetchError) return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-6">Settings</h1>
      <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{fetchError}</div>
    </div>
  );

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      {/* Account Info */}
      <div className="industrial-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider">Account</h2>
        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Company Name</label>
          <p className="text-sm font-medium">{companyName || "—"}</p>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Role</label>
          <p className="text-sm font-medium capitalize">{companyRole || "—"}</p>
        </div>
      </div>

      {/* Help */}
      <div className="industrial-card p-6 mt-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider">Help &amp; Support</h2>
        <p className="text-sm text-muted-foreground">
          Need assistance? Contact your account administrator or reach out to support.
        </p>
      </div>

      {/* Admin Snapshot — visible for owner/admin roles */}
      {(companyRole === "owner" || companyRole === "admin") && (
        <div className="industrial-card p-6 mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider">Admin: Analytics Snapshot</h2>
            <button
              onClick={() => {
                setSnapshotLoading(true);
                setSnapshotError("");
                setSnapshotData(null);
                api.runSnapshot()
                  .then(setSnapshotData)
                  .catch((err: Error) => setSnapshotError(err.message || "Snapshot failed"))
                  .finally(() => setSnapshotLoading(false));
              }}
              disabled={snapshotLoading}
              className="industrial-btn-primary"
            >
              {snapshotLoading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              <span className="ml-1.5">{snapshotLoading ? "Running…" : "Run Snapshot"}</span>
            </button>
          </div>

          {snapshotError && (
            <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {snapshotError}
            </div>
          )}

          {snapshotData && (
            <pre className="overflow-auto max-h-80 rounded-sm bg-muted p-4 text-xs font-mono">
              {JSON.stringify(snapshotData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export default Settings;
