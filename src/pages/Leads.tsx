import { LayoutList } from "lucide-react";

const Leads = () => {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center">
          <LayoutList size={28} className="text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Select a conversation</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Choose a lead from the list to view their details, conversation, and CRM data.
        </p>
      </div>
    </div>
  );
};

export default Leads;
