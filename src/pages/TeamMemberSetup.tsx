import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api, setAuthToken, setCompanyId } from "@/lib/apiClient";
import { Eye, EyeOff, Loader2, Users, AlertCircle, Search, ChevronDown, ArrowLeft, Mail } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '\u{1F1FA}\u{1F1F8}', dialCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '\u{1F1EC}\u{1F1E7}', dialCode: '+44' },
  { code: 'DE', name: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', dialCode: '+49' },
  { code: 'FR', name: 'France', flag: '\u{1F1EB}\u{1F1F7}', dialCode: '+33' },
  { code: 'HR', name: 'Croatia', flag: '\u{1F1ED}\u{1F1F7}', dialCode: '+385' },
  { code: 'RS', name: 'Serbia', flag: '\u{1F1F7}\u{1F1F8}', dialCode: '+381' },
  { code: 'BA', name: 'Bosnia', flag: '\u{1F1E7}\u{1F1E6}', dialCode: '+387' },
  { code: 'SI', name: 'Slovenia', flag: '\u{1F1F8}\u{1F1EE}', dialCode: '+386' },
  { code: 'AT', name: 'Austria', flag: '\u{1F1E6}\u{1F1F9}', dialCode: '+43' },
  { code: 'CH', name: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}', dialCode: '+41' },
  { code: 'IT', name: 'Italy', flag: '\u{1F1EE}\u{1F1F9}', dialCode: '+39' },
  { code: 'ES', name: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', dialCode: '+34' },
  { code: 'NL', name: 'Netherlands', flag: '\u{1F1F3}\u{1F1F1}', dialCode: '+31' },
  { code: 'AU', name: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', dialCode: '+61' },
  { code: 'CA', name: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', dialCode: '+1' },
  { code: 'AE', name: 'UAE', flag: '\u{1F1E6}\u{1F1EA}', dialCode: '+971' },
  { code: 'BR', name: 'Brazil', flag: '\u{1F1E7}\u{1F1F7}', dialCode: '+55' },
  { code: 'MX', name: 'Mexico', flag: '\u{1F1F2}\u{1F1FD}', dialCode: '+52' },
  { code: 'IN', name: 'India', flag: '\u{1F1EE}\u{1F1F3}', dialCode: '+91' },
  { code: 'JP', name: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', dialCode: '+81' },
  { code: 'KR', name: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', dialCode: '+82' },
  { code: 'CN', name: 'China', flag: '\u{1F1E8}\u{1F1F3}', dialCode: '+86' },
  { code: 'SE', name: 'Sweden', flag: '\u{1F1F8}\u{1F1EA}', dialCode: '+46' },
  { code: 'NO', name: 'Norway', flag: '\u{1F1F3}\u{1F1F4}', dialCode: '+47' },
  { code: 'DK', name: 'Denmark', flag: '\u{1F1E9}\u{1F1F0}', dialCode: '+45' },
  { code: 'FI', name: 'Finland', flag: '\u{1F1EB}\u{1F1EE}', dialCode: '+358' },
  { code: 'PL', name: 'Poland', flag: '\u{1F1F5}\u{1F1F1}', dialCode: '+48' },
  { code: 'CZ', name: 'Czech Republic', flag: '\u{1F1E8}\u{1F1FF}', dialCode: '+420' },
  { code: 'RO', name: 'Romania', flag: '\u{1F1F7}\u{1F1F4}', dialCode: '+40' },
  { code: 'HU', name: 'Hungary', flag: '\u{1F1ED}\u{1F1FA}', dialCode: '+36' },
  { code: 'BG', name: 'Bulgaria', flag: '\u{1F1E7}\u{1F1EC}', dialCode: '+359' },
  { code: 'GR', name: 'Greece', flag: '\u{1F1EC}\u{1F1F7}', dialCode: '+30' },
  { code: 'TR', name: 'Turkey', flag: '\u{1F1F9}\u{1F1F7}', dialCode: '+90' },
  { code: 'PT', name: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}', dialCode: '+351' },
  { code: 'IE', name: 'Ireland', flag: '\u{1F1EE}\u{1F1EA}', dialCode: '+353' },
  { code: 'BE', name: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}', dialCode: '+32' },
  { code: 'IL', name: 'Israel', flag: '\u{1F1EE}\u{1F1F1}', dialCode: '+972' },
  { code: 'SG', name: 'Singapore', flag: '\u{1F1F8}\u{1F1EC}', dialCode: '+65' },
  { code: 'NZ', name: 'New Zealand', flag: '\u{1F1F3}\u{1F1FF}', dialCode: '+64' },
  { code: 'ZA', name: 'South Africa', flag: '\u{1F1FF}\u{1F1E6}', dialCode: '+27' },
  { code: 'SA', name: 'Saudi Arabia', flag: '\u{1F1F8}\u{1F1E6}', dialCode: '+966' },
  { code: 'EG', name: 'Egypt', flag: '\u{1F1EA}\u{1F1EC}', dialCode: '+20' },
  { code: 'NG', name: 'Nigeria', flag: '\u{1F1F3}\u{1F1EC}', dialCode: '+234' },
  { code: 'PH', name: 'Philippines', flag: '\u{1F1F5}\u{1F1ED}', dialCode: '+63' },
  { code: 'TH', name: 'Thailand', flag: '\u{1F1F9}\u{1F1ED}', dialCode: '+66' },
  { code: 'MY', name: 'Malaysia', flag: '\u{1F1F2}\u{1F1FE}', dialCode: '+60' },
];

const RESEND_COOLDOWN = 30;

const TeamMemberSetup = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [invite, setInvite] = useState<{ valid: boolean; company_name?: string; role?: string; reason?: string } | null>(null);

  // Phase: 'form' or 'verify'
  const [phase, setPhase] = useState<"form" | "verify">("form");
  const [submittedEmail, setSubmittedEmail] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Verification state
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);
  const filteredCountries = useMemo(() => {
    if (!countrySearch) return COUNTRIES;
    const q = countrySearch.toLowerCase();
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.dialCode.includes(q));
  }, [countrySearch]);

  const canSubmit = fullName.trim() && email.trim() && countryCode && phoneLocal.trim() && password.length >= 8;

  // Validate invite code
  useEffect(() => {
    if (!code) {
      setInvite({ valid: false });
      setValidating(false);
      return;
    }
    api.validateInvite(code)
      .then((res) => setInvite(res))
      .catch(() => setInvite({ valid: false }))
      .finally(() => setValidating(false));
  }, [code]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) { setError("Full name is required"); return; }
    if (!trimmedEmail) { setError("Email is required"); return; }
    if (!countryCode) { setError("Country is required"); return; }
    if (!phoneLocal.trim()) { setError("Phone number is required"); return; }
    if (!password || password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (!selectedCountry) { setError("Country is required"); return; }

    const fullPhone = selectedCountry.dialCode + phoneLocal.trim();
    setLoading(true);
    setError("");
    try {
      await api.joinTeam({
        code,
        email: trimmedEmail,
        password,
        full_name: trimmedName,
        country_code: countryCode,
        phone_number: fullPhone,
      });
      // joinTeam now returns { success, email, requires_verification } — no token
      setSubmittedEmail(trimmedEmail);
      setPhase("verify");
      setResendCooldown(RESEND_COOLDOWN);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to join team";
      setError(typeof message === "string" ? message : "Failed to join team");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const codeVal = verifyCode.trim();
    if (codeVal.length !== 6) { setVerifyError("Enter the 6-digit code"); return; }
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res = await api.verifyTeamCode(submittedEmail, codeVal);
      setAuthToken(res.token);
      if (res.company?.id) setCompanyId(res.company.id);
      navigate("/copilot", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed";
      setVerifyError(typeof message === "string" ? message : "Invalid code");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await api.resendCode(submittedEmail);
      setResendCooldown(RESEND_COOLDOWN);
      setVerifyError("");
    } catch {
      setVerifyError("Failed to resend code. Try again.");
    }
  };

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!invite?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm px-6">
          <div className="dark-card p-8 text-center">
            <AlertCircle size={40} className="mx-auto mb-4 text-destructive" />
            <h1 className="text-lg font-bold text-foreground mb-2">Invalid Invite</h1>
            <p className="text-sm text-muted-foreground mb-6">
              {invite?.reason === "expired" ? "This invite link has expired." :
               invite?.reason === "max_uses_reached" ? "This invite has reached its maximum uses." :
               "This invite link is invalid or no longer active."}
            </p>
            <Link to="/login" className="dark-btn-primary inline-flex">Go to Login</Link>
          </div>
        </div>
      </div>
    );
  }

  // Phase 2: Code verification
  if (phase === "verify") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm px-6">
          <div className="dark-card p-8 text-center">
            <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail size={32} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-1">We sent a 6-digit code to</p>
            <p className="text-sm font-medium text-foreground mb-6">{submittedEmail}</p>

            <div className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={e => { setVerifyCode(e.target.value.replace(/[^0-9]/g, "")); setVerifyError(""); }}
                placeholder="000000"
                className="dark-input w-full text-center text-2xl tracking-[0.5em] font-mono"
                autoFocus
              />
              <button
                onClick={handleVerify}
                disabled={verifyCode.length !== 6 || verifyLoading}
                className="dark-btn-primary w-full"
              >
                {verifyLoading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : "Verify"}
              </button>

              {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}

              <p className="text-xs text-muted-foreground">
                Didn't get it?{" "}
                {resendCooldown > 0 ? (
                  <span>Resend in {resendCooldown}s</span>
                ) : (
                  <button onClick={handleResend} className="text-primary hover:underline">Resend code</button>
                )}
              </p>

              <button
                onClick={() => { setPhase("form"); setVerifyCode(""); setVerifyError(""); }}
                className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-full"
              >
                <ArrowLeft size={12} /> Back to form
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Phase 1: Registration form
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="dark-card p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Users size={20} className="text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Join Team</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You've been invited to join <span className="text-foreground font-medium">{invite.company_name}</span> as a <span className="text-foreground font-medium">{invite.role}</span>
            </p>
          </div>

          {/* Google Sign Up */}
          <a
            href={`${API_BASE}/api/auth/google?invite=${code}`}
            className="flex items-center justify-center gap-3 w-full border border-border rounded-lg px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </a>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-xs text-muted-foreground">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(""); }}
                placeholder="Your full name"
                className="dark-input w-full"
                autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@email.com"
                className="dark-input w-full"
                disabled={loading}
              />
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
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone Number <span className="text-destructive">*</span></label>
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
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Min. 8 characters"
                  className="dark-input w-full pr-10"
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button type="submit" disabled={loading || !canSubmit} className="dark-btn-primary w-full">
              {loading ? <><Loader2 size={16} className="animate-spin" /> Joining...</> : "Join Team"}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary transition-colors">Already have an account? <span className="text-primary">Sign in</span></Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TeamMemberSetup;
