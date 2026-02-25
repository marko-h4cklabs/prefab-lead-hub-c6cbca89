import Account from "@/pages/Account";
import Billing from "@/pages/Billing";
import NotificationSettings from "@/components/settings/NotificationSettings";

const AccountBillingPage = () => (
  <div className="h-full flex gap-6 p-6 overflow-hidden">
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
);

export default AccountBillingPage;
