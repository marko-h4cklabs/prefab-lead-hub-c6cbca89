import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Bot, Sparkles, Loader2 } from "lucide-react";

const ModeSelectionScreen = ({ onModeSet }: { onModeSet?: () => void }) => {
  const navigate = useNavigate();
  const [loadingMode, setLoadingMode] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSelect = async (mode: "autopilot" | "copilot") => {
    setLoadingMode(mode);
    setError("");
    try {
      await api.setOperatingMode(mode);
      onModeSet?.();
      navigate("/leads", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to set mode. Please try again.");
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="w-full max-w-[800px] px-6">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-xl">P</span>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-2">
          How do you want your AI to work?
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-10">
          You can change this anytime in Settings
        </p>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Autopilot */}
          <div className="bg-card border border-border rounded-xl p-8 hover:shadow-[0_0_0_2px_hsl(48_92%_53%)] transition-shadow">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-lg bg-primary/15 flex items-center justify-center">
                <Bot size={24} className="text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground text-center mb-2">AI Autopilot 24/7</h2>
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                Fully Automated
              </span>
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Your AI handles every Instagram DM automatically. It qualifies leads, answers questions, and books calls — without you lifting a finger.
            </p>
            <ul className="space-y-1.5 mb-6">
              <li className="text-sm text-muted-foreground">✓ Instant replies 24/7</li>
              <li className="text-sm text-muted-foreground">✓ No human needed</li>
              <li className="text-sm text-muted-foreground">✓ Best for high volume</li>
            </ul>
            <button
              onClick={() => handleSelect("autopilot")}
              disabled={loadingMode !== null}
              className="w-full rounded-lg bg-primary text-primary-foreground font-semibold py-3 flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loadingMode === "autopilot" ? <Loader2 size={16} className="animate-spin" /> : null}
              Choose Autopilot
            </button>
          </div>

          {/* Co-Pilot */}
          <div className="bg-card border border-border rounded-xl p-8 hover:shadow-[0_0_0_2px_hsl(48_92%_53%)] transition-shadow">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-lg bg-info/15 flex items-center justify-center">
                <Sparkles size={24} className="text-info" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground text-center mb-2">AI Co-Pilot</h2>
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-info text-info-foreground text-xs font-semibold">
                Hybrid
              </span>
            </div>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Your AI analyzes every conversation and suggests 3 ready-to-send replies. Your setter picks the best one — staying in full control.
            </p>
            <ul className="space-y-1.5 mb-6">
              <li className="text-sm text-muted-foreground">✓ Human stays in control</li>
              <li className="text-sm text-muted-foreground">✓ AI-powered suggestions</li>
              <li className="text-sm text-muted-foreground">✓ Best for high-ticket sales</li>
            </ul>
            <button
              onClick={() => handleSelect("copilot")}
              disabled={loadingMode !== null}
              className="w-full rounded-lg border border-border text-foreground font-semibold py-3 flex items-center justify-center gap-2 hover:bg-secondary transition-colors disabled:opacity-60"
            >
              {loadingMode === "copilot" ? <Loader2 size={16} className="animate-spin" /> : null}
              Choose Co-Pilot
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center mt-4">{error}</p>
        )}
      </div>
    </div>
  );
};

export default ModeSelectionScreen;
