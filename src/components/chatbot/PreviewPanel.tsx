import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "@/lib/apiClient";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, RefreshCw, Send, Loader2, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  provider?: string;
}

const PreviewPanel = ({ refreshKey }: { refreshKey: number }) => {
  const [tab, setTab] = useState("prompt");

  // System prompt state
  const [prompt, setPrompt] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => { fetchPrompt(); }, [fetchPrompt, refreshKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);
    try {
      const res = await api.testBehavior({ message: userMsg });
      const content = (res as any)?.reply || (res as any)?.response || (res as any)?.message || (res as any)?.content || String(res);
      const provider = (res as any)?.provider || "";
      setMessages((prev) => [...prev, { role: "assistant", content, provider }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err?.message || "Failed to get response"}` }]);
    } finally {
      setSending(false);
    }
  };

  const charCount = prompt.length;

  return (
    <div className="dark-card h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground">Preview</h3>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-2 bg-secondary">
          <TabsTrigger value="prompt" className="text-xs">System Prompt</TabsTrigger>
          <TabsTrigger value="chat" className="text-xs">Test Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="prompt" className="flex-1 flex flex-col min-h-0 px-4 pb-4 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <button onClick={fetchPrompt} disabled={promptLoading} className="dark-btn-ghost h-7 px-2 text-xs border border-border">
              {promptLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
            <button onClick={handleCopy} className="dark-btn-ghost h-7 px-2 text-xs border border-border">
              <Copy size={12} />
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <div className="flex-1 overflow-auto rounded-lg bg-secondary p-4 min-h-0">
            {prompt ? (
              <pre className="text-xs font-mono whitespace-pre-wrap text-foreground/90">{prompt}</pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">Configure your agent settings and save to see the system prompt preview</p>
            )}
          </div>
          {prompt && (
            <div className="text-right mt-1">
              <span className="text-[10px] text-muted-foreground">~{charCount.toLocaleString()} characters</span>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 px-4 pb-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground">This is a test — no lead or message is saved</span>
            {messages.length > 0 && (
              <button onClick={() => setMessages([])} className="dark-btn-ghost h-6 px-2 text-[10px] gap-1">
                <Trash2 size={10} /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto rounded-lg bg-secondary p-3 space-y-3 min-h-0">
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
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex gap-2 mt-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Test a message..."
              className="dark-input flex-1"
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="dark-btn bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-10 p-0 flex items-center justify-center"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PreviewPanel;
