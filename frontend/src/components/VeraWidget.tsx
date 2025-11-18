import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";
import { MessageCircle } from "lucide-react";

// Simple Vera-specific types for the widget

type VeraRole = "user" | "assistant" | "system";

type VeraMode = "explain" | "docs_qa" | "guidance" | "troubleshoot" | "support";

interface VeraUiMessage {
  id: string;
  role: VeraRole;
  content: string;
  sources?: string[];
  ticketId?: string;
  suggestions?: string[];
}

const VERA_API_BASE =
  import.meta.env.VITE_VERA_API_BASE_URL || "http://localhost:4000";

const DOCS_BASE_URL = import.meta.env.VITE_DOCS_BASE_URL || "";

export const VeraWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<VeraUiMessage[]>(() => [
    {
      id: "intro-widget",
      role: "assistant",
      content:
        "Hey, I’m Vera. Ask me anything about Reputation DAO, soulbound reputation, or the Bitcoin-backed economy layer.",
    },
  ]);
  const [input, setInput] = useState("");
  const [mode] = useState<VeraMode>("explain");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );

  const dynamicSuggestions: string[] = useMemo(() => {
    if (latestAssistant?.suggestions && latestAssistant.suggestions.length > 0) {
      return latestAssistant.suggestions;
    }
    return [
      "What is Reputation DAO?",
      "How do I earn reputation?",
      "Explain the Bitcoin-backed trust layer.",
    ];
  }, [latestAssistant]);

  // Always keep the latest message in view when the conversation updates.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Use smooth scroll for nicer UX; fall back to instant if unsupported.
    try {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } catch {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  async function handleSend(promptOverride?: string) {
    const text = (promptOverride ?? input).trim();
    if (!text || isSending) return;

    const id = `user-${Date.now()}`;
    const userMessage: VeraUiMessage = {
      id,
      role: "user",
      content: text,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    if (!promptOverride) setInput("");
    setIsSending(true);

    try {
      const payload = {
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        mode,
      };

      const res = await fetch(`${VERA_API_BASE}/api/vera/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        throw new Error(errorText || `Request failed with status ${res.status}`);
      }

      const data: {
        answer: string;
        sources?: string[];
        ticketId?: string;
        suggestions?: string[];
      } = await res.json();

      const assistantMessage: VeraUiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        ticketId: data.ticketId,
        suggestions: data.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (_err) {
      const assistantMessage: VeraUiMessage = {
        id: `assistant-error-${Date.now()}`,
        role: "assistant",
        content:
          "I couldn’t reach my backend right now. Check that vera-backend is running and that VITE_VERA_API_BASE_URL is set correctly.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  }

  function handleQuickAsk(text: string) {
    void handleSend(text);
  }

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "Close Vera chat" : "Open Vera chat"}
        className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border/80 bg-background text-foreground shadow-lg shadow-black/30 transition hover:bg-card"
      >
        {isOpen ? "×" : <MessageCircle className="h-4 w-4" />}
      </button>

      {/* Widget panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-40 flex w-[360px] max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-glass-border bg-card/95 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-border/80 bg-background/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-md">
                V
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-foreground">Vera</span>
                <span className="text-[10px] text-muted-foreground">
                  Reputation DAO assistant
                </span>
              </div>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex max-h-[380px] flex-1 flex-col gap-3 overflow-y-auto bg-card px-3 py-3 text-xs"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[80%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-[11px] text-primary-foreground shadow-sm"
                      : "max-w-[80%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-[11px] text-foreground shadow-sm"
                  }
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-xs prose-invert max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        rehypePlugins={[rehypeSanitize]}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p>{m.content}</p>
                  )}

                  {(m.sources?.length || 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                      {m.sources?.slice(0, 3).map((src) => {
                        // src looks like "/docs/path/to/file.md" or "/docs/file.md#section"
                        const withoutPrefix = src.replace(/^\/docs\//, "");
                        const [pathPart, hashPart] = withoutPrefix.split("#");
                        const pathWithoutMd = pathPart.replace(/\.md$/, "");
                        const cleanedPath = hashPart
                          ? `${pathWithoutMd}#${hashPart}`
                          : pathWithoutMd;

                        const base = DOCS_BASE_URL.replace(/\/$/, "");
                        const href = `${base}/docs/${cleanedPath}`;

                        return (
                          <a
                            key={src}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-background/80 px-2 py-0.5 hover:bg-muted"
                          >
                            {cleanedPath}
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {m.ticketId && (
                    <div className="mt-1 text-[9px] text-primary-light">
                      Ticket {m.ticketId}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {dynamicSuggestions.length > 0 && (
            <div className="border-t border-border/80 bg-background/60 px-3 py-2">
              <div className="flex flex-wrap gap-1">
                {dynamicSuggestions.slice(0, 3).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleQuickAsk(s)}
                    className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="border-t border-border/80 bg-background/80 px-2 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="h-8 flex-1 rounded-lg border border-input bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-transparent focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Ask Vera…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="h-8 rounded-full bg-primary px-3 text-[11px] font-medium text-primary-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSending ? "..." : "Send"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
