import { useEffect, useState } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Activity, Loader2, Save, Wand2, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import NotificationSettings from "@/components/settings/NotificationSettings";
import SchedulingSettings from "@/components/settings/SchedulingSettings";

const TABS = ["General", "Scheduling", "Notifications"] as const;
type SettingsTab = (typeof TABS)[number];

const Settings = () => {
  const companyId = requireCompanyId();
  const [activeTab, setActiveTab] = useState<SettingsTab>("General");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyRole, setCompanyRole] = useState("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotData, setSnapshotData] = useState<any>(null);
  const [snapshotError, setSnapshotError] = useState("");

  // Account fields
  const [userEmail, setUserEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Instagram settings
  const [igAccountId, setIgAccountId] = useState("");
  const [igPageToken, setIgPageToken] = useState("");
  const [igLoading, setIgLoading] = useState(false);
  const [savingIg, setSavingIg] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getCompany(companyId),
      api.getMe().catch(() => null),
    ])
      .then(([c, me]) => {
        setCompanyName(c.company_name || c.name || "");
        setCompanyRole(c.role || c.user_role || "");
        if (me) {
          const email = me.email || me.user?.email || "";
          setUserEmail(email);
          setNewEmail(email);
        }
      })
      .catch((err: Error) => setFetchError(err.message || "Failed to load settings"))
      .finally(() => setLoading(false));

    // Load Instagram settings
    setIgLoading(true);
    api.getInstagramSettings()
      .then((res) => {
        setIgAccountId(res?.instagram_account_id || "");
        setIgPageToken(res?.meta_page_access_token || "");
      })
      .catch(() => {})
      .finally(() => setIgLoading(false));
  }, []);

  const handleEmailUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newEmail.trim();
    if (!trimmed || trimmed === userEmail) return;
    setSavingEmail(true);
    try {
      await api.updateEmail(trimmed);
      setUserEmail(trimmed);
      toast({ title: "Email updated successfully" });
    } catch (err: unknown) {
      toast({ title: "Failed to update email", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await api.updatePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated successfully" });
    } catch (err: unknown) {
      toast({ title: "Failed to update password", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (fetchError) return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-6">Settings</h1>
      <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">{fetchError}</div>
    </div>
  );

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold uppercase tracking-wider transition-colors -mb-px ${
              activeTab === tab
                ? "border-b-2 border-accent text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Notifications" ? (
        <NotificationSettings />
      ) : activeTab === "Scheduling" ? (
        <SchedulingSettings />
      ) : (
        <>
          {/* Company Info */}
          <div className="industrial-card p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Company</h2>
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Company Name</label>
              <p className="text-sm font-medium">{companyName || "—"}</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Role</label>
              <p className="text-sm font-medium capitalize">{companyRole || "—"}</p>
            </div>
          </div>

          {/* Account: Email */}
          <div className="industrial-card p-6 mt-6 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">Account</h2>
            <form onSubmit={handleEmailUpdate} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Email</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="industrial-input flex-1"
                    required
                  />
                  <button
                    type="submit"
                    disabled={savingEmail || newEmail.trim() === userEmail}
                    className="industrial-btn-primary"
                  >
                    {savingEmail ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span className="ml-1">Save</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Password change */}
            <form onSubmit={handlePasswordUpdate} className="space-y-3 border-t border-border pt-4">
              <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Change Password</label>
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="industrial-input w-full"
                required
              />
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="industrial-input w-full"
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="industrial-input w-full"
                required
              />
              <button
                type="submit"
                disabled={savingPassword || !currentPassword || !newPassword}
                className="industrial-btn-primary"
              >
                {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span className="ml-1">Update Password</span>
              </button>
            </form>
          </div>

          {/* Help & Setup */}
          <div className="industrial-card p-6 mt-6 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider">Help &amp; Support</h2>
            <p className="text-sm text-muted-foreground">
              Need assistance? Contact your account administrator or reach out to support.
            </p>
            <Link to="/onboarding" className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors">
              <Wand2 size={14} /> Setup Wizard
            </Link>
          </div>

          {/* Instagram Connection */}
          <div className="industrial-card p-6 mt-6 space-y-4">
            <div className="flex items-center gap-2">
              <Instagram size={16} className="text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Instagram Connection</h2>
            </div>
            {igLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Instagram Account ID</label>
                  <input
                    value={igAccountId}
                    onChange={(e) => setIgAccountId(e.target.value)}
                    className="industrial-input w-full"
                    placeholder="e.g. 17841400123456789"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Page Access Token</label>
                  <input
                    type="password"
                    value={igPageToken}
                    onChange={(e) => setIgPageToken(e.target.value)}
                    className="industrial-input w-full"
                    placeholder="Long-lived page access token"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!igAccountId.trim()) {
                      toast({ title: "Account ID is required", variant: "destructive" });
                      return;
                    }
                    setSavingIg(true);
                    try {
                      await api.saveInstagramSettings({
                        instagram_account_id: igAccountId.trim(),
                        meta_page_access_token: igPageToken.trim(),
                      });
                      toast({ title: "Instagram settings saved" });
                    } catch (err: unknown) {
                      toast({ title: "Failed to save", description: getErrorMessage(err), variant: "destructive" });
                    } finally {
                      setSavingIg(false);
                    }
                  }}
                  disabled={savingIg}
                  className="industrial-btn-primary"
                >
                  {savingIg ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span className="ml-1">Save</span>
                </button>
              </div>
            )}
          </div>

          {/* Admin Snapshot */}
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
        </>
      )}
    </div>
  );
};

export default Settings;
