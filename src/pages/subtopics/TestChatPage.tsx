import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import PreviewPanel from "@/components/chatbot/PreviewPanel";

const TestChatPage = () => {
  const navigate = useNavigate();
  const [previewKey, setPreviewKey] = useState(0);

  return (
    <div className="h-full flex flex-col p-6">
      <button onClick={() => navigate(-1 as any)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3 shrink-0">
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
