import { useEffect, useState } from "react";
import { api, requireCompanyId } from "@/lib/apiClient";
import { User, CheckCircle2, Circle, Send, Loader2, StickyNote, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  leadId: string;
}

const getScoreColor = (score: number) => {
  if (score >= 70) return "bg-success";
  if (score >= 40) return "bg-warning";
  return "bg-muted";
};

const CopilotLeadProfile = ({ leadId }: Props) => {
  const companyId = requireCompanyId();
  const [lead, setLead] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getLead(companyId, leadId).catch(() => null),
      api.getQuoteFields().catch(() => ({ fields: [] })),
      api.getLeadNotes(leadId, { limit: 10 }).catch(() => ({ notes: [] })),
    ]).then(([leadData, fieldsData, notesData]) => {
      setLead(leadData);
      const allFields = Array.isArray(fieldsData?.fields) ? fieldsData.fields : Array.isArray(fieldsData?.presets) ? fieldsData.presets : [];
      setFields(allFields.filter((f: any) => f.is_enabled));
      const notesList = Array.isArray(notesData?.notes) ? notesData.notes : Array.isArray(notesData) ? notesData : [];
      setNotes(notesList);
    }).finally(() => setLoading(false));
  }, [leadId, companyId]);

  const handleAddNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    setAddingNote(true);
    try {
      const created = await api.createLeadNote(leadId, { content: text });
      setNotes((prev) => [created, ...prev]);
      setNewNote("");
    } catch {
      toast({ title: "Failed to add note", variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="w-[300px] shrink-0 border-l border-border bg-[hsl(0_0%_4%)] flex items-center justify-center">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const parsedFields = lead?.parsed_fields || lead?.conversation?.parsed_fields || {};
  const score = lead?.score ?? 0;
  const name = lead?.name || "Unknown";
  const channel = lead?.channel || "instagram";
  const stage = lead?.pipeline_stage || "new";
  const qualStatus = score >= 70 ? "qualified" : score >= 40 ? "pending" : "unqualified";

  return (
    <div className="w-[300px] shrink-0 border-l border-border bg-[hsl(0_0%_4%)] flex flex-col h-full overflow-y-auto">
      {/* Lead info header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          {lead?.profile_pic ? (
            <img src={lead.profile_pic} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
              <User size={18} className="text-primary" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold text-foreground">{name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-muted-foreground capitalize">{channel}</span>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className="text-[10px] text-muted-foreground capitalize">{stage}</span>
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Lead Score</span>
            <span className="text-xs font-bold text-foreground">{score}/100</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full transition-all ${getScoreColor(score)}`} style={{ width: `${Math.min(score, 100)}%` }} />
          </div>
        </div>

        {/* Qualification */}
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            qualStatus === "qualified" ? "bg-success text-success-foreground" :
            qualStatus === "unqualified" ? "bg-destructive text-destructive-foreground" :
            "bg-muted text-muted-foreground"
          }`}>
            {qualStatus === "qualified" ? "Qualified" : qualStatus === "unqualified" ? "Unqualified" : "Pending"}
          </span>
        </div>
      </div>

      {/* Collected fields */}
      <div className="px-4 py-3 border-b border-border">
        <h4 className="text-xs font-bold text-foreground mb-2">Collected Fields</h4>
        <div className="space-y-1.5">
          {fields.map((field) => {
            const key = field.variable_name || field.name;
            const val = parsedFields[key] || parsedFields[field.name];
            const collected = val !== undefined && val !== null && val !== "";
            return (
              <div key={key} className="flex items-start gap-2">
                {collected ? (
                  <CheckCircle2 size={12} className="text-success shrink-0 mt-0.5" />
                ) : (
                  <Circle size={12} className="text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <span className="text-[11px] text-muted-foreground">{field.label || field.name}</span>
                  {collected && (
                    <p className="text-[11px] text-foreground truncate">{typeof val === "object" ? JSON.stringify(val) : String(val)}</p>
                  )}
                </div>
              </div>
            );
          })}
          {fields.length === 0 && (
            <p className="text-[11px] text-muted-foreground">No fields configured</p>
          )}
        </div>
      </div>

      {/* Quick notes */}
      <div className="px-4 py-3 flex-1">
        <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
          <StickyNote size={12} /> Notes
        </h4>
        <div className="flex gap-1.5 mb-2">
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddNote(); }}
            placeholder="Add a note..."
            className="dark-input flex-1 text-xs h-7"
            disabled={addingNote}
          />
          <button
            onClick={handleAddNote}
            disabled={!newNote.trim() || addingNote}
            className="h-7 w-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50"
          >
            {addingNote ? <Loader2 size={10} className="animate-spin" /> : <Plus size={12} />}
          </button>
        </div>
        <div className="space-y-1.5">
          {notes.map((note, i) => (
            <div key={note.id || i} className="bg-secondary/50 rounded-md px-2.5 py-1.5">
              <p className="text-[11px] text-foreground">{note.content || note.text}</p>
              {note.created_at && (
                <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(note.created_at).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CopilotLeadProfile;
