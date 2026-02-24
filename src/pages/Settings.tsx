import { useEffect, useState, useRef } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Activity, Loader2, Save, Wand2, MessageSquare, Eye, EyeOff, Check, Bot, Sparkles, Upload, Download, AlertTriangle, Trash2, Copy, RefreshCw, Link2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import NotificationSettings from "@/components/settings/NotificationSettings";
import SchedulingSettings from "@/components/settings/SchedulingSettings";
import GoogleCalendarSettings from "@/components/settings/GoogleCalendarSettings";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

  // ManyChat settings
  const [mcApiKey, setMcApiKey] = useState("");
  const [mcApiKeyInitial, setMcApiKeyInitial] = useState("");
  const [mcPageId, setMcPageId] = useState("");
  const [mcPageIdInitial, setMcPageIdInitial] = useState("");
  const [mcLoading, setMcLoading] = useState(false);
  const [savingMc, setSavingMc] = useState(false);
  const [mcShowKey, setMcShowKey] = useState(false);
  const [mcSaveSuccess, setMcSaveSuccess] = useState(false);
  const [mcSaveError, setMcSaveError] = useState("");
  const mcSuccessTimer = useRef<ReturnType<typeof setTimeout>>();

  // Operating mode
  const [currentMode, setCurrentMode] = useState<string>("");
  const [modeLoading, setModeLoading] = useState(true);
  const [modeSaving, setModeSaving] = useState(false);
  const [modeSaved, setModeSaved] = useState(false);
  const modeTimer = useRef<ReturnType<typeof setTimeout>>();

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

    // Load ManyChat settings
    setMcLoading(true);
    api.getManychatSettings()
      .then((res) => {
        const key = res?.manychat_api_key || "";
        const pid = res?.manychat_page_id || "";
        setMcApiKey(key);
        setMcApiKeyInitial(key);
        setMcPageId(pid);
        setMcPageIdInitial(pid);
      })
      .catch(() => {})
      .finally(() => setMcLoading(false));

    // Load operating mode
    api.getOperatingMode()
      .then((res) => setCurrentMode(res?.operating_mode || ""))
      .catch(() => {})
      .finally(() => setModeLoading(false));
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
          {/* Operating Mode */}
          <div className="rounded-lg border border-border bg-card border-l-4 border-l-primary p-6 space-y-4 mb-6">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Operating Mode</h2>
              <p className="text-xs text-muted-foreground mt-1">Choose how your AI handles incoming Instagram DMs.</p>
            </div>
            {modeLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Autopilot */}
                  <button
                    onClick={() => { if (currentMode !== "autopilot") setCurrentMode("autopilot"); }}
                    className={`text-left rounded-lg p-4 border-2 transition-all ${
                      currentMode === "autopilot"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-secondary/30 hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🤖</span>
                      <span className="text-sm font-bold text-foreground">AI Autopilot</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Recommended</span>
                      {currentMode === "autopilot" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium ml-auto">Active</span>}
                    </div>
                    <p className="text-xs font-medium text-foreground/80 mb-1">Fully automated — AI handles everything</p>
                    <p className="text-[11px] text-muted-foreground">Every Instagram DM is automatically read, processed, and replied to by the AI without any human involvement. Perfect for high-volume businesses or when you're not available 24/7.</p>
                  </button>

                  {/* Co-Pilot */}
                  <button
                    onClick={() => { if (currentMode !== "copilot") setCurrentMode("copilot"); }}
                    className={`text-left rounded-lg p-4 border-2 transition-all ${
                      currentMode === "copilot"
                        ? "border-primary bg-primary/5"
                        : "border-border bg-secondary/30 hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🧠</span>
                      <span className="text-sm font-bold text-foreground">AI Co-Pilot</span>
                      {currentMode === "copilot" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success font-medium ml-auto">Active</span>}
                    </div>
                    <p className="text-xs font-medium text-foreground/80 mb-1">AI assists, you decide</p>
                    <p className="text-[11px] text-muted-foreground">The AI reads each DM and prepares a suggested reply, but YOU review and send it manually from the Inbox. Full control over every message sent.</p>
                    <p className="text-[10px] text-primary mt-1.5">⚠️ Requires you to actively monitor the Inbox to respond to leads</p>
                  </button>
                </div>

                <button
                  onClick={async () => {
                    setModeSaving(true);
                    try {
                      await api.setOperatingMode(currentMode);
                      setModeSaved(true);
                      if (modeTimer.current) clearTimeout(modeTimer.current);
                      modeTimer.current = setTimeout(() => setModeSaved(false), 2000);
                    } catch { /* toast handled */ }
                    finally { setModeSaving(false); }
                  }}
                  disabled={modeSaving}
                  className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                >
                  {modeSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {modeSaving ? "Saving…" : "Save Mode"}
                </button>
                {modeSaved && <p className="text-xs text-success flex items-center gap-1"><Check size={12} /> Saved</p>}
              </div>
            )}
          </div>

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

          {/* ManyChat Connection */}
          <div className="mt-6 rounded-lg border border-[hsl(0_0%_16.5%)] bg-[hsl(0_0%_10%)] border-l-4 border-l-primary space-y-4 p-6">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider">ManyChat Connection</h2>
            </div>

            {/* Connection status */}
            {!mcLoading && (
              <div className="flex items-center gap-2">
                {mcApiKeyInitial && mcPageIdInitial ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-xs font-medium text-green-500">Connected</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Not configured</span>
                  </>
                )}
              </div>
            )}

            {mcLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-4">
                {/* API Key */}
                <div>
                  <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">ManyChat API Key</label>
                  <div className="relative">
                    <input
                      type={mcShowKey ? "text" : "password"}
                      value={mcApiKey}
                      onChange={(e) => setMcApiKey(e.target.value)}
                      className="industrial-input w-full pr-10"
                      placeholder="Paste your ManyChat API key"
                    />
                    <button
                      type="button"
                      onClick={() => setMcShowKey((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {mcShowKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Find this in ManyChat → Settings → API</p>
                </div>

                {/* Page ID */}
                <div>
                  <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">ManyChat Page ID</label>
                  <input
                    type="text"
                    value={mcPageId}
                    onChange={(e) => setMcPageId(e.target.value)}
                    className="industrial-input w-full"
                    placeholder="e.g. fb4424565"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Found in your ManyChat dashboard URL: app.manychat.com/YOUR_PAGE_ID/...</p>
                </div>

                {/* Save button */}
                <button
                  onClick={async () => {
                    setMcSaveError("");
                    setSavingMc(true);
                    try {
                      const body: Record<string, string> = {};
                      if (mcApiKey.trim() !== mcApiKeyInitial) body.manychat_api_key = mcApiKey.trim();
                      if (mcPageId.trim() !== mcPageIdInitial) body.manychat_page_id = mcPageId.trim();
                      if (Object.keys(body).length === 0) {
                        setSavingMc(false);
                        return;
                      }
                      await api.saveManychatSettings(body as any);
                      setMcApiKeyInitial(mcApiKey.trim());
                      setMcPageIdInitial(mcPageId.trim());
                      setMcSaveSuccess(true);
                      if (mcSuccessTimer.current) clearTimeout(mcSuccessTimer.current);
                      mcSuccessTimer.current = setTimeout(() => setMcSaveSuccess(false), 2000);
                    } catch (err: unknown) {
                      setMcSaveError(getErrorMessage(err));
                    } finally {
                      setSavingMc(false);
                    }
                  }}
                  disabled={savingMc || mcSaveSuccess}
                  className="w-full rounded-md bg-primary text-primary-foreground font-semibold py-2.5 px-4 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {savingMc ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : mcSaveSuccess ? (
                    <>
                      <Check size={16} />
                      <span>Saved</span>
                    </>
                  ) : (
                    <span>Save ManyChat Settings</span>
                  )}
                </button>

                {mcSaveError && (
                  <p className="text-sm text-destructive">{mcSaveError}</p>
                )}
              </div>
            )}
          </div>

          {/* ManyChat Webhook URL */}
          <WebhookUrlSection />

          {/* Google Calendar */}
          <GoogleCalendarSettings />

          {/* Lead Import/Export */}
          <LeadManagementSection />

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

          {/* Danger Zone */}
          <DangerZoneSection />
        </>
      )}
    </div>
  );
};

function LeadManagementSection() {
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<"csv" | "manual">("csv");
  const [manualData, setManualData] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = async (file: File) => {
    setImporting(true);
    try {
      const res = await api.importLeadsCsv(file);
      toast({ title: "Import complete", description: `${res?.count ?? res?.imported ?? 0} leads imported` });
      setImportModalOpen(false);
    } catch (err) {
      toast({ title: "Import failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setImporting(false); }
  };

  const handleManualImport = async () => {
    if (!manualData.trim()) return;
    setImporting(true);
    try {
      const res = await api.importLeadsManual(manualData.trim());
      toast({ title: "Import complete", description: `${res?.count ?? res?.imported ?? 0} leads imported` });
      setImportModalOpen(false);
      setManualData("");
    } catch (err) {
      toast({ title: "Import failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setImporting(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.exportLeadsCsv();
      const csv = typeof res === "string" ? res : res?.csv || res?.data || JSON.stringify(res);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `leads_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    } catch (err) {
      toast({ title: "Export failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setExporting(false); }
  };

  return (
    <div className="industrial-card p-6 mt-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
        <Upload size={14} className="text-primary" /> Lead Management
      </h2>
      <div className="flex gap-3">
        <button onClick={() => setImportModalOpen(true)} className="dark-btn-primary text-sm"><Upload size={14} /> Import Leads</button>
        <button onClick={handleExport} disabled={exporting} className="dark-btn-secondary text-sm">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Export All Leads
        </button>
      </div>

      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Import Leads</DialogTitle></DialogHeader>
          <div className="flex gap-1 mb-4">
            <button onClick={() => setImportTab("csv")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${importTab === "csv" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>CSV Upload</button>
            <button onClick={() => setImportTab("manual")} className={`px-3 py-1.5 rounded-md text-xs font-medium ${importTab === "manual" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>Manual</button>
          </div>
          {importTab === "csv" ? (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors" onClick={() => fileInputRef.current?.click()}>
                <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Click to upload CSV file</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleCsvImport(e.target.files[0])} />
              </div>
              {importing && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Importing…</div>}
            </div>
          ) : (
            <div className="space-y-3">
              <textarea value={manualData} onChange={(e) => setManualData(e.target.value)} className="dark-input w-full min-h-[120px] resize-y" placeholder="Paste comma-separated names/emails:&#10;John Doe, john@example.com&#10;Jane Smith, jane@example.com" />
              <button onClick={handleManualImport} disabled={importing || !manualData.trim()} className="w-full dark-btn-primary">
                {importing ? <Loader2 size={14} className="animate-spin" /> : null} Import
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WebhookUrlSection() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [mcStatus, setMcStatus] = useState<"connected" | "not_connected" | "loading">("loading");

  useEffect(() => {
    api.getWebhookUrl()
      .then((res) => setWebhookUrl(res?.webhook_url || res?.url || ""))
      .catch(() => {})
      .finally(() => setLoading(false));
    api.getManychatSettings()
      .then((res) => setMcStatus(res?.manychat_api_key && res?.manychat_page_id ? "connected" : "not_connected"))
      .catch(() => setMcStatus("not_connected"));
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!confirm("Are you sure? The old webhook URL will stop working immediately. You'll need to update it in ManyChat.")) return;
    setRegenerating(true);
    try {
      const res = await api.regenerateWebhookUrl();
      setWebhookUrl(res?.webhook_url || res?.url || "");
      toast({ title: "Webhook URL regenerated" });
    } catch (err) {
      toast({ title: "Failed to regenerate", description: getErrorMessage(err), variant: "destructive" });
    } finally { setRegenerating(false); }
  };

  return (
    <div className="mt-6 rounded-lg border border-border bg-card border-l-4 border-l-primary space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider">ManyChat Webhook</h2>
      </div>
      <p className="text-xs text-muted-foreground">Copy this URL into ManyChat to receive Instagram DMs.</p>

      {/* Status */}
      <div className="flex items-center gap-2">
        {mcStatus === "loading" ? (
          <Loader2 size={12} className="animate-spin text-muted-foreground" />
        ) : mcStatus === "connected" ? (
          <><span className="h-2 w-2 rounded-full bg-success" /><span className="text-xs font-medium text-success">Active</span></>
        ) : (
          <><span className="h-2 w-2 rounded-full bg-destructive" /><span className="text-xs font-medium text-destructive">Inactive</span></>
        )}
      </div>

      {loading ? (
        <div className="h-10 bg-secondary animate-pulse rounded-md" />
      ) : webhookUrl ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-muted rounded-md px-3 py-2.5 text-xs text-foreground font-mono break-all select-all">{webhookUrl}</code>
          <button onClick={handleCopy} className="dark-btn-ghost p-2 shrink-0">
            {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No webhook URL available. Complete onboarding to generate one.</p>
      )}

      <button onClick={handleRegenerate} disabled={regenerating} className="dark-btn-secondary text-xs">
        {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        <span className="ml-1">Regenerate URL</span>
      </button>
    </div>
  );
}

function DangerZoneSection() {
  const [confirmText, setConfirmText] = useState("");
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleClearLeads = async () => {
    if (confirmText !== "DELETE") return;
    setClearing(true);
    try {
      await api.clearAllLeads();
      toast({ title: "All leads cleared" });
      setClearModalOpen(false);
      setConfirmText("");
    } catch (err) {
      toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setClearing(false); }
  };

  const handleResetChatbot = async () => {
    if (!confirm("Reset all chatbot settings to defaults? This cannot be undone.")) return;
    setResetting(true);
    try {
      await api.resetChatbotSettings();
      toast({ title: "Chatbot settings reset to defaults" });
    } catch (err) {
      toast({ title: "Failed", description: getErrorMessage(err), variant: "destructive" });
    } finally { setResetting(false); }
  };

  return (
    <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-destructive flex items-center gap-2">
        <AlertTriangle size={14} /> Danger Zone
      </h2>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setClearModalOpen(true)} className="dark-btn border border-destructive text-destructive hover:bg-destructive/10 text-sm">
          <Trash2 size={14} /> Clear All Leads
        </button>
        <button onClick={handleResetChatbot} disabled={resetting} className="dark-btn border border-destructive/50 text-destructive/70 hover:bg-destructive/10 text-sm">
          {resetting ? <Loader2 size={14} className="animate-spin" /> : null} Reset Chatbot Settings
        </button>
      </div>

      <Dialog open={clearModalOpen} onOpenChange={setClearModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-destructive">Clear All Leads</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete all leads and their conversations. Type <strong>DELETE</strong> to confirm.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="dark-input w-full" placeholder='Type "DELETE"' />
          <button onClick={handleClearLeads} disabled={clearing || confirmText !== "DELETE"} className="w-full dark-btn-destructive">
            {clearing ? <Loader2 size={14} className="animate-spin" /> : null} Confirm Delete All Leads
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Settings;
