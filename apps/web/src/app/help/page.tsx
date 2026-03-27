'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SectionDef {
  id: string;
  title: string;
  icon: React.ReactNode;
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function IconRocket() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function IconTool() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-4.96.44 2.5 2.5 0 01-2.96-3.08 3 3 0 01-.34-5.58 2.5 2.5 0 011.32-4.24 2.5 2.5 0 011.98-3A2.5 2.5 0 019.5 2z" />
      <path d="M14.5 2A2.5 2.5 0 0012 4.5v15a2.5 2.5 0 004.96.44 2.5 2.5 0 002.96-3.08 3 3 0 00.34-5.58 2.5 2.5 0 00-1.32-4.24 2.5 2.5 0 00-1.98-3A2.5 2.5 0 0014.5 2z" />
    </svg>
  );
}

function IconFolder() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconKeyboard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="10" x2="6" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="10" x2="10" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="14" y1="10" x2="14" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="10" x2="18" y2="10" strokeWidth="2" strokeLinecap="round" />
      <line x1="10" y1="14" x2="14" y2="14" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

// ─── Section definitions ────────────────────────────────────────────────────

const sections: SectionDef[] = [
  { id: 'getting-started', title: 'Getting Started', icon: <IconRocket /> },
  { id: 'chat-features', title: 'Chat Features', icon: <IconChat /> },
  { id: 'tools', title: 'Tools', icon: <IconTool /> },
  { id: 'artifacts', title: 'Artifacts', icon: <IconCode /> },
  { id: 'memory', title: 'Memory System', icon: <IconBrain /> },
  { id: 'projects', title: 'Projects', icon: <IconFolder /> },
  { id: 'cowork', title: 'Multi-Agent Cowork', icon: <IconUsers /> },
  { id: 'auto-task', title: 'Auto Task', icon: <IconZap /> },
  { id: 'shortcuts', title: 'Keyboard Shortcuts', icon: <IconKeyboard /> },
  { id: 'settings', title: 'Settings', icon: <IconSettings /> },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: <IconAlert /> },
];

// ─── Collapsible section component ──────────────────────────────────────────

function CollapsibleSection({
  id,
  title,
  icon,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0);

  useEffect(() => {
    if (open) {
      const el = contentRef.current;
      if (el) {
        setHeight(el.scrollHeight);
        const timer = setTimeout(() => setHeight(undefined), 300);
        return () => clearTimeout(timer);
      }
    } else {
      const el = contentRef.current;
      if (el) {
        setHeight(el.scrollHeight);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setHeight(0);
          });
        });
      }
    }
  }, [open]);

  return (
    <div
      id={id}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      className="glow-hover"
    >
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center gap-3 px-5 py-4 cursor-pointer"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--color-text-primary)',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent-subtle)',
            color: 'var(--color-accent-primary)',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span className="flex-1 font-semibold text-sm">{title}</span>
        <span
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s var(--ease-spring)',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <IconChevronDown />
        </span>
      </button>
      <div
        ref={contentRef}
        style={{
          height: height !== undefined ? height : 'auto',
          overflow: 'hidden',
          transition: 'height 0.3s var(--ease-out-expo), opacity 0.25s ease',
          opacity: open ? 1 : 0,
        }}
      >
        <div
          className="px-5 pb-5"
          style={{
            paddingLeft: 'calc(20px + 36px + 12px)',
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
            lineHeight: 1.7,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Keyboard shortcut badge ────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        lineHeight: 1.4,
        color: 'var(--color-text-primary)',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </kbd>
  );
}

// ─── Code block ─────────────────────────────────────────────────────────────

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: 'var(--color-code-bg)',
        border: '1px solid var(--color-code-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        overflowX: 'auto',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.6,
        color: 'var(--color-text-primary)',
        margin: '0.75em 0',
      }}
    >
      <code>{children}</code>
    </pre>
  );
}

// ─── Inline code ────────────────────────────────────────────────────────────

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.85em',
        background: 'var(--color-code-bg)',
        border: '1px solid var(--color-code-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '1px 5px',
        color: '#e0c9a6',
      }}
    >
      {children}
    </code>
  );
}

// ─── Section heading inside content ─────────────────────────────────────────

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontSize: '0.8rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-accent-primary)',
        marginTop: '1.2em',
        marginBottom: '0.5em',
      }}
    >
      {children}
    </h4>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Intersection observer to track active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex flex-1 overflow-hidden"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      {/* ── Side navigation (desktop) ── */}
      <nav
        className="hidden lg:flex flex-col w-56 flex-shrink-0 overflow-y-auto py-6 px-3"
        style={{
          borderRight: '1px solid var(--glass-border)',
        }}
      >
        <Link
          href="/chat"
          className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg text-xs font-medium"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <IconArrowLeft />
          Back to Chat
        </Link>

        <div
          className="text-xs font-semibold uppercase tracking-wider px-3 mb-3"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Guide
        </div>

        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-premium"
            style={{
              color:
                activeSection === s.id
                  ? 'var(--color-accent-primary)'
                  : 'var(--color-text-secondary)',
              background:
                activeSection === s.id
                  ? 'var(--color-accent-subtle)'
                  : 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span style={{ opacity: activeSection === s.id ? 1 : 0.6, display: 'flex' }}>
              {s.icon}
            </span>
            {s.title}
          </button>
        ))}
      </nav>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24"
        >
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/chat"
                className="lg:hidden flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <IconArrowLeft />
                Back
              </Link>
            </div>
            <h1
              className="text-gradient"
              style={{
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
                marginBottom: 8,
              }}
            >
              Help & Guide
            </h1>
            <p
              style={{
                color: 'var(--color-text-secondary)',
                fontSize: '0.95rem',
                maxWidth: 520,
                lineHeight: 1.6,
              }}
            >
              Everything you need to know about Liminal, your local AI assistant
              powered by Ollama. Browse sections below or use the side navigation.
            </p>
          </div>

          {/* Quick links (mobile-friendly) */}
          <div
            className="lg:hidden flex flex-wrap gap-2 mb-8"
          >
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  background: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent-primary)',
                  border: '1px solid rgba(212,149,107,0.15)',
                  cursor: 'pointer',
                }}
              >
                {s.title}
              </button>
            ))}
          </div>

          {/* Sections */}
          <div className="flex flex-col gap-4">
            {/* ── Getting Started ── */}
            <CollapsibleSection
              id="getting-started"
              title="Getting Started"
              icon={<IconRocket />}
              defaultOpen={true}
            >
              <p>
                Liminal is a locally-running AI assistant similar to Claude or ChatGPT,
                but powered entirely by local LLMs via{' '}
                <a
                  href="https://ollama.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent-primary)' }}
                >
                  Ollama
                </a>
                . Your data never leaves your machine.
              </p>

              <SubHeading>Prerequisites</SubHeading>
              <ul style={{ paddingLeft: '1.25em', margin: '0.5em 0' }}>
                <li>
                  <strong>Ollama</strong> installed and running ({' '}
                  <Code>ollama serve</Code> )
                </li>
                <li>
                  A model pulled locally, e.g. <Code>ollama pull deepseek-r1:8b</Code>
                </li>
                <li>
                  <strong>Node.js 18+</strong> and <strong>pnpm</strong>
                </li>
              </ul>

              <SubHeading>Launch the App</SubHeading>
              <p>Run both the API server and the web frontend:</p>
              <CodeBlock>{`# Terminal 1 — API server (port 3001)
pnpm --filter @liminal/api dev

# Terminal 2 — Web frontend (port 3000)
pnpm --filter @liminal/web dev`}</CodeBlock>
              <p>
                Then open{' '}
                <a
                  href="http://localhost:3000"
                  style={{ color: 'var(--color-accent-primary)' }}
                >
                  http://localhost:3000
                </a>{' '}
                in your browser and start your first conversation.
              </p>

              <SubHeading>Your First Chat</SubHeading>
              <p>
                Click <strong>&ldquo;New conversation&rdquo;</strong> in the sidebar or press{' '}
                <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd>. Type a message and press Enter. Liminal
                will stream the response from your local model in real-time.
              </p>
            </CollapsibleSection>

            {/* ── Chat Features ── */}
            <CollapsibleSection
              id="chat-features"
              title="Chat Features"
              icon={<IconChat />}
            >
              <SubHeading>Streaming Responses</SubHeading>
              <p>
                Responses stream token-by-token from your local Ollama instance via
                Server-Sent Events (SSE). A blinking cursor indicates the model is still
                generating. You can see each token as it arrives.
              </p>

              <SubHeading>Thinking Blocks</SubHeading>
              <p>
                When using models that support chain-of-thought reasoning (like
                DeepSeek-R1), Liminal displays collapsible <strong>thinking blocks</strong>{' '}
                showing the model&apos;s internal reasoning process before the final answer. This
                helps you understand how the model arrived at its response.
              </p>

              <SubHeading>Conversation History</SubHeading>
              <p>
                All conversations are automatically saved to a local SQLite database. Access
                past conversations from the sidebar. Conversations are grouped and can be
                filtered by project.
              </p>

              <SubHeading>Rich Markdown</SubHeading>
              <p>
                Messages support full Markdown rendering including headings, lists, tables,
                code blocks with syntax highlighting, blockquotes, and inline code.
              </p>
            </CollapsibleSection>

            {/* ── Tools ── */}
            <CollapsibleSection
              id="tools"
              title="Tools"
              icon={<IconTool />}
            >
              <p>
                Liminal uses a <strong>ReAct loop</strong> (Reason + Act) to give the AI the
                ability to interact with your system. The model decides when to call a tool,
                executes it, observes the result, then continues reasoning.
              </p>

              <SubHeading>Available Tools</SubHeading>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {[
                  {
                    name: 'Bash',
                    desc: 'Execute shell commands. Run scripts, install packages, manage processes.',
                  },
                  {
                    name: 'Filesystem',
                    desc: 'Read, write, and edit files. Create directories, list contents, search files.',
                  },
                  {
                    name: 'Git',
                    desc: 'Clone repos, check status, create commits, manage branches, view diffs.',
                  },
                  {
                    name: 'Web Search',
                    desc: 'Search the web for up-to-date information and documentation.',
                  },
                  {
                    name: 'MCP (Model Context Protocol)',
                    desc: 'Connect to external tool servers via the MCP standard for extensible capabilities.',
                  },
                  {
                    name: 'Computer Use',
                    desc: 'Control mouse and keyboard for GUI automation. Enable with ENABLE_COMPUTER_USE=1.',
                  },
                ].map((t) => (
                  <div
                    key={t.name}
                    style={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                    }}
                  >
                    <strong style={{ color: 'var(--color-text-primary)', fontSize: '0.8rem' }}>
                      {t.name}
                    </strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', opacity: 0.8 }}>
                      {t.desc}
                    </p>
                  </div>
                ))}
              </div>

              <SubHeading>How Tool Calls Work</SubHeading>
              <p>
                When the AI decides to use a tool, you&apos;ll see a collapsible{' '}
                <strong>tool call block</strong> in the chat showing the tool name, parameters,
                and the result. The model reads the result and incorporates it into its
                response.
              </p>
            </CollapsibleSection>

            {/* ── Artifacts ── */}
            <CollapsibleSection
              id="artifacts"
              title="Artifacts"
              icon={<IconCode />}
            >
              <p>
                Artifacts are rich, interactive content blocks that appear in a side panel
                next to the chat. They provide a better viewing experience for structured
                outputs.
              </p>

              <SubHeading>Supported Types</SubHeading>
              <ul style={{ paddingLeft: '1.25em', margin: '0.5em 0' }}>
                <li>
                  <strong>Code</strong> -- Syntax-highlighted source code in any language with
                  copy-to-clipboard support
                </li>
                <li>
                  <strong>HTML</strong> -- Live-rendered HTML pages with CSS in a sandboxed
                  iframe
                </li>
                <li>
                  <strong>React</strong> -- Live React components rendered via Sandpack with
                  real-time preview
                </li>
                <li>
                  <strong>Mermaid Diagrams</strong> -- Flowcharts, sequence diagrams, class
                  diagrams, and more rendered from Mermaid syntax
                </li>
              </ul>

              <SubHeading>Using Artifacts</SubHeading>
              <p>
                The AI automatically creates artifacts when generating code, diagrams, or
                interactive content. You can close the artifact panel with{' '}
                <Kbd>Ctrl</Kbd> + <Kbd>.</Kbd> and reopen it by clicking on the artifact
                reference in the chat.
              </p>
            </CollapsibleSection>

            {/* ── Memory System ── */}
            <CollapsibleSection
              id="memory"
              title="Memory System"
              icon={<IconBrain />}
            >
              <p>
                Liminal has a persistent memory system that remembers important facts about
                you across conversations.
              </p>

              <SubHeading>How It Works</SubHeading>
              <ul style={{ paddingLeft: '1.25em', margin: '0.5em 0' }}>
                <li>
                  The AI can save memories during conversations when it learns something
                  important about you or your preferences
                </li>
                <li>
                  Memories are stored as vector embeddings using the{' '}
                  <Code>nomic-embed-text</Code> model
                </li>
                <li>
                  Relevant memories are automatically retrieved via{' '}
                  <strong>vector similarity search</strong> when you start a new conversation
                </li>
                <li>
                  You can view and delete memories from the <strong>Memory</strong> section
                  in the sidebar
                </li>
              </ul>

              <SubHeading>Memory Storage</SubHeading>
              <p>
                All memory data is stored locally in your SQLite database at the path
                configured by the <Code>DATABASE_PATH</Code> environment variable (default:{' '}
                <Code>./data/liminal.db</Code>).
              </p>
            </CollapsibleSection>

            {/* ── Projects ── */}
            <CollapsibleSection
              id="projects"
              title="Projects"
              icon={<IconFolder />}
            >
              <p>
                Projects let you organize conversations and configure the AI for different
                contexts.
              </p>

              <SubHeading>Creating a Project</SubHeading>
              <p>
                Open the <strong>Projects</strong> section in the sidebar and click{' '}
                <strong>&ldquo;+ New project&rdquo;</strong>. Give it a name and press Enter.
              </p>

              <SubHeading>System Prompts</SubHeading>
              <p>
                Each project can have a custom <strong>system prompt</strong> that sets the
                AI&apos;s behavior and context for all conversations in that project. This is
                useful for specialized tasks like code review, writing, or analysis.
              </p>

              <SubHeading>File Roots</SubHeading>
              <p>
                Projects can specify <strong>file root directories</strong> that the AI should
                focus on. When a file root is set, the filesystem tools will operate relative
                to that directory, making it easy to work with specific codebases.
              </p>
            </CollapsibleSection>

            {/* ── Multi-Agent Cowork ── */}
            <CollapsibleSection
              id="cowork"
              title="Multi-Agent Cowork"
              icon={<IconUsers />}
            >
              <p>
                Cowork mode lets you spawn multiple AI agents that collaborate on complex
                tasks. Each agent can have a specialized role and they communicate through a
                shared workspace.
              </p>

              <SubHeading>Available Roles</SubHeading>
              <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                {[
                  { role: 'Architect', desc: 'Designs system architecture and high-level structure' },
                  { role: 'Coder', desc: 'Writes and refactors code based on specifications' },
                  { role: 'Reviewer', desc: 'Reviews code for bugs, quality, and best practices' },
                  { role: 'Researcher', desc: 'Gathers information and provides context' },
                  { role: 'Planner', desc: 'Breaks down tasks and creates action plans' },
                ].map((r) => (
                  <div
                    key={r.role}
                    className="flex items-start gap-3"
                    style={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '8px 12px',
                    }}
                  >
                    <span
                      style={{
                        color: 'var(--color-accent-primary)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        minWidth: 80,
                      }}
                    >
                      {r.role}
                    </span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>{r.desc}</span>
                  </div>
                ))}
              </div>

              <SubHeading>How to Use</SubHeading>
              <p>
                Click <strong>&ldquo;Cowork&rdquo;</strong> in the sidebar to open the cowork
                panel. Select agents and define a task. The agents will collaborate
                autonomously, sharing their progress in a visible workspace.
              </p>
            </CollapsibleSection>

            {/* ── Auto Task ── */}
            <CollapsibleSection
              id="auto-task"
              title="Auto Task"
              icon={<IconZap />}
            >
              <p>
                Auto Task enables autonomous task execution where the AI independently plans
                and carries out multi-step operations with minimal user intervention.
              </p>

              <SubHeading>How It Works</SubHeading>
              <ul style={{ paddingLeft: '1.25em', margin: '0.5em 0' }}>
                <li>Describe a high-level goal or task</li>
                <li>The AI breaks it down into steps and executes them sequentially</li>
                <li>Tool calls (bash, filesystem, git, etc.) are executed automatically</li>
                <li>Progress is shown in real-time in the Auto Task panel</li>
                <li>You can pause or stop execution at any time</li>
              </ul>

              <SubHeading>Best For</SubHeading>
              <p>
                Auto Task is ideal for repetitive or multi-step workflows like refactoring a
                codebase, setting up a new project from scratch, running a series of
                commands, or performing research that involves multiple web searches.
              </p>
            </CollapsibleSection>

            {/* ── Keyboard Shortcuts ── */}
            <CollapsibleSection
              id="shortcuts"
              title="Keyboard Shortcuts"
              icon={<IconKeyboard />}
            >
              <div
                style={{
                  display: 'grid',
                  gap: 2,
                }}
              >
                {[
                  { keys: ['Ctrl', 'K'], action: 'New chat / Quick switch' },
                  { keys: ['Ctrl', 'Shift', 'P'], action: 'Open command palette' },
                  { keys: ['Ctrl', '.'], action: 'Close artifact panel' },
                  { keys: ['Ctrl', 'Shift', 'N'], action: 'New conversation' },
                  { keys: ['Ctrl', 'Enter'], action: 'Send message' },
                  { keys: ['Escape'], action: 'Close panels / Cancel' },
                  { keys: ['Ctrl', '/'], action: 'Focus chat input' },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                    style={{
                      background: i % 2 === 0 ? 'var(--color-bg-elevated)' : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      {s.action}
                    </span>
                    <span className="flex items-center gap-1">
                      {s.keys.map((k, j) => (
                        <React.Fragment key={j}>
                          <Kbd>{k}</Kbd>
                          {j < s.keys.length - 1 && (
                            <span
                              style={{
                                color: 'var(--color-text-muted)',
                                fontSize: '0.7rem',
                                margin: '0 2px',
                              }}
                            >
                              +
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* ── Settings ── */}
            <CollapsibleSection
              id="settings"
              title="Settings"
              icon={<IconSettings />}
            >
              <p>
                Access settings from the gear icon in the sidebar footer, or navigate to{' '}
                <Link href="/settings" style={{ color: 'var(--color-accent-primary)' }}>
                  /settings
                </Link>
                .
              </p>

              <SubHeading>Model Selection</SubHeading>
              <p>
                Choose your default model from any model pulled to your local Ollama
                instance. The default is <Code>deepseek-r1:8b</Code>. You can also assign
                different models for different task types (general, coding, analysis).
              </p>

              <SubHeading>Provider Configuration</SubHeading>
              <p>
                Configure your Ollama host URL (default:{' '}
                <Code>http://localhost:11434</Code>). Test the connection directly from the
                settings page to verify Ollama is reachable.
              </p>

              <SubHeading>Appearance</SubHeading>
              <p>
                Customize the accent color, font size (small, medium, large), and other visual
                preferences. Changes are persisted in your browser&apos;s local storage.
              </p>
            </CollapsibleSection>

            {/* ── Troubleshooting ── */}
            <CollapsibleSection
              id="troubleshooting"
              title="Troubleshooting"
              icon={<IconAlert />}
            >
              <div style={{ display: 'grid', gap: 12 }}>
                {[
                  {
                    problem: 'Ollama not running',
                    solution:
                      'Make sure Ollama is installed and the server is running. Start it with `ollama serve` in a terminal. Verify by visiting http://localhost:11434 in your browser — you should see "Ollama is running".',
                  },
                  {
                    problem: 'Model not found',
                    solution:
                      'Pull the model first with `ollama pull deepseek-r1:8b` (or your preferred model). Check available models with `ollama list`.',
                  },
                  {
                    problem: 'Port 3001 already in use',
                    solution:
                      'Another process is using port 3001. Either stop that process or set a different port with the `API_PORT` environment variable.',
                  },
                  {
                    problem: 'Port 3000 already in use',
                    solution:
                      'The Next.js dev server defaults to 3000. If occupied, Next.js will automatically try 3001, 3002, etc. Make sure the API port does not conflict.',
                  },
                  {
                    problem: 'Slow responses',
                    solution:
                      'Response speed depends on your hardware. Try a smaller model (e.g., `deepseek-r1:1.5b`) for faster responses. Ensure no other heavy processes are competing for GPU/CPU resources.',
                  },
                  {
                    problem: 'Connection error in the UI',
                    solution:
                      'Check that both the API server (port 3001) and Ollama (port 11434) are running. Look at the connection indicator in the bottom-right of the screen for status details.',
                  },
                  {
                    problem: 'Embeddings not working',
                    solution:
                      'The memory system requires the `nomic-embed-text` model. Pull it with `ollama pull nomic-embed-text`.',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                    }}
                  >
                    <strong
                      style={{
                        color: 'var(--color-text-primary)',
                        fontSize: '0.8rem',
                        display: 'block',
                        marginBottom: 6,
                      }}
                    >
                      {item.problem}
                    </strong>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        opacity: 0.85,
                        lineHeight: 1.6,
                      }}
                    >
                      {item.solution}
                    </p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </div>

          {/* Footer */}
          <div
            className="mt-12 pt-6 text-center"
            style={{
              borderTop: '1px solid var(--glass-border)',
            }}
          >
            <p
              style={{
                color: 'var(--color-text-muted)',
                fontSize: '0.8rem',
              }}
            >
              Liminal -- Local AI assistant powered by Ollama.{' '}
              <Link href="/settings" style={{ color: 'var(--color-accent-primary)' }}>
                Settings
              </Link>{' '}
              /{' '}
              <Link href="/chat" style={{ color: 'var(--color-accent-primary)' }}>
                Back to Chat
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
