import PreviewPanel from "@/components/chatbot/PreviewPanel";
import { useState } from "react";

const TestChatPage = () => {
  const [previewKey, setPreviewKey] = useState(0);

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="w-full max-w-[600px] h-full">
        <PreviewPanel refreshKey={previewKey} />
      </div>
    </div>
  );
};

export default TestChatPage;
