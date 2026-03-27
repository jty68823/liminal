'use client';

import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chat.store';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { AmbientParticles } from '@/components/ui/AmbientParticles';
import { Logo } from '@/components/ui/Logo';

/* ── Suggestion card data ── */
interface SuggestionCard {
  icon: string;
  label: string;
  prompt: string;
}

const SUGGESTION_CARDS: SuggestionCard[] = [
  {
    icon: '⟨/⟩',
    label: 'Explain Code',
    prompt: 'Explain what this code does and how it works, step by step.',
  },
  {
    icon: '✓',
    label: 'Write Tests',
    prompt: 'Write comprehensive unit tests for the following function, covering edge cases.',
  },
  {
    icon: '⚙',
    label: 'Debug Issue',
    prompt: 'Help me debug this issue. Here is the error and the relevant code:',
  },
  {
    icon: '✦',
    label: 'Brainstorm Ideas',
    prompt: 'Brainstorm 10 creative ideas for a developer tool that could be built in a weekend.',
  },
  {
    icon: '◈',
    label: 'Analyze Data',
    prompt: 'Analyze the following data and summarize the key insights and patterns.',
  },
  {
    icon: '⬡',
    label: 'Draft Document',
    prompt: 'Draft a clear, well-structured technical document for the following topic:',
  },
];

/* ── Page component ── */
export default function ChatPage() {
  const router = useRouter();
  const sendMessage = useChatStore((s) => s.sendMessage);

  const handleSuggestion = async (prompt: string) => {
    try {
      await sendMessage(prompt);
      const id = useChatStore.getState().currentConversationId;
      if (id) {
        router.push(`/chat/${id}`);
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  return (
    <div
      className="flex flex-col h-full relative"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* Ambient particle layer */}
      <AmbientParticles />

      {/* Scrollable hero + suggestions area */}
      <div
        className="flex-1 flex flex-col items-center justify-start overflow-y-auto relative"
        style={{ zIndex: 10, paddingTop: '6vh', paddingBottom: 24 }}
      >
        <div className="w-full max-w-2xl px-4">

          {/* ── Hero Section ── */}
          <div
            className="text-center"
            style={{ marginBottom: 48 }}
          >
            {/* Logo badge */}
            <div
              className="animate-float"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 80,
                height: 80,
                borderRadius: 20,
                background: 'var(--color-bg-primary)',
                border: '1px solid rgba(212,149,107,0.25)',
                boxShadow:
                  '0 0 0 1px rgba(212,149,107,0.1), 0 0 40px rgba(212,149,107,0.1), 0 12px 40px rgba(0,0,0,0.5)',
                marginBottom: 28,
                position: 'relative',
                animation: 'messageSlideUp 0.5s var(--ease-out-expo) forwards, float 7s ease-in-out 0.5s infinite',
              }}
            >
              {/* Corner radial accent */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 19,
                  background:
                    'radial-gradient(circle at 25% 25%, rgba(212,149,107,0.12) 0%, transparent 55%)',
                  pointerEvents: 'none',
                }}
              />
              <Logo size={42} gradient glow />
            </div>

            {/* Title */}
            <h1
              className="text-gradient"
              style={{
                fontSize: 'clamp(2rem, 5vw, 2.75rem)',
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                marginBottom: 14,
                fontFamily: 'var(--font-sans)',
                animation: 'messageSlideUp 0.55s var(--ease-out-expo) 0.1s both',
              }}
            >
              Liminal
            </h1>

            {/* Subtitle */}
            <p
              style={{
                fontSize: '1rem',
                color: 'var(--color-text-secondary)',
                letterSpacing: '0.01em',
                fontFamily: 'var(--font-sans)',
                animation: 'messageSlideUp 0.55s var(--ease-out-expo) 0.2s both',
              }}
            >
              Your local AI — powered by Ollama
            </p>
          </div>

          {/* ── Suggestion Cards 2×3 Grid ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 12,
              marginBottom: 32,
            }}
          >
            {SUGGESTION_CARDS.map((card, idx) => (
              <button
                key={card.label}
                onClick={() => handleSuggestion(card.prompt)}
                className="glass glow-hover btn-ripple prompt-card"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  animation: `messageSlideUp 0.45s var(--ease-out-expo) ${0.25 + idx * 0.07}s both`,
                }}
              >
                {/* Icon badge */}
                <div
                  className="prompt-icon"
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: 'var(--color-accent-subtle)',
                    border: '1px solid rgba(212,149,107,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.875rem',
                    color: 'var(--color-accent-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                  }}
                >
                  {card.icon}
                </div>

                {/* Label + hint */}
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      marginBottom: 2,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    {card.label}
                  </p>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-muted)',
                      lineHeight: 1.4,
                      fontFamily: 'var(--font-sans)',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {card.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* ── Chat Input (welcome mode) ── */}
          <div
            style={{
              animation: 'messageSlideUp 0.45s var(--ease-out-expo) 0.72s both',
            }}
          >
            <ChatWindow conversationId={null} welcomeMode />
          </div>
        </div>
      </div>
    </div>
  );
}
