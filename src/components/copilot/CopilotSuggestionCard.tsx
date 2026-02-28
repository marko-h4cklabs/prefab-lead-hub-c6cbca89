import { useState } from "react";
import { Loader2, Send, Pencil, X } from "lucide-react";

interface Suggestion {
  id: string;
  text?: string;
  message?: string;
  label?: string;
  index: number;
}

const LABEL_STYLES: Record<string, { bg: string; text: string }> = {
  "Direct Closer": { bg: "bg-info", text: "text-info-foreground" },
  "Value Builder": { bg: "bg-success", text: "text-success-foreground" },
  "Curious Qualifier": { bg: "bg-primary", text: "text-primary-foreground" },
};

const FALLBACK_LABELS = [
  { name: "Direct", bg: "bg-info", text: "text-info-foreground" },
  { name: "Empathetic", bg: "bg-success", text: "text-success-foreground" },
  { name: "Strategic", bg: "bg-primary", text: "text-primary-foreground" },
];

interface Props {
  suggestion: Suggestion;
  labelIndex: number;
  sending: boolean;
  onSend: (text: string, isEdited: boolean) => void;
  shortcutKey?: number;
}

const CopilotSuggestionCard = ({ suggestion, labelIndex, sending, onSend, shortcutKey }: Props) => {
  const msgText = suggestion.text || suggestion.message || "";
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msgText);

  const labelName = suggestion.label || FALLBACK_LABELS[labelIndex]?.name || "Option";
  const style = LABEL_STYLES[suggestion.label || ""] || FALLBACK_LABELS[labelIndex] || FALLBACK_LABELS[0];

  const handleEdit = () => {
    setEditText(msgText);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditText(msgText);
  };

  const handleSend = () => {
    if (editing) {
      const trimmed = editText.trim();
      if (!trimmed) return;
      onSend(trimmed, true);
    } else {
      onSend(msgText, false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 transition-all hover:border-primary/30 group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${style.bg} ${style.text}`}>
            {labelName}
          </span>
          {shortcutKey !== undefined && (
            <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              Press {shortcutKey} to send
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {!editing && (
            <button
              onClick={handleEdit}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Pencil size={10} /> Edit
            </button>
          )}
          {editing && (
            <button
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={10} /> Cancel
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            Send
          </button>
        </div>
      </div>

      {editing ? (
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="dark-input w-full text-sm min-h-[60px] resize-y"
          autoFocus
        />
      ) : (
        <p className="text-sm text-foreground leading-relaxed">{msgText}</p>
      )}
    </div>
  );
};

export default CopilotSuggestionCard;
