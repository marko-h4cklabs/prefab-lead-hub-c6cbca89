import { useState, useRef, useCallback } from "react";
import { Mic, Square, Send, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AudioPlayer from "./AudioPlayer";

interface VoiceRecorderProps {
  onSend: (blob: Blob) => Promise<void>;
}

const VoiceRecorder = ({ onSend }: VoiceRecorderProps) => {
  const [state, setState] = useState<"idle" | "recording" | "preview" | "sending">("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        setState("preview");
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setState("recording");
    } catch {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voice messages.", variant: "destructive" });
    }
  }, []);

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudioBlob(null);
    setPreviewUrl(null);
    setState("idle");
  };

  const handleSend = async () => {
    if (!audioBlob) return;
    setState("sending");
    try {
      await onSend(audioBlob);
      discard();
    } catch {
      setState("preview");
    }
  };

  if (state === "idle") {
    return (
      <button
        onClick={startRecording}
        className="industrial-btn-ghost h-[25px] px-3 border border-border"
        title="Record voice message"
      >
        <Mic size={14} />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs font-mono text-destructive">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          Recording…
        </span>
        <button onClick={stopRecording} className="industrial-btn-ghost h-[25px] px-3 border border-destructive/50 text-destructive">
          <Square size={12} />
        </button>
      </div>
    );
  }

  // preview or sending
  return (
    <div className="flex items-center gap-2 flex-1">
      {previewUrl && <AudioPlayer src={previewUrl} className="flex-1" />}
      <button
        onClick={handleSend}
        disabled={state === "sending"}
        className="industrial-btn-accent h-[25px] px-3"
      >
        {state === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
      <button
        onClick={discard}
        disabled={state === "sending"}
        className="industrial-btn-ghost h-[25px] px-3"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default VoiceRecorder;
