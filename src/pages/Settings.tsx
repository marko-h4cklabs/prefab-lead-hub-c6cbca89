import { useEffect, useState } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { Save } from "lucide-react";

const Settings = () => {
  const companyId = requireCompanyId();
  const [tone, setTone] = useState("");
  const [duration, setDuration] = useState("");
  const [forbiddenTopics, setForbiddenTopics] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getCompany(companyId)
      .then((c) => {
        const style = c.chatbot_style || {};
        setTone(style.tone || "");
        setDuration(style.response_duration || "");
        setForbiddenTopics(
          Array.isArray(style.forbidden_topics)
            ? style.forbidden_topics.join(", ")
            : style.forbidden_topics || ""
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    const forbiddenArr = forbiddenTopics
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    api.patchCompany(companyId, {
      chatbot_style: {
        tone,
        response_duration: duration,
        forbidden_topics: forbiddenArr,
      },
    })
      .then(() => setSaved(true))
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-6">Settings</h1>

      <form onSubmit={handleSave} className="industrial-card p-6 space-y-5">
        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Chatbot Tone
          </label>
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="industrial-input w-full"
            placeholder="e.g. professional, friendly, concise"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Response Duration
          </label>
          <input
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="industrial-input w-full"
            placeholder="e.g. short, medium, long"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Forbidden Topics
          </label>
          <textarea
            value={forbiddenTopics}
            onChange={(e) => setForbiddenTopics(e.target.value)}
            className="industrial-input w-full h-24"
            placeholder="Comma-separated list of topics to avoid"
          />
          <p className="mt-1 text-xs text-muted-foreground">Separate topics with commas</p>
        </div>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="industrial-btn-accent">
            <Save size={16} /> {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span className="text-xs font-mono text-success">✓ Saved</span>}
        </div>
      </form>
    </div>
  );
};

export default Settings;
