import { useState } from "react";
import ActiveDMList from "../../components/copilot/ActiveDMList";
import CopilotLeadSummary from "../../components/copilot/CopilotLeadSummary";
import CopilotChat from "../../components/copilot/CopilotChat";
import { MessageSquare } from "lucide-react";

type View = "summary" | "chat";

const CopilotConversations = () => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [view, setView] = useState<View>("summary");

  const handleSelectLead = (leadId: string, conversationId: string) => {
    // If selecting a different lead, reset to summary view
    if (leadId !== selectedLeadId) {
      setView("summary");
    }
    setSelectedLeadId(leadId);
    setSelectedConversationId(conversationId);
  };

  return (
    <div className="flex h-full">
      {/* Left: Active DM List (300px fixed width, handled internally) */}
      <ActiveDMList
        selectedLeadId={selectedLeadId}
        onSelectLead={handleSelectLead}
      />

      {/* Center/Right: Lead Summary or Chat */}
      <div className="flex-1 overflow-hidden">
        {selectedLeadId && selectedConversationId ? (
          view === "summary" ? (
            <CopilotLeadSummary
              key={selectedLeadId}
              leadId={selectedLeadId}
              onOpenChat={() => setView("chat")}
              onBack={() => {
                setSelectedLeadId(null);
                setSelectedConversationId(null);
                setView("summary");
              }}
            />
          ) : (
            <CopilotChat
              key={`chat-${selectedLeadId}`}
              leadId={selectedLeadId}
              conversationId={selectedConversationId}
              leadName="Conversation"
              onBack={() => setView("summary")}
            />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <MessageSquare size={28} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground max-w-[300px]">
                Select a conversation from the left to get started
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CopilotConversations;
