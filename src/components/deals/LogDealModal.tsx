import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface LogDealModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (deal: any) => void;
  leadId: string;
  leadName?: string;
  prefillAmount?: string;
}

const LogDealModal = ({ open, onClose, onSuccess, leadId, leadName, prefillAmount }: LogDealModalProps) => {
  const [amount, setAmount] = useState(prefillAmount || "");
  const [currency, setCurrency] = useState("EUR");
  const [setter, setSetter] = useState("");
  const [closer, setCloser] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [campaign, setCampaign] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setAmount(prefillAmount || "");
    setCurrency("EUR");
    setSetter("");
    setCloser("");
    setSourceContent("");
    setCampaign("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Deal amount is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const deal = await api.createDeal({
        lead_id: leadId,
        amount: Number(amount),
        currency,
        setter_name: setter || undefined,
        closer_name: closer || undefined,
        source_content: sourceContent || undefined,
        campaign: campaign || undefined,
        notes: notes || undefined,
      });
      toast({ title: "Deal logged! 💵", className: "bg-success text-success-foreground" });
      reset();
      onSuccess?.(deal);
      onClose();
    } catch (err: any) {
      toast({ title: "Failed to log deal", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Log Closed Deal{leadName ? ` — ${leadName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Amount */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Deal Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">€</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="bg-secondary border-border text-foreground pl-7"
                min={0}
              />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="bg-secondary border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Setter */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Setter Name</label>
            <Input
              value={setter}
              onChange={(e) => setSetter(e.target.value)}
              placeholder="Optional"
              className="bg-secondary border-border text-foreground"
            />
          </div>

          {/* Closer */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Closer Name</label>
            <Input
              value={closer}
              onChange={(e) => setCloser(e.target.value)}
              placeholder="Optional"
              className="bg-secondary border-border text-foreground"
            />
          </div>

          {/* Source Content */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Source Content</label>
            <Input
              value={sourceContent}
              onChange={(e) => setSourceContent(e.target.value)}
              placeholder="Which post/ad brought this lead?"
              className="bg-secondary border-border text-foreground"
            />
          </div>

          {/* Campaign */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Campaign</label>
            <Input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              placeholder="Optional"
              className="bg-secondary border-border text-foreground"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="bg-secondary border-border text-foreground"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? <><Loader2 size={14} className="animate-spin" /> Logging...</> : "💵 Log Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogDealModal;
