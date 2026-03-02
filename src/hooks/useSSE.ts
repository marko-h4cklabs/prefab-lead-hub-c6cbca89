import { useEffect, useRef, useState, useCallback } from "react";
import { getAuthToken } from "@/lib/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

export interface SSEEvent {
  type: "connected" | "new_message" | "suggestion_ready" | "dm_assigned" | "lead_updated" | "new_lead";
  leadId?: string;
  conversationId?: string;
  preview?: string;
  role?: string;
  content?: string;
  messageTimestamp?: string;
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

const MAX_RECONNECT_DELAY = 30_000;
const INITIAL_RECONNECT_DELAY = 1_000;

/**
 * Hook for Server-Sent Events (SSE) real-time updates.
 * Connects to /api/sse/events with JWT auth via query param.
 * Custom reconnection with fresh token on auth/connection failures.
 */
export function useSSE(onEvent: (event: SSEEvent) => void): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const mountedRef = useRef(true);

  // Keep callback ref current without triggering reconnects
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    cleanup();

    // Get fresh token on every connect attempt
    const token = getAuthToken();
    if (!token) {
      setConnected(false);
      // Retry in 5s in case user logs in
      reconnectTimerRef.current = setTimeout(() => connect(), 5_000);
      return;
    }

    const url = `${API_BASE}/api/sse/events?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY; // Reset backoff on success
    };

    es.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data: SSEEvent = JSON.parse(event.data);
        onEventRef.current(data);
      } catch {
        // Ignore malformed events
      }
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      setConnected(false);

      // Close the current connection — we'll reconnect manually with a fresh token
      es.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
      reconnectTimerRef.current = setTimeout(() => connect(), delay);
    };
  }, [cleanup]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      cleanup();
      setConnected(false);
    };
  }, [connect, cleanup]);

  return { connected };
}
