import { useState } from "react";
import ActiveDMList from "@/components/copilot/ActiveDMList";
import CopilotChat from "@/components/copilot/CopilotChat";
import CopilotLeadProfile from "@/components/copilot/CopilotLeadProfile";
import { MessageSquare } from "lucide-react";

const CopilotConversations = () => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string>("");

  const handleSelectLead = (leadId: string, conversationId: string) => {
    setSelectedLeadId(leadId);
    setSelectedConvoId(conversationId);
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: Active DMs */}
      <ActiveDMList
        selectedLeadId={selectedLeadId}
        onSelectLead={(leadId, convId) => {
          handleSelectLead(leadId, convId);
          // Lead name will be shown once loaded in chat
          setSelectedName("");
        }}
      />

      {/* Center: Chat + Suggestions */}
      {selectedLeadId && selectedConvoId ? (
        <CopilotChat
          key={selectedLeadId}
          leadId={selectedLeadId}
          conversationId={selectedConvoId}
          leadName={selectedName || "Conversation"}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageSquare size={28} className="text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Co-Pilot Workspace</h3>
            <p className="text-sm text-muted-foreground max-w-[300px]">
              Select a conversation from the left panel. AI will prepare response suggestions for you to review, edit, and send.
            </p>
          </div>
        </div>
      )}

      {/* Right: Lead Profile */}
      {selectedLeadId && (
        <CopilotLeadProfile key={`profile-${selectedLeadId}`} leadId={selectedLeadId} />
      )}
    </div>
  );
};

export default CopilotConversations;
