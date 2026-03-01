import { useState, useCallback, useRef } from "react";
import ActiveDMList from "../../components/copilot/ActiveDMList";
import CopilotLeadSummary from "../../components/copilot/CopilotLeadSummary";
import CopilotChat from "../../components/copilot/CopilotChat";
import { MessageSquare } from "lucide-react";
import { useSSE, type SSEEvent } from "@/hooks/useSSE";

type View = "summary" | "chat";

const CopilotConversations = () => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [view, setView] = useState<View>("summary");

  // SSE-driven refresh triggers (increment to trigger immediate refetch)
  const [dmRefreshTrigger, setDmRefreshTrigger] = useState(0);
  const [messageTrigger, setMessageTrigger] = useState(0);
  const [suggestionTrigger, setSuggestionTrigger] = useState(0);

  // Track selected lead in a ref so the SSE callback can read it without re-subscribing
  const selectedLeadRef = useRef<string | null>(null);
  selectedLeadRef.current = selectedLeadId;

  const handleSSEEvent = useCallback((event: SSEEvent) => {
    if (event.type === "connected") return;

    if (event.type === "new_message") {
      // Always refresh the DM list (new message updates preview, ordering)
      setDmRefreshTrigger((n) => n + 1);
      // If this message is for the currently-selected lead, refresh the chat too
      if (event.leadId === selectedLeadRef.current) {
        setMessageTrigger((n) => n + 1);
      }
    }

    if (event.type === "suggestion_ready") {
      if (event.leadId === selectedLeadRef.current) {
        setSuggestionTrigger((n) => n + 1);
      }
    }

    if (event.type === "dm_assigned") {
      setDmRefreshTrigger((n) => n + 1);
    }

    if (event.type === "lead_updated") {
      setDmRefreshTrigger((n) => n + 1);
    }
  }, []);

  const { connected } = useSSE(handleSSEEvent);

  const handleSelectLead = (leadId: string, conversationId: string) => {
    if (leadId !== selectedLeadId) {
      setView("summary");
    }
    setSelectedLeadId(leadId);
    setSelectedConversationId(conversationId);
  };

  return (
    <div className="flex h-full">
      {/* Left: Active DM List */}
      <ActiveDMList
        selectedLeadId={selectedLeadId}
        onSelectLead={handleSelectLead}
        refreshTrigger={dmRefreshTrigger}
        sseConnected={connected}
      />

      {/* Center/Right: Lead Summary or Chat */}
      <div className="flex-1 overflow-hidden relative">
        {/* SSE Connection Status */}
        <div className="absolute top-2 right-3 z-10" title={connected ? "Real-time updates active" : "Reconnecting... using polling"}>
          {connected ? (
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Live
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-yellow-500">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
              </span>
              Polling
            </div>
          )}
        </div>

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
              messageTrigger={messageTrigger}
              suggestionTrigger={suggestionTrigger}
              sseConnected={connected}
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
