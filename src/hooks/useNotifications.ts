import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  read: boolean;
  created_at: string;
}

interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  loading: boolean;
}

const POLL_INTERVAL = 20_000; // 20s

export function useNotifications() {
  const [state, setState] = useState<NotificationsState>({
    items: [],
    unreadCount: 0,
    loading: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.getNotifications({ limit: 20, offset: 0 });
      const items: AppNotification[] = Array.isArray(res?.notifications)
        ? res.notifications
        : Array.isArray(res) ? res : [];
      const unreadCount = typeof res?.unreadCount === "number"
        ? res.unreadCount
        : items.filter((n) => !n.read).length;
      setState({ items, unreadCount, loading: false });
    } catch {
      // silent – don't spam toasts on poll failures
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setState((s) => ({
        ...s,
        items: s.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await api.markAllNotificationsRead();
      setState((s) => ({
        ...s,
        items: s.items.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch (err) {
      toast({ title: "Error", description: getErrorMessage(err), variant: "destructive" });
    }
  }, []);

  return { ...state, fetchNotifications, markRead, markAllRead };
}
