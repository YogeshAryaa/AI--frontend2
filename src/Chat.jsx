import { useEffect, useRef, useState } from "react";
import { api, streamChat } from "./api.js";
import { FileCard } from "./Files.jsx";

/* ── tiny markdown: **bold**, `code`, \n→<br>, ```blocks``` ── */
function Markdown({ text }) {
  if (!text) return null;
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {blocks.map((blk, i) => {
        if (blk.startsWith("```")) {
          const inner = blk.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return <pre key={i} className="c-code-block">{inner}</pre>;
        }
        return (
          <span key={i}>
            {blk.split("\n").map((line, j, arr) => (
              <span key={j}>
                {line.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((seg, k) => {
                  if (seg.startsWith("**") && seg.endsWith("**"))
                    return <strong key={k}>{seg.slice(2, -2)}</strong>;
                  if (seg.startsWith("`") && seg.endsWith("`"))
                    return <code key={k} className="c-inline-code">{seg.slice(1, -1)}</code>;
                  return <span key={k}>{seg}</span>;
                })}
                {j < arr.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

/* ── source / citation chips ── */
function Sources({ citations }) {
  const [open, setOpen] = useState(null);
  if (!citations?.length) return null;
  return (
    <div className="c-sources">
      <span className="c-sources-label">Sources</span>
      <div className="c-source-chips">
        {citations.map((c) => (
          <div key={c.index} className="c-source-item">
            <button
              className="c-chip"
              onClick={() => setOpen(open === c.index ? null : c.index)}
              aria-expanded={open === c.index}
            >
              <span className="c-chip-num">{c.index}</span>
              {c.title || c.doc_id}
            </button>
            {open === c.index && <p className="c-snippet">{c.snippet}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── thinking / typing indicator ── */
function Thinking() {
  return (
    <div className="c-thinking">
      <span /><span /><span />
    </div>
  );
}

/* ── single message row ── */
function Message({ m }) {
  const [saved, setSaved] = useState(false);

  if (m.role === "user") {
    return (
      <div className="c-row c-row--user">
        <div className="c-bubble c-bubble--user">
          <Markdown text={m.content} />
        </div>
      </div>
    );
  }

  const src = m.meta?.source;
  const badge =
    src === "database" ? "Your data" :
    src === "search" ? "Search" :
    src === "cache" ? "Cached" :
    src === "ai" ? (m.meta?.provider || "AI") :
    src === "local" ? "Instant" :
    src === "file" ? (m.meta?.provider === "pdf" ? "PDF" : "Image") :
    src === "none" ? "No match" : null;

  async function save() {
    await api.saveQA({ question: m.question, answer: m.content });
    setSaved(true);
  }

  return (
    <div className="c-row c-row--bot">
      <div className="c-avatar">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
          <path d="M9 12h6" /><path d="M12 12v6" />
          <circle cx="12" cy="21" r="1" />
        </svg>
      </div>
      <div className="c-bubble c-bubble--bot">
        {badge && (
          <span className={`c-badge c-badge--${src === "search" || src === "local" ? "database" : src}`}>
            {badge}
          </span>
        )}
        <div className="c-text">
          {!m.content && m.streaming ? (
            <Thinking />
          ) : (
            <Markdown text={m.content} />
          )}
          {m.streaming && m.content && <span className="c-cursor" />}
        </div>
        {m.error && <p className="c-error">{m.error}</p>}
        {(m.files || m.meta?.files || []).map((f) => <FileCard key={f.id} f={f} />)}
        <Sources citations={m.meta?.citations} />
        {!m.streaming && m.content && (
          <div className="c-actions">
            {src === "ai" && m.question && (
              <button className="c-action" onClick={save} disabled={saved} title="Save this answer to your knowledge base">
                {saved ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/></svg>
                )}
                <span>{saved ? "Saved" : "Save to data"}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── sidebar: conversation history ── */
function History({ current, onOpen, onNew, refresh }) {
  const [items, setItems] = useState([]);
  useEffect(() => { api.conversations().then(setItems).catch(() => {}); }, [refresh]);

  return (
    <aside className="c-sidebar" aria-label="Chat history">
      <button className="c-new-btn" onClick={onNew}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New chat
      </button>
      <div className="c-history-list">
        {items.map((c) => (
          <div key={c.id} className={`c-hist ${c.id === current ? "c-hist--active" : ""}`}>
            <button className="c-hist-title" onClick={() => onOpen(c.id)} title={c.title}>
              {c.title || "Untitled"}
            </button>
            <button
              className="c-hist-del"
              aria-label="Delete chat"
              onClick={async () => {
                if (!confirm("Delete this chat?")) return;
                await api.deleteConversation(c.id);
                setItems((s) => s.filter((x) => x.id !== c.id));
                if (c.id === current) onNew();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="c-sidebar-empty">Your chats will appear here</p>}
      </div>
    </aside>
  );
}

/* ── status pill (replaces the old wire animation) ── */
function StatusPill({ phase }) {
  if (phase === "idle") return null;
  const map = {
    searching: { text: "Searching your data…", cls: "searching" },
    database: { text: "Answered from your data", cls: "database" },
    cache: { text: "Cached answer", cls: "cache" },
    ai: { text: "AI response", cls: "ai" },
    local: { text: "Instant reply", cls: "database" },
    file: { text: "File created", cls: "cache" },
  };
  const s = map[phase] || { text: phase, cls: "ai" };
  return (
    <div className={`c-status c-status--${s.cls}`}>
      {phase === "searching" && <span className="c-status-dot" />}
      {s.text}
    </div>
  );
}

/* ── main chat view ── */
export default function Chat() {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [convId, setConvId] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const [fast, setFast] = useState(() => {
    try { return localStorage.getItem("fastSearch") === "1"; } catch { return false; }
  });
  const toggleFast = (v) => {
    setFast(v);
    try { localStorage.setItem("fastSearch", v ? "1" : "0"); } catch { /* ignore */ }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  // Auto-resize textarea
  const resizeTA = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  async function open(id) {
    if (busy) return;
    const c = await api.conversation(id);
    setConvId(id);
    setPhase("idle");
    setMsgs(c.messages.map((m) => ({ role: m.role, content: m.content, meta: m.meta, error: m.error })));
  }

  function newChat() {
    if (busy) return;
    setConvId(null);
    setMsgs([]);
    setPhase("idle");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", streaming: true, question: q }]);
    setInput("");
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    setBusy(true);
    setPhase("searching");
    const patch = (fn) => setMsgs((m) => [...m.slice(0, -1), fn(m[m.length - 1])]);
    try {
      await streamChat({ question: q, mode: fast ? "search" : "ai", conversation_id: convId }, (ev) => {
        if (ev.type === "meta") {
          if (ev.conversation_id && ev.conversation_id !== convId) { setConvId(ev.conversation_id); setRefresh((x) => x + 1); }
          if (!ev.source) return;
          setPhase(ev.source === "search" ? "database" : ev.source === "none" ? "idle" : ev.source);
          patch((x) => ({ ...x, meta: ev }));
        } else if (ev.type === "token") {
          patch((x) => ({ ...x, content: x.content + ev.text }));
        } else if (ev.type === "file") {
          setPhase("file");
          patch((x) => ({ ...x, files: [...(x.files || []), ev.file] }));
        } else if (ev.type === "error") {
          setPhase("idle");
          patch((x) => ({ ...x, error: ev.message }));
        }
      });
    } catch (e) {
      setPhase("idle");
      patch((x) => ({ ...x, error: `${e.message}. Check the Backend connection panel.` }));
    }
    patch((x) => ({ ...x, streaming: false }));
    setBusy(false);
  }

  return (
    <div className="c-wrap">
      <History current={convId} onOpen={open} onNew={newChat} refresh={refresh} />

      <section className="c-main">
        {/* Status pill */}
        <StatusPill phase={phase} />

        {/* Messages */}
        <div className="c-thread">
          {msgs.length === 0 && (
            <div className="c-welcome">
              <div className="c-welcome-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" /><path d="M12 8h.01" />
                </svg>
              </div>
              <h2>Ask anything about your data</h2>
              <p>English, Hindi, or Hinglish — your records are searched first, then AI fills in the rest.</p>
              <div className="c-suggestions">
                {[
                  "Pune me kitne Java developers hai?",
                  "Leave policy ki PDF bana do",
                  "Show all active candidates",
                ].map((s) => (
                  <button
                    key={s}
                    className="c-suggestion"
                    onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50); }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => (
            <Message key={i} m={m} />
          ))}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="c-composer-wrap">
          <form
            className="c-composer"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              placeholder="Message..."
              onChange={(e) => { setInput(e.target.value); resizeTA(e.target); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
            />
            <button className="c-send" disabled={busy || !input.trim()} type="submit" aria-label="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </form>
          <label className="c-fast-toggle">
            <input type="checkbox" checked={fast} onChange={(e) => toggleFast(e.target.checked)} />
            <span>Fast search (no AI, instant results)</span>
          </label>
        </div>
      </section>
    </div>
  );
}
