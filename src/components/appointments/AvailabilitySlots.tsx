import { useState } from "react";
import { api } from "@/lib/apiClient";
import { Loader2, ChevronDown, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { addDays, format } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Slot {
  start: string;
  end: string;
  date?: string;
}

interface Props {
  appointmentType: string;
  selectedDate: string;
  onSelectSlot: (slot: { date: string; startTime: string; endTime: string }) => void;
}

function groupByDay(slots: Slot[]): Record<string, Slot[]> {
  const groups: Record<string, Slot[]> = {};
  slots.forEach((s) => {
    const day = s.date || (s.start ? s.start.slice(0, 10) : "Unknown");
    if (!groups[day]) groups[day] = [];
    groups[day].push(s);
  });
  return groups;
}

function extractTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso.slice(11, 16) || "";
  }
}

export default function AvailabilitySlots({ appointmentType, selectedDate, onSelectSlot }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState("");

  const fetchSlots = () => {
    setLoading(true);
    setError("");
    const from = selectedDate || format(new Date(), "yyyy-MM-dd");
    const to = format(addDays(new Date(from), 7), "yyyy-MM-dd");

    api.getAvailableSlots({ type: appointmentType, from, to })
      .then((res) => {
        const list = Array.isArray(res) ? res : Array.isArray(res?.slots) ? res.slots : Array.isArray(res?.data) ? res.data : [];
        setSlots(list);
        if (list.length === 0) {
          setError("No available slots in this range");
        }
      })
      .catch((err) => {
        setError(getErrorMessage(err));
        toast({ title: "Could not load slots", description: getErrorMessage(err), variant: "destructive" });
      })
      .finally(() => setLoading(false));
  };

  const handleSelect = (slot: Slot) => {
    const day = slot.date || slot.start.slice(0, 10);
    const startTime = extractTime(slot.start);
    const endTime = extractTime(slot.end);
    onSelectSlot({ date: day, startTime, endTime });
  };

  const grouped = slots ? groupByDay(slots) : {};
  const days = Object.keys(grouped).sort();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Zap size={12} />
        Suggested Slots
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-1">
        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs w-full"
            onClick={fetchSlots}
            disabled={loading}
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            Find available slots
          </Button>

          {loading && (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-muted animate-pulse rounded-sm" />
              ))}
            </div>
          )}

          {error && !loading && (
            <p className="text-xs text-muted-foreground text-center py-2">{error}</p>
          )}

          {!loading && slots && slots.length > 0 && (
            <div className="space-y-2.5 max-h-48 overflow-y-auto">
              {days.map((day) => (
                <div key={day}>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                    {format(new Date(day + "T00:00:00"), "EEE, MMM d")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {grouped[day].map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelect(slot)}
                        className="px-2.5 py-1 text-xs font-mono rounded-sm border border-border bg-card hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {extractTime(slot.start)} – {extractTime(slot.end)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
