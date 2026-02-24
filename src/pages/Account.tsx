import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { Loader2, Save, AlertTriangle, User, Building2, Lock, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function getPasswordStrength(password: string): { label: string; color: string; width: string } {
  if (!password) return { label: "", color: "", width: "0%" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { label: "Weak", color: "bg-destructive", width: "25%" };
  if (score <= 3) return { label: "Medium", color: "bg-warning", width: "60%" };
  return { label: "Strong", color: "bg-success", width: "100%" };
}

const Account = () => {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Danger zone
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const strength = getPasswordStrength(newPassword);

  useEffect(() => {
    Promise.all([
      api.getMe().catch(() => null),
      api.getCompany(localStorage.getItem("company_id") || localStorage.getItem("plcs_company_id") || "").catch(() => null),
    ]).then(([me, company]) => {
      if (me) {
        setUserName(me.name || me.user?.name || "");
        setUserEmail(me.email || me.user?.email || "");
      }
      if (company) {
        setCompanyName(company.company_name || company.name || "");
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updateProfile({ name: userName.trim() });
      toast({ title: "Profile updated" });
    } catch (err) {
      toast({ title: "Failed to update profile", description: getErrorMessage(err), variant: "destructive" });
    } finally { setSavingProfile(false); }
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      const companyId = localStorage.getItem("company_id") || localStorage.getItem("plcs_company_id") || "";
      await api.patchCompany(companyId, { company_name: companyName.trim() });
      toast({ title: "Company name updated" });
    } catch (err) {
      toast({ title: "Failed to update company", description: getErrorMessage(err), variant: "destructive" });
    } finally { setSavingCompany(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword !== confirmPassword) { toast({ title: "Passwords don't match", variant: "destructive" }); return; }
    if (newPassword.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    setSavingPassword(true);
    try {
      await api.updatePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password updated successfully" });
    } catch (err) {
      toast({ title: "Failed to update password", description: getErrorMessage(err), variant: "destructive" });
    } finally { setSavingPassword(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== companyName) return;
    setDeleting(true);
    try {
      await api.deleteAccount();
      toast({ title: "Account deleted" });
      localStorage.clear();
      window.location.href = "/login";
    } catch (err) {
      toast({ title: "Failed to delete account", description: getErrorMessage(err), variant: "destructive" });
    } finally { setDeleting(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-bold">Account</h1>

      {/* Profile */}
      <div className="dark-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><User size={14} className="text-primary" /> Profile</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full Name</label>
          <input value={userName} onChange={(e) => setUserName(e.target.value)} className="dark-input w-full" placeholder="Your name" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
          <input value={userEmail} readOnly className="dark-input w-full opacity-60 cursor-not-allowed" />
          <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed here</p>
        </div>
        <button onClick={handleSaveProfile} disabled={savingProfile || !userName.trim()} className="dark-btn-primary text-sm">
          {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      {/* Company */}
      <div className="dark-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Building2 size={14} className="text-primary" /> Company</h2>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Company Name</label>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="dark-input w-full" />
        </div>
        <button onClick={handleSaveCompany} disabled={savingCompany || !companyName.trim()} className="dark-btn-primary text-sm">
          {savingCompany ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      {/* Change Password */}
      <div className="dark-card p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Lock size={14} className="text-primary" /> Change Password</h2>
        <form onSubmit={handleUpdatePassword} className="space-y-3">
          <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="dark-input w-full" required />
          <div>
            <input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="dark-input w-full" required />
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                </div>
                <p className={`text-[10px] font-medium ${strength.label === "Weak" ? "text-destructive" : strength.label === "Medium" ? "text-warning" : "text-success"}`}>{strength.label}</p>
              </div>
            )}
          </div>
          <input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="dark-input w-full" required />
          {confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-destructive">Passwords do not match</p>}
          <button type="submit" disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword} className="dark-btn-primary text-sm">
            {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Update Password
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-destructive flex items-center gap-2"><AlertTriangle size={14} /> Danger Zone</h2>
        <p className="text-xs text-muted-foreground">Permanently delete your account and all associated data. This cannot be undone.</p>
        <button onClick={() => setDeleteModalOpen(true)} className="dark-btn border border-destructive text-destructive hover:bg-destructive/10 text-sm">
          <Trash2 size={14} /> Delete Account
        </button>

        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle className="text-destructive">Delete Account</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">This will permanently delete your account, all leads, conversations, and settings. Type your company name <strong className="text-foreground">{companyName}</strong> to confirm.</p>
            <input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} className="dark-input w-full" placeholder="Type company name" />
            <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirmText !== companyName} className="w-full dark-btn-destructive">
              {deleting ? <Loader2 size={14} className="animate-spin" /> : null} Permanently Delete Account
            </button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Account;
