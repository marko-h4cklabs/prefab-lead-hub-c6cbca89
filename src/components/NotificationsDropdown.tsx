import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useNotifications, type AppNotification } from "@/hooks/useNotifications";
import { useState } from "react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NotificationsDropdown = () => {
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleClick = async (n: AppNotification) => {
    if (!n.read) await markRead(n.id);
    if (n.url) navigate(n.url);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-sm hover:bg-muted transition-colors" aria-label="Notifications">
          <Bell size={18} className="text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 max-h-[420px] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-accent hover:text-accent" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/50 transition-colors ${!n.read ? "bg-accent/5" : ""}`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  <div className={`flex-1 ${n.read ? "pl-4" : ""}`}>
                    <p className={`text-sm leading-tight ${!n.read ? "font-semibold text-foreground" : "text-foreground/80"}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsDropdown;
