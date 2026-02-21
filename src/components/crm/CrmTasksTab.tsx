import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, RotateCcw, XCircle, AlertCircle, Calendar } from "lucide-react";

const STATUS_FILTERS = ["all", "open", "done", "cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const statusBadgeClass = (s: string) => {
  if (s === "done") return "status-qualified";
  if (s === "cancelled") return "status-disqualified";
  return "status-new";
};

interface Props {
  leadId: string;
}

export default function CrmTasksTab({ leadId }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDue, setEditDue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    setError("");
    api.getLeadTasks(leadId, { limit: 50 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.items || res?.data || res?.tasks || [];
        setTasks(list);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [leadId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const payload: any = { title: title.trim() };
      if (description.trim()) payload.description = description.trim();
      if (dueAt) payload.due_at = new Date(dueAt).toISOString();
      await api.createLeadTask(leadId, payload);
      setTitle(""); setDescription(""); setDueAt(""); setShowCreate(false);
      toast({ title: "Task created" });
      fetchTasks();
    } catch (err) {
      toast({ title: "Failed to create task", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    try {
      await api.updateLeadTask(leadId, taskId, { status });
      toast({ title: `Task ${status}` });
      fetchTasks();
    } catch (err) {
      toast({ title: "Failed to update task", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const handleUpdate = async (taskId: string) => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      const payload: any = { title: editTitle.trim() };
      if (editDesc.trim()) payload.description = editDesc.trim();
      else payload.description = "";
      if (editDue) payload.due_at = new Date(editDue).toISOString();
      else payload.due_at = null;
      await api.updateLeadTask(leadId, taskId, payload);
      setEditId(null);
      toast({ title: "Task updated" });
      fetchTasks();
    } catch (err) {
      toast({ title: "Failed to update task", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await api.deleteLeadTask(leadId, taskId);
      toast({ title: "Task deleted" });
      fetchTasks();
    } catch (err) {
      toast({ title: "Failed to delete task", description: getErrorMessage(err), variant: "destructive" });
    }
  };

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  if (error) {
    return (
      <div className="rounded-sm border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header + create toggle */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs font-mono uppercase rounded-sm transition-colors ${
                filter === f
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="industrial-btn-primary text-xs py-1.5 px-3">
          <Plus size={13} /> New Task
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="border border-border rounded-sm p-3 space-y-2">
          <input
            className="industrial-input w-full"
            placeholder="Task title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="industrial-input w-full min-h-[40px] resize-y"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-muted-foreground" />
            <input
              type="datetime-local"
              className="industrial-input text-xs py-1"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !title.trim()}
              className={title.trim() ? "industrial-btn-accent" : "industrial-btn bg-muted text-muted-foreground"}
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="industrial-btn-ghost text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading tasks…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {filter === "all" ? "No tasks yet" : `No ${filter} tasks`}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => (
            <div key={task.id} className="border border-border rounded-sm p-3">
              {editId === task.id ? (
                <div className="space-y-2">
                  <input
                    className="industrial-input w-full"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <textarea
                    className="industrial-input w-full min-h-[40px] resize-y"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description"
                  />
                  <input
                    type="datetime-local"
                    className="industrial-input text-xs py-1"
                    value={editDue}
                    onChange={(e) => setEditDue(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(task.id)}
                      disabled={saving || !editTitle.trim()}
                      className={editTitle.trim() ? "industrial-btn-accent" : "industrial-btn bg-muted text-muted-foreground"}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                      Save
                    </button>
                    <button onClick={() => setEditId(null)} className="industrial-btn-ghost text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </span>
                        <span className={statusBadgeClass(task.status)}>{task.status || "open"}</span>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                      {task.due_at && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar size={11} /> Due: {new Date(task.due_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      {task.status !== "done" && (
                        <button onClick={() => handleStatusChange(task.id, "done")} className="industrial-btn-ghost p-1" title="Mark done">
                          <CheckCircle2 size={14} className="text-success" />
                        </button>
                      )}
                      {task.status === "done" && (
                        <button onClick={() => handleStatusChange(task.id, "open")} className="industrial-btn-ghost p-1" title="Reopen">
                          <RotateCcw size={14} />
                        </button>
                      )}
                      {task.status !== "cancelled" && task.status !== "done" && (
                        <button onClick={() => handleStatusChange(task.id, "cancelled")} className="industrial-btn-ghost p-1" title="Cancel">
                          <XCircle size={14} className="text-destructive" />
                        </button>
                      )}
                      <button
                        onClick={() => { setEditId(task.id); setEditTitle(task.title || ""); setEditDesc(task.description || ""); setEditDue(task.due_at ? task.due_at.slice(0, 16) : ""); }}
                        className="industrial-btn-ghost p-1"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(task.id)} className="industrial-btn-ghost p-1 text-destructive" title="Delete">
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
