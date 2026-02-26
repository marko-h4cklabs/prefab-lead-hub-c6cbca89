import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Account from "@/pages/Account";
import Billing from "@/pages/Billing";
import NotificationSettings from "@/components/settings/NotificationSettings";

const AccountBillingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="h-full p-6 overflow-hidden flex flex-col">
      <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all mb-3 shrink-0">
        <ArrowLeft size={14} /> Back
      </button>
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          <Account />
          <div className="border-t border-border pt-6">
            <Billing />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pl-2">
          <h2 className="text-lg font-bold text-foreground mb-4">Notifications</h2>
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
};

export default AccountBillingPage;
