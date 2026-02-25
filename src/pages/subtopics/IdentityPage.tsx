import { useCallback, useState, useEffect } from "react";
import { api } from "@/lib/apiClient";
import AgentIdentitySection from "@/components/chatbot/AgentIdentitySection";
import CompanyInfoSection from "@/components/chatbot/CompanyInfoSection";
import PersonasSection from "@/components/chatbot/PersonasSection";

const IdentityPage = () => {
  const [previewKey, setPreviewKey] = useState(0);
  const refreshPreview = useCallback(() => setPreviewKey((k) => k + 1), []);

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* LEFT — Identity form */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        <h2 className="text-lg font-bold text-foreground">Identity & Persona</h2>
        <div className="dark-card border-l-4 border-l-primary">
          <AgentIdentitySection onDirty={() => {}} onSaved={refreshPreview} />
        </div>
        <div className="dark-card border-l-4 border-l-primary">
          <CompanyInfoSection />
        </div>
      </div>

      {/* RIGHT — Personas */}
      <div className="flex-1 overflow-y-auto space-y-4 pl-2">
        <h2 className="text-lg font-bold text-foreground">Personas</h2>
        <div className="dark-card border-l-4 border-l-primary">
          <PersonasSection />
        </div>
      </div>
    </div>
  );
};

export default IdentityPage;
