import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";

export default function ModeBanner() {
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getOperatingMode()
      .then((res) => {
        const m = res?.operating_mode || res?.mode || null;
        setMode(m);
        setSelectedMode(m || "autopilot");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await api.setOperatingMode(selectedMode);
      toast({ title: "Operating mode updated" });
      window.location.reload();
    } catch (err) {
      toast({ title: "Failed to switch mode", description: getErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const isAutopilot = mode === "autopilot";
  const isCopilot = mode === "copilot";

  return (
    <>
      <div
        className={`h-12 flex items-center justify-center px-6 text-sm font-medium relative ${
          isAutopilot
            ? "bg-[hsl(142_71%_45%/0.1)] text-success"
            : isCopilot
            ? "bg-[hsl(217_91%_60%/0.1)] text-info"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        <span>
          Operating Mode:{" "}
          <span className="font-bold uppercase">
            {isAutopilot ? "AUTOPILOT" : isCopilot ? "COPILOT" : "NOT SET"}
          </span>
        </span>
        <button
          onClick={() => setModalOpen(true)}
          className="absolute right-6 text-xs border border-primary text-primary rounded-md px-3 py-1 hover:bg-primary/10 transition-colors"
        >
          Change Mode
        </button>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Switch Operating Mode</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 mb-4">
            <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Changing the operating mode will restart the AI agent and affect how conversations are handled.
              Active conversations will continue with the new mode.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => setSelectedMode("autopilot")}
              className={`w-full text-left rounded-lg p-4 border-2 transition-all ${
                selectedMode === "autopilot" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              }`}
            >
              <p className="text-sm font-bold text-foreground">🤖 Autopilot</p>
              <p className="text-xs text-muted-foreground mt-1">AI handles all conversations automatically</p>
            </button>
            <button
              onClick={() => setSelectedMode("copilot")}
              className={`w-full text-left rounded-lg p-4 border-2 transition-all ${
                selectedMode === "copilot" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
              }`}
            >
              <p className="text-sm font-bold text-foreground">🧠 Copilot</p>
              <p className="text-xs text-muted-foreground mt-1">AI suggests replies, you send them manually</p>
            </button>
          </div>
          <div className="flex items-center justify-end gap-3 mt-4">
            <button onClick={() => setModalOpen(false)} className="dark-btn-secondary text-sm">Cancel</button>
            <button
              onClick={handleConfirm}
              disabled={saving || selectedMode === mode}
              className="dark-btn-primary text-sm"
            >
              {saving && <Loader2 size={14} className="animate-spin mr-1" />}
              Confirm & Restart
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
