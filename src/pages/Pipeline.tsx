import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Instagram, Flame, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const STAGES = [
  { id: "new_inquiry", label: "New Inquiry" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal_sent", label: "Proposal Sent" },
  { id: "call_booked", label: "Call Booked" },
  { id: "call_done", label: "Call Done" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" },
];

interface PipelineLead {
  id: string;
  name: string;
  stage: string;
  is_hot_lead?: boolean;
  intent_score?: number;
  budget_detected?: string | null;
  deal_value?: number | null;
  channel?: string;
  created_at?: string;
  updated_at?: string;
}

interface PipelineStats {
  pipeline_value?: number;
  won_value?: number;
  won_count?: number;
  conversion_rate?: number;
}

interface MoveModal {
  leadId: string;
  leadName: string;
  fromStage: string;
  toStage: string;
  notes: string;
  deal_value: string;
  lost_reason: string;
}

function scoreColor(score: number): string {
  if (score >= 81) return "hsl(48 92% 53%)";
  if (score >= 61) return "hsl(24 95% 53%)";
  if (score >= 31) return "hsl(217 91% 60%)";
  return "hsl(0 0% 35%)";
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const Pipeline = () => {
  const navigate = useNavigate();
  const [columns, setColumns] = useState<Record<string, PipelineLead[]>>({});
  const [stats, setStats] = useState<PipelineStats>({});
  const [loading, setLoading] = useState(true);
  const [moveModal, setMoveModal] = useState<MoveModal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getPipeline();
      const grouped: Record<string, PipelineLead[]> = {};
      STAGES.forEach((s) => (grouped[s.id] = []));
      const leads: PipelineLead[] = Array.isArray(data) ? data : data?.leads || data?.data || [];
      leads.forEach((l) => {
        const stage = l.stage || "new_inquiry";
        if (grouped[stage]) grouped[stage].push(l);
        else grouped["new_inquiry"].push(l);
      });
      setColumns(grouped);
    } catch {
      /* fail silently on poll */
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const s = await api.getPipelineStats();
      setStats(s || {});
    } catch {}
  }, []);

  useEffect(() => {
    Promise.all([fetchData(), fetchStats()]).finally(() => setLoading(false));
    const interval = setInterval(() => {
      fetchData();
      fetchStats();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchData, fetchStats]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;

    const fromStage = source.droppableId;
    const toStage = destination.droppableId;
    const lead = columns[fromStage]?.find((l) => l.id === draggableId);
    if (!lead) return;

    setMoveModal({
      leadId: lead.id,
      leadName: lead.name,
      fromStage,
      toStage,
      notes: "",
      deal_value: lead.deal_value?.toString() || "",
      lost_reason: "",
    });
  };

  const confirmMove = async () => {
    if (!moveModal) return;
    const { toStage } = moveModal;

    if (toStage === "closed_won" && !moveModal.deal_value) {
      toast({ title: "Deal value required", variant: "destructive" });
      return;
    }
    if (toStage === "closed_lost" && !moveModal.lost_reason.trim()) {
      toast({ title: "Lost reason required", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await api.updateLeadPipelineStage(moveModal.leadId, {
        stage: toStage,
        notes: moveModal.notes || undefined,
        deal_value: toStage === "closed_won" ? Number(moveModal.deal_value) : undefined,
        lost_reason: toStage === "closed_lost" ? moveModal.lost_reason : undefined,
      });

      // Move card locally
      setColumns((prev) => {
        const from = prev[moveModal.fromStage].filter((l) => l.id !== moveModal.leadId);
        const lead = prev[moveModal.fromStage].find((l) => l.id === moveModal.leadId);
        if (!lead) return prev;
        const updated = { ...lead, stage: toStage };
        const to = [...prev[toStage]];
        to.push(updated);
        return { ...prev, [moveModal.fromStage]: from, [toStage]: to };
      });

      setMoveModal(null);
      fetchStats();
    } catch (err: any) {
      toast({ title: "Failed to move lead", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelMove = () => setMoveModal(null);

  const fmt = (n?: number) => (n !== undefined && n !== null ? `€${n.toLocaleString()}` : "€0");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-2 pb-4 shrink-0">
        <h1 className="text-xl font-bold text-foreground">Pipeline</h1>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Pipeline Value: <span className="text-primary font-semibold">{fmt(stats.pipeline_value)}</span>
          </span>
          <span>
            Won: <span className="text-primary font-semibold">{fmt(stats.won_value)}</span>{" "}
            ({stats.won_count ?? 0} deals)
          </span>
          <span>
            Conversion: <span className="text-primary font-semibold">{stats.conversion_rate ?? 0}%</span>
          </span>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 h-full" style={{ minWidth: STAGES.length * 260 }}>
            {STAGES.map((stage) => {
              const leads = columns[stage.id] || [];
              const isWon = stage.id === "closed_won";
              const isLost = stage.id === "closed_lost";

              return (
                <Droppable droppableId={stage.id} key={stage.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex flex-col rounded-lg border border-border p-3 min-w-[240px] w-[240px] shrink-0 transition-colors ${
                        snapshot.isDraggingOver ? "bg-secondary/50" : "bg-muted"
                      }`}
                    >
                      {/* Column header */}
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className={`text-sm font-bold ${
                            isWon ? "text-success" : isLost ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {stage.label}
                        </span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {leads.length}
                        </span>
                      </div>

                      {/* Cards */}
                      <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px]">
                        {leads.length === 0 && (
                          <div className="flex flex-col items-center justify-center h-24 text-muted-foreground">
                            <Package size={18} className="mb-1 opacity-40" />
                            <span className="text-xs">No leads here</span>
                          </div>
                        )}

                        {leads.map((lead, idx) => (
                          <Draggable draggableId={lead.id} index={idx} key={lead.id}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                {...prov.dragHandleProps}
                                onClick={() => navigate(`/leads/${lead.id}`)}
                                className={`bg-card border border-border rounded-lg p-3 cursor-pointer transition-shadow hover:border-primary/40 ${
                                  snap.isDragging ? "shadow-lg shadow-primary/10" : ""
                                }`}
                              >
                                {/* Name */}
                                <div className="flex items-center gap-1 mb-2">
                                  <span className="text-sm font-bold text-foreground truncate">
                                    {lead.name}
                                  </span>
                                  {lead.is_hot_lead && <span className="text-xs">🔥</span>}
                                </div>

                                {/* Score bar */}
                                {lead.intent_score != null && (
                                  <div className="mb-2">
                                    <div
                                      className="h-1 rounded-full"
                                      style={{
                                        width: `${Math.min(lead.intent_score, 100)}%`,
                                        backgroundColor: scoreColor(lead.intent_score),
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Budget / Deal value */}
                                {lead.budget_detected && (
                                  <p className="text-xs text-success mb-1">💰 {lead.budget_detected}</p>
                                )}
                                {lead.deal_value != null && lead.deal_value > 0 && (
                                  <p className="text-xs text-primary mb-1">💵 €{lead.deal_value.toLocaleString()}</p>
                                )}

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-1">
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
                                    <Instagram size={10} />
                                    Instagram
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {timeAgo(lead.updated_at || lead.created_at)}
                                  </span>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Move confirmation modal */}
      <Dialog open={!!moveModal} onOpenChange={(open) => !open && cancelMove()}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Move "{moveModal?.leadName}" to {STAGES.find((s) => s.id === moveModal?.toStage)?.label}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Notes (optional)</label>
              <Textarea
                value={moveModal?.notes || ""}
                onChange={(e) => setMoveModal((m) => m && { ...m, notes: e.target.value })}
                placeholder="Add a note about this stage change..."
                className="bg-secondary border-border text-foreground"
              />
            </div>

            {moveModal?.toStage === "closed_won" && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Deal Value € *</label>
                <Input
                  type="number"
                  value={moveModal.deal_value}
                  onChange={(e) => setMoveModal((m) => m && { ...m, deal_value: e.target.value })}
                  placeholder="0"
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            )}

            {moveModal?.toStage === "closed_lost" && (
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Lost Reason *</label>
                <Input
                  value={moveModal.lost_reason}
                  onChange={(e) => setMoveModal((m) => m && { ...m, lost_reason: e.target.value })}
                  placeholder="Why was this lead lost?"
                  className="bg-secondary border-border text-foreground"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelMove} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={confirmMove} disabled={submitting} className="bg-primary text-primary-foreground">
              {submitting ? "Moving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pipeline;
