import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, TeamMember } from '@ftp/shared';
import { api } from '../services/apiClient.js';

const POLL_MS = 3000;
const COMPACT_HEIGHT = 60;
const EXPANDED_HEIGHT = 280;

export function TeamChat({ teamId, members }: { teamId: string; members: TeamMember[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const [glow, setGlow] = useState(false);
  const [sending, setSending] = useState(false);
  const sinceRef = useRef<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Poll for new messages.
  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const { messages: fresh } = await api.getTeamChat(teamId, sinceRef.current);
        if (!active || fresh.length === 0) return;
        sinceRef.current = fresh[fresh.length - 1]!.at;
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const added = fresh.filter((m) => !known.has(m.id));
          return added.length ? [...prev, ...added] : prev;
        });
        if (!expanded) {
          setGlow(true);
          setTimeout(() => setGlow(false), 2500);
        }
      } catch {
        // network blip — ignore
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => { active = false; clearInterval(id); };
  }, [teamId, expanded]);

  // Scroll to bottom when messages arrive while expanded.
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, expanded]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    try {
      const { message } = await api.postTeamChat(teamId, trimmed);
      sinceRef.current = message.at;
      setMessages((prev) => [...prev, message]);
    } catch {
      setText(trimmed); // restore on error
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  const lastMsg = messages[messages.length - 1];
  const lastLine = lastMsg
    ? `${shortName(lastMsg.name, members, lastMsg.userId)}: ${lastMsg.text}`
    : 'No messages yet';

  function avatar(userId: string) {
    return members.find((m) => m.userId === userId)?.avatarEmoji ?? '🧑';
  }

  function shortName(name: string, mbrs: TeamMember[], userId: string) {
    const member = mbrs.find((m) => m.userId === userId);
    return (member?.name ?? name).split(' ')[0];
  }

  const height = expanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'var(--color-surface, #fff)',
        borderTop: '1px solid var(--color-border, #e5e7eb)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
        height,
        transition: 'height 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Compact bar / expanded header */}
      <div
        style={{
          height: COMPACT_HEIGHT,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 12px',
          cursor: 'pointer',
        }}
        onClick={() => {
          const opening = !expanded;
          setExpanded(opening);
          setGlow(false);
          if (opening) setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <span
          style={{
            fontSize: '1.3rem',
            animation: glow ? 'chat-glow 0.6s ease-in-out infinite alternate' : undefined,
            filter: glow ? 'drop-shadow(0 0 6px #f59e0b)' : undefined,
          }}
        >
          💬
        </span>

        {!expanded && (
          <span
            style={{
              flex: 1,
              fontSize: '0.82rem',
              color: 'var(--color-ink-soft, #6b7280)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {lastLine}
          </span>
        )}

        {expanded && (
          <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600 }}>Team chat</span>
        )}

        <span style={{ fontSize: '0.75rem', color: 'var(--color-ink-soft, #6b7280)' }}>
          {expanded ? '▼' : '▲'}
        </span>
      </div>

      {/* Expanded: scrollable messages */}
      {expanded && (
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {messages.length === 0 && (
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-ink-soft, #6b7280)', textAlign: 'center', paddingTop: 16 }}>
              No messages yet — say hi!
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{avatar(m.userId)}</span>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-ink, #111)' }}>
                  {shortName(m.name, members, m.userId)}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-ink, #111)', marginLeft: 6 }}>{m.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send bar — always visible */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 12px',
          paddingBottom: expanded ? 10 : 0,
          height: expanded ? 'auto' : 0,
          overflow: expanded ? 'visible' : 'hidden',
          alignItems: 'center',
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message…"
          disabled={sending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && text.trim()) {
              e.preventDefault();
              void send();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1, fontSize: '0.9rem', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--color-border, #e5e7eb)' }}
        />
        <button
          disabled={sending || !text.trim()}
          onClick={(e) => { e.stopPropagation(); void send(); }}
          style={{
            background: 'var(--color-accent, #0ea5e9)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: '1rem',
            cursor: 'pointer',
            opacity: sending || !text.trim() ? 0.5 : 1,
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
