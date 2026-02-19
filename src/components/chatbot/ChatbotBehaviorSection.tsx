import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Save, X } from "lucide-react";

const ChatbotBehaviorSection = () => {
  const [tone, setTone] = useState("professional");
  const [responseLength, setResponseLength] = useState("medium");
  const [emojisEnabled, setEmojisEnabled] = useState(false);
  const [personaStyle, setPersonaStyle] = useState("busy");
  const [forbiddenTopics, setForbiddenTopics] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getChatbotBehavior()
      .then((res) => {
        setTone(res.tone || "professional");
        setResponseLength(res.response_length || "medium");
        setEmojisEnabled(res.emojis_enabled ?? false);
        setPersonaStyle(res.persona_style || "busy");
        setForbiddenTopics(Array.isArray(res.forbidden_topics) ? res.forbidden_topics : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = () => {
    setSaving(true);
    api.putChatbotBehavior({
      tone,
      response_length: responseLength,
      emojis_enabled: emojisEnabled,
      persona_style: personaStyle,
      forbidden_topics: forbiddenTopics,
    })
      .then(() => toast({ title: "Saved", description: "Chatbot behavior updated." }))
      .catch(() => {})
      .finally(() => setSaving(false));
  };

  const addTopic = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !forbiddenTopics.includes(trimmed)) {
      setForbiddenTopics([...forbiddenTopics, trimmed]);
    }
    setTopicInput("");
  };

  const handleTopicKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTopic(topicInput);
    }
  };

  const handleTopicBlur = () => {
    if (topicInput.trim()) addTopic(topicInput);
  };

  const removeTopic = (index: number) => {
    setForbiddenTopics(forbiddenTopics.filter((_, i) => i !== index));
  };

  if (loading) return <div className="industrial-card p-6 text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="industrial-card p-6 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider">Chatbot Behaviour</h2>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value)} className="industrial-input w-full">
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Response Length</label>
          <select value={responseLength} onChange={(e) => setResponseLength(e.target.value)} className="industrial-input w-full">
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Persona</label>
          <select value={personaStyle} onChange={(e) => setPersonaStyle(e.target.value)} className="industrial-input w-full">
            <option value="busy">Busy type response</option>
            <option value="explanational">Explanational type response</option>
          </select>
          {personaStyle === "busy" && (
            <p className="mt-1 text-xs text-muted-foreground">
              No fluff. No confirmations like "Gotcha" or "Noted". Straight to the point.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Emojis</label>
          <button
            type="button"
            onClick={() => setEmojisEnabled(!emojisEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              emojisEnabled ? "bg-accent" : "bg-muted"
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-card transition-transform ${
              emojisEnabled ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
        </div>
      </div>

      {/* Forbidden Topics */}
      <div>
        <label className="mb-1.5 block text-xs font-mono uppercase tracking-wider text-muted-foreground">Forbidden Topics</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {forbiddenTopics.map((topic, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-1 text-xs font-mono">
              {topic}
              <button onClick={() => removeTopic(i)} className="text-muted-foreground hover:text-destructive">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <input
          value={topicInput}
          onChange={(e) => setTopicInput(e.target.value)}
          onKeyDown={handleTopicKeyDown}
          onBlur={handleTopicBlur}
          className="industrial-input w-full"
          placeholder="Type topic and press Enter or comma"
        />
      </div>

      <button onClick={handleSave} disabled={saving} className="industrial-btn-accent">
        <Save size={16} /> {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
};

export default ChatbotBehaviorSection;
