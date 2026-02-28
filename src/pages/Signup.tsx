import { useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/apiClient";
import { Eye, EyeOff, Loader2, Search, ChevronDown } from "lucide-react";

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', dialCode: '+385' },
  { code: 'RS', name: 'Serbia', flag: '🇷🇸', dialCode: '+381' },
  { code: 'BA', name: 'Bosnia', flag: '🇧🇦', dialCode: '+387' },
  { code: 'SI', name: 'Slovenia', flag: '🇸🇮', dialCode: '+386' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', dialCode: '+43' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', dialCode: '+41' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', dialCode: '+39' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', dialCode: '+34' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', dialCode: '+31' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', dialCode: '+971' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', dialCode: '+55' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', dialCode: '+52' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', dialCode: '+82' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dialCode: '+86' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', dialCode: '+46' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', dialCode: '+47' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', dialCode: '+45' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', dialCode: '+358' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', dialCode: '+48' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', dialCode: '+420' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', dialCode: '+40' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', dialCode: '+36' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', dialCode: '+359' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', dialCode: '+30' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', dialCode: '+90' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dialCode: '+351' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', dialCode: '+353' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', dialCode: '+32' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', dialCode: '+972' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', dialCode: '+65' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', dialCode: '+64' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dialCode: '+27' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', dialCode: '+966' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dialCode: '+20' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dialCode: '+234' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', dialCode: '+63' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', dialCode: '+66' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', dialCode: '+60' },
];

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

const Signup = () => {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);
  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.dialCode.includes(q));
  }, [countrySearch]);

  const passwordsMatch = password === confirmPassword;
  const strength = getPasswordStrength(password);
  const canSubmit = companyName.trim() && email.trim() && countryCode && password && confirmPassword && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCompany = companyName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedCompany) { setError("Company name is required"); return; }
    if (!trimmedEmail) { setError("Email is required"); return; }
    if (!countryCode) { setError("Country is required"); return; }
    if (!password) { setError("Password is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (!confirmPassword) { setError("Please confirm your password"); return; }
    if (!passwordsMatch) { setError("Passwords do not match"); return; }
    setLoading(true);
    setError("");
    try {
      const fullPhone = phoneLocal && selectedCountry ? selectedCountry.dialCode + phoneLocal : undefined;
      const res = await api.signup(trimmedCompany, trimmedEmail, password, {
        phone_number: fullPhone,
        country_code: countryCode,
      });
      localStorage.setItem("auth_token", res.token);
      if (res.companyId) {
        localStorage.setItem("company_id", res.companyId);
        localStorage.setItem("plcs_company_id", res.companyId);
      }
      localStorage.setItem("plcs_company_name", trimmedCompany);
      navigate("/verify-email-pending", { replace: true, state: { email: trimmedEmail } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Signup failed";
      if (typeof message === "string" && message.toLowerCase().includes("already")) {
        setError("An account with this email already exists. Try logging in instead.");
      } else if (typeof message === "string" && message.toLowerCase().includes("weak")) {
        setError("Password is too weak. Use at least 6 characters with a mix of letters and numbers.");
      } else {
        setError(typeof message === "string" ? message : "Signup failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="dark-card p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">P</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">Create Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Set up your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Company Name</label>
              <input type="text" value={companyName} onChange={(e) => { setCompanyName(e.target.value); setError(""); }} placeholder="Acme Inc." className="dark-input w-full" autoFocus disabled={loading} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="you@company.com" className="dark-input w-full" disabled={loading} />
            </div>

            {/* Country */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Country</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCountryOpen(!countryOpen)}
                  className="dark-input w-full text-left flex items-center justify-between"
                  disabled={loading}
                >
                  {selectedCountry ? (
                    <span className="flex items-center gap-2">
                      <span>{selectedCountry.flag}</span>
                      <span className="text-sm">{selectedCountry.name}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Select country</span>
                  )}
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
                {countryOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-60 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={e => setCountrySearch(e.target.value)}
                          placeholder="Search countries..."
                          className="dark-input w-full pl-8 text-sm h-8"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-48">
                      {filteredCountries.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCountryCode(c.code);
                            setCountryOpen(false);
                            setCountrySearch("");
                            setError("");
                          }}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors ${countryCode === c.code ? 'bg-accent' : ''}`}
                        >
                          <span>{c.flag}</span>
                          <span>{c.name}</span>
                          <span className="ml-auto text-muted-foreground text-xs">{c.dialCode}</span>
                        </button>
                      ))}
                      {filteredCountries.length === 0 && (
                        <p className="px-3 py-4 text-sm text-muted-foreground text-center">No countries found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Phone Number */}
            {selectedCountry && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone Number <span className="text-muted-foreground/60">(optional)</span></label>
                <div className="flex gap-2">
                  <div className="dark-input px-3 py-2 text-sm text-muted-foreground w-20 shrink-0 flex items-center justify-center">
                    {selectedCountry.dialCode}
                  </div>
                  <input
                    type="tel"
                    value={phoneLocal}
                    onChange={e => setPhoneLocal(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="912345678"
                    className="dark-input flex-1"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="••••••••" className="dark-input w-full pr-10" disabled={loading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${strength.color}`} style={{ width: strength.width }} />
                  </div>
                  <p className={`text-[10px] font-medium ${strength.label === "Weak" ? "text-destructive" : strength.label === "Medium" ? "text-warning" : "text-success"}`}>
                    {strength.label}
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirm Password</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} placeholder="••••••••" className="dark-input w-full pr-10" disabled={loading} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && <p className="mt-1.5 text-xs text-destructive">Passwords do not match</p>}
            </div>
            {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
            <button type="submit" disabled={!canSubmit} className="dark-btn-primary w-full">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Creating…</> : "Create account"}
            </button>
            <div className="text-center space-y-2">
              <Link to="/login" className="text-xs text-muted-foreground hover:text-primary transition-colors block">Back to login</Link>
              <p className="text-xs text-muted-foreground">Joining a team? Use your invite link instead.</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
