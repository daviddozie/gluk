"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import GlukLogo from "./svg";

interface MessageBubbleProps {
  message: Message;
  theme: "light" | "dark";
}

interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text, isDark }: { text: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer transition-all ${isDark
          ? "text-white/40 hover:text-white/80 hover:bg-white/8"
          : "text-black/40 hover:text-black/80 hover:bg-black/6"
        }`}
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ─── Karaoke Markdown ─────────────────────────────────────────────────────────
// Renders full markdown — tables, code blocks, headings — completely intact.
// Words in text nodes are individually wrapped in <span>s for highlight.
// The layout NEVER changes; we just add colour on top.

function KaraokeMarkdown({
  content,
  words,
  currentTime,
  isDark,
}: {
  content: string;
  words: WordTimestamp[];
  currentTime: number;
  isDark: boolean;
}) {
  let wordCounter = 0;

  const activeIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );
  const allDone = words.length > 0 && currentTime > words[words.length - 1].end;

  function wrapText(text: string): React.ReactNode {
    const tokens = text.split(/(\s+)/);
    return tokens.map((token, i) => {
      if (/^\s+$/.test(token) || token === "") return token;
      const idx = wordCounter++;
      const isActive = idx === activeIdx;
      const isPast =
        allDone ||
        (activeIdx !== -1 && idx < activeIdx) ||
        (activeIdx === -1 && currentTime > 0 && words[idx] && currentTime > words[idx].end);
      return (
        <span
          key={i}
          className={`transition-colors duration-75 rounded-sm ${isActive
              ? isDark
                ? "bg-white/25 text-white font-medium"
                : "bg-black/18 text-black font-medium"
              : isPast
                ? isDark
                  ? "text-white/35"
                  : "text-black/35"
                : ""
            }`}
        >
          {token}
        </span>
      );
    });
  }

  function processChildren(children: React.ReactNode): React.ReactNode {
    return React.Children.map(children, (child) => {
      if (typeof child === "string") return wrapText(child);
      if (typeof child === "number" || !child) return child;
      if (React.isValidElement(child)) {
        const el = child as React.ReactElement<Record<string, unknown>>;
        if (el.props.children !== undefined) {
          return React.cloneElement(el, {
            ...el.props,
            children: processChildren(el.props.children as React.ReactNode),
          });
        }
      }
      return child;
    });
  }

  const karaokeComponents: React.ComponentProps<typeof ReactMarkdown>["components"] = {
    p({ children }) {
      return <p className="mb-3 last:mb-0 leading-7">{processChildren(children)}</p>;
    },
    h1({ children }) {
      return <h1 className={`text-xl font-semibold mb-3 mt-4 ${isDark ? "text-white" : "text-black"}`}>{processChildren(children)}</h1>;
    },
    h2({ children }) {
      return <h2 className={`text-lg font-semibold mb-2 mt-4 ${isDark ? "text-white" : "text-black"}`}>{processChildren(children)}</h2>;
    },
    h3({ children }) {
      return <h3 className={`text-base font-semibold mb-2 mt-3 ${isDark ? "text-white" : "text-black"}`}>{processChildren(children)}</h3>;
    },
    strong({ children }) {
      return <strong className={`font-semibold ${isDark ? "text-white" : "text-black"}`}>{processChildren(children)}</strong>;
    },
    blockquote({ children }) {
      return (
        <blockquote className={`border-l-2 pl-4 italic my-3 transition-colors duration-300 ${isDark ? "border-white/20 text-white/60" : "border-black/20 text-black/60"}`}>
          {processChildren(children)}
        </blockquote>
      );
    },
    li({ children }) { return <li className="leading-6">{processChildren(children)}</li>; },
    ul({ children }) {
      return <ul className={`list-disc list-inside mb-3 space-y-1 ${isDark ? "text-white/80" : "text-black/75"}`}>{children}</ul>;
    },
    ol({ children }) {
      return <ol className={`list-decimal list-inside mb-3 space-y-1 ${isDark ? "text-white/80" : "text-black/75"}`}>{children}</ol>;
    },
    a({ children, href }) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className={`underline underline-offset-2 transition-colors ${isDark ? "text-white hover:text-white/70" : "text-blue-600 hover:text-blue-500"}`}>
          {processChildren(children)}
        </a>
      );
    },
    // Tables — preserve layout exactly, wrap cell text only
    table({ children }) {
      return <div className="overflow-x-auto my-3"><table className="w-full border-collapse text-sm">{children}</table></div>;
    },
    th({ children }) {
      return (
        <th className={`border px-3 py-2 text-left font-semibold transition-colors duration-300 ${isDark ? "border-white/10 bg-white/4" : "border-black/10 bg-black/4"}`}>
          {processChildren(children)}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className={`border px-3 py-2 transition-colors duration-300 ${isDark ? "border-white/10" : "border-black/10"}`}>
          {processChildren(children)}
        </td>
      );
    },
    // Code — never highlight inside code
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");
      const isInline = !match && !String(children).includes("\n");
      if (isInline) {
        return (
          <code className={`px-1.5 py-0.5 rounded text-[0.85em] font-mono border transition-colors duration-300 ${isDark ? "bg-white/8 text-white/90 border-white/8" : "bg-black/6 text-black/80 border-black/10"}`} {...props}>
            {children}
          </code>
        );
      }
      return (
        <div className={`my-3 rounded-xl overflow-hidden border transition-colors duration-300 ${isDark ? "border-white/8" : "border-black/10"}`}>
          <div className={`flex items-center justify-between px-4 py-2 border-b transition-colors duration-300 ${isDark ? "bg-white/4 border-white/6" : "bg-black/4 border-black/8"}`}>
            <span className={`text-xs font-mono ${isDark ? "text-white/40" : "text-black/50"}`}>{match ? match[1] : "code"}</span>
            <CopyButton text={codeString} isDark={isDark} />
          </div>
          <SyntaxHighlighter style={oneDark} language={match ? match[1] : "text"} PreTag="div"
            customStyle={{ margin: 0, padding: "1rem", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)", fontSize: "0.8rem", lineHeight: "1.6" }}>
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    },
    hr() { return <hr className={`my-4 transition-colors duration-300 ${isDark ? "border-white/10" : "border-black/10"}`} />; },
  };

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={karaokeComponents}>
      {content}
    </ReactMarkdown>
  );
}

// ─── TTS Controls ─────────────────────────────────────────────────────────────

type TtsState = "idle" | "loading" | "playing" | "paused";

function TtsControls({
  text,
  isDark,
  onWordsLoaded,
  onTimeUpdate,
  onStop,
}: {
  text: string;
  isDark: boolean;
  onWordsLoaded: (words: WordTimestamp[]) => void;
  onTimeUpdate: (time: number) => void;
  onStop: () => void;
}) {
  const [state, setState] = useState<TtsState>("idle");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cachedBlobUrlRef = useRef<string | null>(null);
  const cachedWordsRef = useRef<WordTimestamp[]>([]);
  const rafRef = useRef<number | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const chunkQueueRef = useRef<ArrayBuffer[]>([]);
  const appendingRef = useRef(false);
  const doneStreamingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Accumulates every received chunk so we can cache even on mid-stream stop
  const allChunksRef = useRef<BlobPart[]>([]);

  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const tick = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      onTimeUpdate(audioRef.current.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [onTimeUpdate]);

  const recalibrateTimestamps = useCallback(
    (audio: HTMLAudioElement, rawWords: WordTimestamp[]): WordTimestamp[] => {
      if (!rawWords.length) return rawWords;
      const estimatedTotal = rawWords[rawWords.length - 1].end;
      const realDuration = audio.duration;
      if (!isFinite(realDuration) || realDuration <= 0 || estimatedTotal <= 0) return rawWords;
      const scale = realDuration / estimatedTotal;
      return rawWords.map((w) => ({ word: w.word, start: w.start * scale, end: w.end * scale }));
    },
    []
  );

  // Attach recalibration listener to an audio element — fires on durationchange
  // and also on the first few timeupdate events so highlights lock in quickly
  const attachRecalibration = useCallback(
    (audio: HTMLAudioElement, rawWords: WordTimestamp[]) => {
      let calibrated = false;
      const tryCalibrate = () => {
        if (calibrated || !isFinite(audio.duration) || audio.duration <= 0) return;
        calibrated = true;
        const words = recalibrateTimestamps(audio, rawWords);
        cachedWordsRef.current = words;
        onWordsLoaded(words);
      };
      audio.addEventListener("durationchange", tryCalibrate);
      audio.addEventListener("timeupdate", tryCalibrate);
    },
    [recalibrateTimestamps, onWordsLoaded]
  );

  const flushQueue = useCallback(() => {
    const sb = sourceBufferRef.current;
    const ms = mediaSourceRef.current;
    if (!sb || appendingRef.current || chunkQueueRef.current.length === 0) return;
    if (ms && ms.readyState !== "open") return;
    const chunk = chunkQueueRef.current.shift()!;
    appendingRef.current = true;
    try { sb.appendBuffer(chunk); }
    catch (e) { console.error("appendBuffer:", e); appendingRef.current = false; }
  }, []);

  // Persist whatever chunks have arrived so far as a blob URL (idempotent)
  const saveCacheFromChunks = useCallback(() => {
    if (!cachedBlobUrlRef.current && allChunksRef.current.length > 0) {
      const blob = new Blob(allChunksRef.current, { type: "audio/mpeg" });
      cachedBlobUrlRef.current = URL.createObjectURL(blob);
    }
  }, []);

  const teardownMediaSource = useCallback(() => {
    saveCacheFromChunks();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    chunkQueueRef.current = [];
    appendingRef.current = false;
    const ms = mediaSourceRef.current;
    if (ms && ms.readyState === "open") { try { ms.endOfStream(); } catch { /* ignore */ } }
    mediaSourceRef.current = null;
    sourceBufferRef.current = null;
    doneStreamingRef.current = false;
  }, [saveCacheFromChunks]);

  const handlePause = useCallback(() => {
    stopRaf();
    audioRef.current?.pause();
    setState("paused");
  }, [stopRaf]);

  const handleResume = useCallback(async () => {
    if (!audioRef.current) return;
    try {
      await audioRef.current.play();
      setState("playing");
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) { console.error("Resume error:", e); }
  }, [tick]);

  const handleRestart = useCallback(async () => {
    stopRaf();
    saveCacheFromChunks();
    if (!cachedBlobUrlRef.current) return;
    onWordsLoaded(cachedWordsRef.current);
    onTimeUpdate(0);
    audioRef.current?.pause();
    const audio = new Audio(cachedBlobUrlRef.current);
    audioRef.current = audio;
    audio.onpause = () => stopRaf();
    audio.onended = () => { stopRaf(); onStop(); setState("idle"); };
    audio.onerror = () => { stopRaf(); setState("idle"); onStop(); };
    try {
      await audio.play();
      setState("playing");
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) { console.error("Restart error:", e); setState("idle"); }
  }, [stopRaf, saveCacheFromChunks, tick, onWordsLoaded, onTimeUpdate, onStop]);

  const handleStop = useCallback(() => {
    stopRaf();
    teardownMediaSource(); // saves partial cache inside before aborting
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    onStop();
    setState("idle");
  }, [stopRaf, teardownMediaSource, onStop]);

  const handleFirstPlay = useCallback(async () => {
    // ── Use cached blob (no API call, no noise) ──────────────────────────
    if (cachedBlobUrlRef.current) {
      onWordsLoaded(cachedWordsRef.current);
      onTimeUpdate(0);
      audioRef.current?.pause();
      // Always create a fresh Audio element — avoids any residual MediaSource state
      const audio = new Audio(cachedBlobUrlRef.current);
      audioRef.current = audio;
      audio.onpause = () => stopRaf();
      audio.onended = () => { stopRaf(); onStop(); setState("idle"); };
      audio.onerror = () => { stopRaf(); setState("idle"); onStop(); };
      try {
        await audio.play();
        setState("playing");
        rafRef.current = requestAnimationFrame(tick);
      } catch (e) { setState("idle"); }
      return;
    }

    // ── First-ever play: fetch from API ──────────────────────────────────
    setState("loading");
    allChunksRef.current = [];
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("TTS failed");

      let rawWords: WordTimestamp[] = [];
      const wordsHeader = res.headers.get("X-Word-Timestamps");
      if (wordsHeader) {
        try { rawWords = JSON.parse(atob(wordsHeader)) as WordTimestamp[]; } catch { /* ignore */ }
      }

      const mimeType = "audio/mpeg";
      const supportsMediaSource =
        typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(mimeType);

      if (supportsMediaSource) {
        const ms = new MediaSource();
        mediaSourceRef.current = ms;
        doneStreamingRef.current = false;
        const msUrl = URL.createObjectURL(ms);
        const audio = new Audio(msUrl);
        audioRef.current = audio;

        if (rawWords.length) attachRecalibration(audio, rawWords);

        audio.onpause = () => stopRaf();
        audio.onended = () => {
          stopRaf(); onStop(); setState("idle");
          saveCacheFromChunks();
        };
        audio.onerror = () => { stopRaf(); setState("idle"); onStop(); };

        ms.addEventListener("sourceopen", async () => {
          URL.revokeObjectURL(msUrl);
          const sb = ms.addSourceBuffer(mimeType);
          sourceBufferRef.current = sb;

          sb.addEventListener("updateend", () => {
            appendingRef.current = false;
            if (chunkQueueRef.current.length > 0) {
              flushQueue();
            } else if (doneStreamingRef.current && ms.readyState === "open") {
              try { ms.endOfStream(); } catch { /* ignore */ }
            }
          });

          const reader = res.body!.getReader();
          let started = false;
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                doneStreamingRef.current = true;
                if (chunkQueueRef.current.length === 0 && !appendingRef.current && ms.readyState === "open") {
                  try { ms.endOfStream(); } catch { /* ignore */ }
                }
                saveCacheFromChunks(); // full audio now cached
                break;
              }
              if (value) {
                allChunksRef.current.push(value.slice()); // accumulate for caching
                chunkQueueRef.current.push(value.buffer as ArrayBuffer);
                flushQueue();
                if (!started) {
                  started = true;
                  // Show raw heuristic words immediately so karaoke starts right away;
                  // attachRecalibration will update them once real duration is known.
                  if (rawWords.length) { cachedWordsRef.current = rawWords; onWordsLoaded(rawWords); }
                  audio.play().catch(() => { setState("idle"); onStop(); });
                  setState("playing");
                  rafRef.current = requestAnimationFrame(tick);
                }
              }
            }
          } catch (err: unknown) {
            if (err instanceof Error && err.name !== "AbortError") console.error("Stream error:", err);
          }
        });

      } else {
        // Safari: buffer everything first
        const reader = res.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) allChunksRef.current.push(value);
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== "AbortError") throw err;
          return;
        }
        saveCacheFromChunks();
        const audio = new Audio(cachedBlobUrlRef.current!);
        audioRef.current = audio;
        if (rawWords.length) attachRecalibration(audio, rawWords);
        audio.onpause = () => stopRaf();
        audio.onended = () => { stopRaf(); onStop(); setState("idle"); };
        audio.onerror = () => { stopRaf(); setState("idle"); onStop(); };
        await audio.play();
        setState("playing");
        rafRef.current = requestAnimationFrame(tick);
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("TTS error:", err);
      setState("idle");
      onStop();
    }
  }, [text, tick, flushQueue, stopRaf, saveCacheFromChunks, attachRecalibration, onTimeUpdate, onStop]);

  useEffect(
    () => () => {
      stopRaf();
      teardownMediaSource();
      audioRef.current?.pause();
      if (cachedBlobUrlRef.current) URL.revokeObjectURL(cachedBlobUrlRef.current);
    },
    [stopRaf, teardownMediaSource]
  );

  const btnClass = `flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer transition-all ${isDark ? "text-white/40 hover:text-white/80 hover:bg-white/8" : "text-black/40 hover:text-black/80 hover:bg-black/6"
    }`;
  const activeBtnClass = `${btnClass} ${isDark ? "!text-white/80" : "!text-black/80"}`;

  if (state === "idle") {
    return (
      <button onClick={handleFirstPlay} title="Read aloud" className={btnClass}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
        Speak
      </button>
    );
  }

  if (state === "loading") {
    return (
      <button disabled className={`${btnClass} opacity-60`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Loading…
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {state === "playing" ? (
        <button onClick={handlePause} title="Pause" className={activeBtnClass}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          Pause
        </button>
      ) : (
        <button onClick={handleResume} title="Resume" className={activeBtnClass}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Resume
        </button>
      )}
      <button onClick={handleRestart} title="Restart from beginning" className={activeBtnClass}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.5" />
        </svg>
        Restart
      </button>
      <button onClick={handleStop} title="Stop" className={activeBtnClass}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
        Stop
      </button>
    </div>
  );
}

// ─── Typing / Streaming indicators ───────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-2 h-2 rounded-full bg-current opacity-60 animate-bounce" style={{ animationDelay: "300ms" }} />
    </div>
  );
}

function StreamingCursor() {
  return <span className="inline-block w-[2px] h-[1em] bg-current opacity-70 ml-0.5 align-middle animate-pulse" />;
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

export default function MessageBubble({ message, theme }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const { data: session } = useSession();
  const isDark = theme === "dark";

  const [ttsWords, setTtsWords] = useState<WordTimestamp[]>([]);
  const [ttsTime, setTtsTime] = useState(0);
  const isSpeaking = ttsWords.length > 0;

  const handleWordsLoaded = useCallback((words: WordTimestamp[]) => { setTtsWords(words); setTtsTime(0); }, []);
  const handleTimeUpdate = useCallback((t: number) => setTtsTime(t), []);
  const handleStop = useCallback(() => { setTtsWords([]); setTtsTime(0); }, []);

  const getInitials = () => {
    const name = session?.user?.name;
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`flex gap-2 sm:gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-300 ${isUser
            ? "bg-black text-white dark:bg-white dark:text-black"
            : isDark
              ? "bg-white/6 border border-white/10 text-white"
              : "bg-black/6 border border-black/10 text-black"
          }`}
      >
        {isUser ? getInitials() : <GlukLogo size={16} />}
      </div>

      <div className={`flex flex-col gap-1 max-w-[88%] sm:max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {isUser ? (
          <div className="flex flex-col gap-2 items-end">
            {message.files && message.files.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-end">
                {message.files.map((f, i) => (
                  <div key={i} className={`w-16 h-16 rounded-xl overflow-hidden border flex items-center justify-center shrink-0 transition-colors duration-300 ${isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/5"}`}>
                    {f.type.startsWith("image/") ? (
                      <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 px-1">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDark ? "text-white/60" : "text-black/60"}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className={`text-[9px] truncate w-full text-center ${isDark ? "text-white/40" : "text-black/50"}`}>
                          {f.name.length > 7 ? f.name.slice(0, 6) + "…" : f.name}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {message.content && (
              <div className={`border rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed transition-colors duration-300 ${isDark ? "bg-white/8 border-white/8 text-white/90" : "bg-black/6 border-black/8 text-black/85"}`}>
                {message.content}
              </div>
            )}
          </div>
        ) : (
          <div className={`text-sm leading-relaxed w-full transition-colors duration-300 ${isDark ? "text-white/85" : "text-black/80"}`}>
            {message.isStreaming && !message.content ? (
              <TypingIndicator />
            ) : (
              <>
                {isSpeaking ? (
                  <KaraokeMarkdown
                    content={message.content}
                    words={ttsWords}
                    currentTime={ttsTime}
                    isDark={isDark}
                  />
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const codeString = String(children).replace(/\n$/, "");
                        const isInline = !match && !String(children).includes("\n");
                        if (isInline) {
                          return <code className={`px-1.5 py-0.5 rounded text-[0.85em] font-mono border transition-colors duration-300 ${isDark ? "bg-white/8 text-white/90 border-white/8" : "bg-black/6 text-black/80 border-black/10"}`} {...props}>{children}</code>;
                        }
                        return (
                          <div className={`my-3 rounded-xl overflow-hidden border transition-colors duration-300 ${isDark ? "border-white/8" : "border-black/10"}`}>
                            <div className={`flex items-center justify-between px-4 py-2 border-b transition-colors duration-300 ${isDark ? "bg-white/4 border-white/6" : "bg-black/4 border-black/8"}`}>
                              <span className={`text-xs font-mono ${isDark ? "text-white/40" : "text-black/50"}`}>{match ? match[1] : "code"}</span>
                              <CopyButton text={codeString} isDark={isDark} />
                            </div>
                            <SyntaxHighlighter style={oneDark} language={match ? match[1] : "text"} PreTag="div"
                              customStyle={{ margin: 0, padding: "1rem", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.03)", fontSize: "0.8rem", lineHeight: "1.6" }}>
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        );
                      },
                      p({ children }) { return <p className="mb-3 last:mb-0 leading-7">{children}</p>; },
                      h1({ children }) { return <h1 className={`text-xl font-semibold mb-3 mt-4 ${isDark ? "text-white" : "text-black"}`}>{children}</h1>; },
                      h2({ children }) { return <h2 className={`text-lg font-semibold mb-2 mt-4 ${isDark ? "text-white" : "text-black"}`}>{children}</h2>; },
                      h3({ children }) { return <h3 className={`text-base font-semibold mb-2 mt-3 ${isDark ? "text-white" : "text-black"}`}>{children}</h3>; },
                      ul({ children }) { return <ul className={`list-disc list-inside mb-3 space-y-1 ${isDark ? "text-white/80" : "text-black/75"}`}>{children}</ul>; },
                      ol({ children }) { return <ol className={`list-decimal list-inside mb-3 space-y-1 ${isDark ? "text-white/80" : "text-black/75"}`}>{children}</ol>; },
                      li({ children }) { return <li className="leading-6">{children}</li>; },
                      blockquote({ children }) { return <blockquote className={`border-l-2 pl-4 italic my-3 transition-colors duration-300 ${isDark ? "border-white/20 text-white/60" : "border-black/20 text-black/60"}`}>{children}</blockquote>; },
                      strong({ children }) { return <strong className={`font-semibold ${isDark ? "text-white" : "text-black"}`}>{children}</strong>; },
                      a({ children, href }) { return <a href={href} target="_blank" rel="noopener noreferrer" className={`underline underline-offset-2 transition-colors ${isDark ? "text-white hover:text-white/70" : "text-blue-600 hover:text-blue-500"}`}>{children}</a>; },
                      table({ children }) { return <div className="overflow-x-auto my-3"><table className="w-full border-collapse text-sm">{children}</table></div>; },
                      th({ children }) { return <th className={`border px-3 py-2 text-left font-semibold transition-colors duration-300 ${isDark ? "border-white/10 bg-white/4" : "border-black/10 bg-black/4"}`}>{children}</th>; },
                      td({ children }) { return <td className={`border px-3 py-2 transition-colors duration-300 ${isDark ? "border-white/10" : "border-black/10"}`}>{children}</td>; },
                      hr() { return <hr className={`my-4 transition-colors duration-300 ${isDark ? "border-white/10" : "border-black/10"}`} />; },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
                {message.isStreaming && <StreamingCursor />}
              </>
            )}
          </div>
        )}

        {!isUser && !message.isStreaming && message.content && (
          <div className="flex items-center gap-1 mt-1">
            <CopyButton text={message.content} isDark={isDark} />
            <TtsControls
              text={message.content}
              isDark={isDark}
              onWordsLoaded={handleWordsLoaded}
              onTimeUpdate={handleTimeUpdate}
              onStop={handleStop}
            />
          </div>
        )}
      </div>
    </div>
  );
}