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

const POLL_INTERVAL = 30_000; // 30s

export function useNotifications() {
  const [state, setState] = useState<NotificationsState>({
    items: [],
    unreadCount: 0,
    loading: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.getUnreadCount();
      const count = typeof res?.count === "number" ? res.count : typeof res?.unread_count === "number" ? res.unread_count : 0;
      setState((s) => ({ ...s, unreadCount: count }));
    } catch { /* silent */ }
  }, []);

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
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    fetchNotifications();
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchNotifications, fetchUnreadCount]);

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

  return { ...state, fetchNotifications, fetchUnreadCount, markRead, markAllRead };
}
