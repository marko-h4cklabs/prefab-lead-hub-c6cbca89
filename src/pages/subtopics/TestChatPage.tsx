import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PreviewPanel from "@/components/chatbot/PreviewPanel";

const TestChatPage = () => {
  const navigate = useNavigate();
  const [previewKey, setPreviewKey] = useState(0);

  return (
    <div className="h-full flex flex-col p-6">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-3 shrink-0">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[600px] h-full">
          <PreviewPanel refreshKey={previewKey} />
        </div>
      </div>
    </div>
  );
};

export default TestChatPage;
