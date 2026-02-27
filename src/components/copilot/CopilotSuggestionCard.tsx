import { useState } from "react";
import { Loader2, Send, Pencil, X } from "lucide-react";

interface Suggestion {
  id: string;
  message: string;
  label?: string;
  index: number;
}

const LABELS = [
  { name: "Direct", bg: "bg-info", text: "text-info-foreground" },
  { name: "Empathetic", bg: "bg-success", text: "text-success-foreground" },
  { name: "Strategic", bg: "bg-primary", text: "text-primary-foreground" },
];

interface Props {
  suggestion: Suggestion;
  labelIndex: number;
  sending: boolean;
  onSend: (text: string, isEdited: boolean) => void;
}

const CopilotSuggestionCard = ({ suggestion, labelIndex, sending, onSend }: Props) => {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(suggestion.message);
  const label = LABELS[labelIndex] || LABELS[0];

  const handleEdit = () => {
    setEditText(suggestion.message);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditText(suggestion.message);
  };

  const handleSend = () => {
    if (editing) {
      const trimmed = editText.trim();
      if (!trimmed) return;
      onSend(trimmed, true);
    } else {
      onSend(suggestion.message, false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 transition-all hover:border-primary/30">
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${label.bg} ${label.text}`}>
          {label.name}
        </span>
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
        <p className="text-sm text-foreground leading-relaxed">{suggestion.message}</p>
      )}
    </div>
  );
};

export default CopilotSuggestionCard;
