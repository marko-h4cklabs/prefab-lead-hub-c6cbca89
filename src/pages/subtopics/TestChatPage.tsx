import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Copy, RefreshCw, Send, Loader2, Trash2, Timer } from "lucide-react";
import { api } from "@/lib/apiClient";
import { toast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  provider?: string;
  responseTime?: number; // ms it took to respond
}

const DELAY_OPTIONS = [
  { label: "Instant", value: 0 },
  { label: "3s", value: 3 },
  { label: "5s", value: 5 },
  { label: "10s", value: 10 },
  { label: "30s", value: 30 },
  { label: "Smart", value: -1 },
];

const TestChatPage = () => {
  const navigate = useNavigate();

  // System prompt state
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Timer state
  const [delaySec, setDelaySec] = useState(0); // 0=instant, -1=smart (random 2-8s)
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrompt = useCallback(() => {
    setPromptLoading(true);
    api.getBehaviorPreview()
      .then((res) => {
        const text = typeof res === "string" ? res : (res as any)?.prompt || (res as any)?.system_prompt || JSON.stringify(res, null, 2);
        setPrompt(text);
      })
      .catch(() => setPrompt(""))
      .finally(() => setPromptLoading(false));
  }, []);

  useEffect(() => { fetchPrompt(); }, [fetchPrompt]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, sending, countdown]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDelay = (): number => {
    if (delaySec === 0) return 0;
    if (delaySec === -1) return Math.floor(Math.random() * 6 + 2); // Smart: 2-8 seconds
    return delaySec;
  };

  const handleSend = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);
    const startTime = Date.now();
    try {
      const res = await api.testBehavior({ message: userMsg });
      const content = (res as any)?.reply || (res as any)?.response || (res as any)?.message || (res as any)?.content || String(res);
      const provider = (res as any)?.provider || "";
      const responseTime = Date.now() - startTime;

      const actualDelay = getDelay();
      const elapsed = responseTime / 1000;
      const remaining = Math.max(0, actualDelay - elapsed);

      if (remaining > 0) {
        // Start countdown
        setCountdown(Math.ceil(remaining));
        await new Promise<void>((resolve) => {
          const start = Date.now();
          countdownRef.current = setInterval(() => {
            const left = remaining - (Date.now() - start) / 1000;
            if (left <= 0) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              countdownRef.current = null;
              setCountdown(0);
              resolve();
            } else {
              setCountdown(Math.ceil(left));
            }
          }, 100);
        });
      }

      setMessages((prev) => [...prev, { role: "assistant", content, provider, responseTime }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err?.message || "Failed to get response"}` }]);
    } finally {
      setSending(false);
      setCountdown(0);
    }
  };

  const handleReset = () => {
    setMessages([]);
    fetchPrompt();
  };

  const charCount = prompt.length;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <button onClick={() => navigate(-1 as any)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all self-start">
          <ArrowLeft size={14} /> Back
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">Test Chat</h2>
          <p className="text-[11px] text-muted-foreground">Preview your AI agent in action</p>
        </div>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-[hsl(0_0%_10%)] border border-[hsl(0_0%_18%)] text-muted-foreground hover:text-foreground hover:bg-[hsl(0_0%_14%)] transition-all"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* Split layout: System Prompt left + Chat right */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* LEFT — System Prompt */}
        <div className="flex-1 flex flex-col rounded-2xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_5%)] overflow-hidden shadow-lg shadow-black/20">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-foreground">System Prompt</h3>
            <div className="flex items-center gap-2">
              <button onClick={fetchPrompt} disabled={promptLoading} className="dark-btn-ghost h-7 px-2 text-xs border border-border">
                {promptLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Refresh
              </button>
              <button onClick={handleCopy} className="dark-btn-ghost h-7 px-2 text-xs border border-border">
                <Copy size={12} />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4 min-h-0">
            {prompt ? (
              <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/90">{prompt}</pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">Configure your agent settings and save to see the system prompt preview</p>
            )}
          </div>
          {prompt && (
            <div className="text-right px-4 py-1.5 border-t border-border shrink-0">
              <span className="text-[10px] text-muted-foreground">~{charCount.toLocaleString()} characters</span>
            </div>
          )}
        </div>

        {/* RIGHT — Chat */}
        <div className="flex-1 flex flex-col rounded-2xl border border-[hsl(0_0%_13%)] bg-[hsl(0_0%_5%)] overflow-hidden shadow-lg shadow-black/20">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-foreground">Test Chat</h3>
            <div className="flex items-center gap-2">
              {/* Manual/Auto mode toggle */}
              <div className="flex items-center gap-0.5 border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setDelaySec(0)}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    delaySec === 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => setDelaySec(delaySec === 0 ? -1 : delaySec)}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    delaySec !== 0 ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Auto
                </button>
              </div>
              {/* Response delay selector */}
              <div className="flex items-center gap-1">
                <Timer size={11} className="text-muted-foreground" />
                <div className="flex gap-0.5">
                  {DELAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setDelaySec(opt.value)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        delaySec === opt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="dark-btn-ghost h-8 px-3 text-xs gap-1.5 border border-border text-destructive hover:bg-destructive/10">
                  <Trash2 size={13} /> Clear Chat
                </button>
              )}
            </div>
          </div>

          <div ref={chatContainerRef} className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground italic text-center py-8">Send a message to test your AI agent</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}>
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                  {msg.role === "assistant" && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground">Using current settings</span>
                      {msg.responseTime && (
                        <span className="text-[9px] text-muted-foreground">{(msg.responseTime / 1000).toFixed(1)}s</span>
                      )}
                      {msg.provider && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                          msg.provider.toLowerCase().includes("claude")
                            ? "bg-purple-500/15 text-purple-400"
                            : "bg-success/15 text-success"
                        }`}>
                          {msg.provider.toLowerCase().includes("claude") ? "Claude" : "GPT-4o"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-3">
                  {countdown > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[10px] text-primary font-mono font-semibold">{countdown}s</span>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex gap-2 p-3 border-t border-border shrink-0">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Test a message..."
              className="dark-input flex-1"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 p-0 flex items-center justify-center"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TestChatPage;
