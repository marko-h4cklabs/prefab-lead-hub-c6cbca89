import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import PreviewPanel from "@/components/chatbot/PreviewPanel";

const TestChatPage = () => {
  const navigate = useNavigate();
  const [previewKey, setPreviewKey] = useState(0);

  return (
    <div className="h-full flex flex-col p-6 relative overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="flex items-center justify-between mb-4 shrink-0 relative z-10">
        <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">Test Chat</h2>
          <p className="text-[11px] text-muted-foreground">Preview your AI agent in action</p>
        </div>
        <button
          onClick={() => setPreviewKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="w-full max-w-[500px] h-full rounded-2xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_5%)] overflow-hidden shadow-lg shadow-black/20">
          <PreviewPanel refreshKey={previewKey} />
        </div>
      </div>
    </div>
  );
};

export default TestChatPage;
