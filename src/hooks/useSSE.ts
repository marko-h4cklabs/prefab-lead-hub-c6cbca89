import { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "@/lib/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface SSEEvent {
  type: "connected" | "new_message" | "suggestion_ready" | "dm_assigned" | "lead_updated";
  leadId?: string;
  conversationId?: string;
  preview?: string;
  leadName?: string;
  assignedTo?: string | null;
  assignedName?: string;
  isNewLead?: boolean;
  suggestionId?: string;
  dm_status?: string;
  updatedBy?: string;
  userId?: string;
  companyId?: string;
  timestamp?: string;
}

/**
 * Hook for Server-Sent Events (SSE) real-time updates.
 * Connects to /api/sse/events with JWT auth via query param.
 * Auto-reconnects on disconnect (EventSource handles this natively).
 */
export function useSSE(onEvent: (event: SSEEvent) => void): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);

  // Keep callback ref current without triggering reconnects
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setConnected(false);
      return;
    }

    const url = `${API_BASE}/api/sse/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        onEventRef.current(data);
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects — no manual retry needed
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
      setConnected(false);
    };
  }, []); // Only connect once on mount

  return { connected };
}
