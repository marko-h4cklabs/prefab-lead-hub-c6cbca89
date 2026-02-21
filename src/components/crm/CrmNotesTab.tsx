import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, Save, Pencil, Trash2, AlertCircle } from "lucide-react";

interface Props {
  leadId: string;
}

export default function CrmNotesTab({ leadId }: Props) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [newContent, setNewContent] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(() => {
    setLoading(true);
    setError("");
    api.getLeadNotes(leadId, { limit: 50 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.items || res?.data || res?.notes || [];
        setNotes(list);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const handleCreate = async () => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      await api.createLeadNote(leadId, { content: trimmed });
      setNewContent("");
      toast({ title: "Note added" });
      fetchNotes();
    } catch (err) {
      toast({ title: "Failed to add note", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (noteId: string) => {
    const trimmed = editContent.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await api.updateLeadNote(leadId, noteId, { content: trimmed });
      setEditId(null);
      toast({ title: "Note updated" });
      fetchNotes();
    } catch (err) {
      toast({ title: "Failed to update note", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await api.deleteLeadNote(leadId, noteId);
      toast({ title: "Note deleted" });
      fetchNotes();
    } catch (err) {
      toast({ title: "Failed to delete note", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  if (error) {
    return (
      <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create */}
      <div className="space-y-2">
        <textarea
          className="industrial-input w-full min-h-[60px] resize-y"
          placeholder="Add a note…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          disabled={creating}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newContent.trim()}
          className={newContent.trim() ? "industrial-btn-accent" : "industrial-btn bg-muted text-muted-foreground"}
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No notes yet</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="border border-border rounded-sm p-3">
              {editId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    className="industrial-input w-full min-h-[60px] resize-y"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    disabled={saving}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(note.id)}
                      disabled={saving || !editContent.trim()}
                      className={editContent.trim() ? "industrial-btn-accent" : "industrial-btn bg-muted text-muted-foreground"}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                    <button onClick={() => setEditId(null)} className="industrial-btn-ghost text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {note.created_at ? new Date(note.created_at).toLocaleString() : ""}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditId(note.id); setEditContent(note.content || ""); }}
                        className="industrial-btn-ghost p-1"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="industrial-btn-ghost p-1 text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
