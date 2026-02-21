import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Switch } from "@/components/ui/switch";

interface NotifState {
  email_enabled: boolean;
  email_recipients: string[];
  notify_new_inquiry_inbox: boolean;
  notify_new_inquiry_simulation: boolean;
}

const DEFAULTS: NotifState = {
  email_enabled: false,
  email_recipients: [],
  notify_new_inquiry_inbox: true,
  notify_new_inquiry_simulation: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipients(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const NotificationSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Saved state (from backend)
  const [saved, setSaved] = useState<NotifState>(DEFAULTS);

  // Form state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const [notifyInbox, setNotifyInbox] = useState(true);
  const [notifySimulation, setNotifySimulation] = useState(false);
  const [validationError, setValidationError] = useState("");

  const populateForm = useCallback((s: NotifState) => {
    setEmailEnabled(s.email_enabled);
    setRecipientsRaw(s.email_recipients.join(", "));
    setNotifyInbox(s.notify_new_inquiry_inbox);
    setNotifySimulation(s.notify_new_inquiry_simulation);
    setValidationError("");
  }, []);

  useEffect(() => {
    api
      .getNotificationSettings()
      .then((data: any) => {
        const s: NotifState = {
          email_enabled: !!data.email_enabled,
          email_recipients: Array.isArray(data.email_recipients) ? data.email_recipients : [],
          notify_new_inquiry_inbox: data.notify_new_inquiry_inbox ?? true,
          notify_new_inquiry_simulation: !!data.notify_new_inquiry_simulation,
        };
        setSaved(s);
        populateForm(s);
      })
      .catch(() => {
        // Use defaults on error (new tenant, etc.)
        populateForm(DEFAULTS);
      })
      .finally(() => setLoading(false));
  }, [populateForm]);

  // Dirty detection
  const currentRecipients = parseRecipients(recipientsRaw);
  const isDirty =
    emailEnabled !== saved.email_enabled ||
    notifyInbox !== saved.notify_new_inquiry_inbox ||
    notifySimulation !== saved.notify_new_inquiry_simulation ||
    JSON.stringify(currentRecipients) !== JSON.stringify(saved.email_recipients);

  const validate = (): boolean => {
    if (emailEnabled && currentRecipients.length > 0) {
      const invalid = currentRecipients.filter((e) => !EMAIL_RE.test(e));
      if (invalid.length) {
        setValidationError(`Invalid email(s): ${invalid.join(", ")}`);
        return false;
      }
    }
    setValidationError("");
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: NotifState = {
        email_enabled: emailEnabled,
        email_recipients: currentRecipients,
        notify_new_inquiry_inbox: notifyInbox,
        notify_new_inquiry_simulation: notifySimulation,
      };
      await api.updateNotificationSettings(payload);
      setSaved(payload);
      setValidationError("");
      toast({ title: "Notification settings saved" });
    } catch (err: unknown) {
      toast({ title: "Failed to save settings", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-muted-foreground py-4">Loading…</div>;

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <div className="industrial-card p-6 space-y-5">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">Email Notifications</h2>
          <p className="text-xs text-muted-foreground mt-1">Email notifications for new inquiries</p>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Enable email notifications</label>
          <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
        </div>
      </div>

      {/* Recipients */}
      <div className="industrial-card p-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider">Recipient Emails</h2>
        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Recipients
          </label>
          <textarea
            value={recipientsRaw}
            onChange={(e) => {
              setRecipientsRaw(e.target.value);
              setValidationError("");
            }}
            placeholder="email@example.com, another@example.com"
            rows={2}
            className="industrial-input w-full resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">Separate multiple emails with commas</p>
          {validationError && (
            <p className="text-xs text-destructive mt-1">{validationError}</p>
          )}
        </div>
      </div>

      {/* Event toggles */}
      <div className="industrial-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider">Events</h2>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">New inquiry in Inbox</label>
          <Switch checked={notifyInbox} onCheckedChange={setNotifyInbox} />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">New inquiry in Simulation</label>
          <Switch checked={notifySimulation} onCheckedChange={setNotifySimulation} />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={isDirty ? "industrial-btn-accent" : "industrial-btn bg-muted text-muted-foreground"}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        <span className="ml-1">Save</span>
      </button>
    </div>
  );
};

export default NotificationSettings;
