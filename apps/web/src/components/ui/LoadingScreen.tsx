'use client';

import { Logo } from '@/components/ui/Logo';

interface LoadingScreenProps {
  message?: string;
  visible: boolean;
}

export function LoadingScreen({ message = 'Loading…', visible }: LoadingScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-bg-primary)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'all' : 'none',
        transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Subtle radial background glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(212,149,107,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo container */}
      <div
        className="animate-float animate-pulse-glow"
        style={{
          position: 'relative',
          width: 72,
          height: 72,
          marginBottom: 28,
          borderRadius: 18,
          background: 'var(--color-bg-primary)',
          border: '1px solid rgba(212,149,107,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow:
            '0 0 0 1px rgba(212,149,107,0.12), 0 0 30px rgba(212,149,107,0.12), 0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Inner corner accent glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 17,
            background:
              'radial-gradient(circle at 30% 30%, rgba(212,149,107,0.08) 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />
        <Logo size={38} gradient glow />
      </div>

      {/* "Liminal" title */}
      <h1
        className="text-gradient"
        style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginBottom: 12,
          fontFamily: 'var(--font-sans)',
        }}
      >
        Liminal
      </h1>

      {/* Status message with animated dots */}
      <p
        className="loading-dots"
        style={{
          fontSize: '0.8125rem',
          color: 'var(--color-text-muted)',
          marginBottom: 32,
          fontFamily: 'var(--font-sans)',
          letterSpacing: '0.02em',
        }}
      >
        {message}
      </p>

      {/* Progress bar */}
      <div
        style={{
          width: 160,
          height: 2,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          className="loading-progress-bar"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 2,
            background:
              'linear-gradient(90deg, transparent 0%, var(--color-accent-primary) 40%, rgba(232,196,160,0.9) 60%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>

      {/* CSS-only animated dots + progress bar shimmer */}
      <style>{`
        @keyframes loadingDotsAnim {
          0%   { content: ''; }
          25%  { content: '.'; }
          50%  { content: '..'; }
          75%  { content: '...'; }
          100% { content: ''; }
        }
        .loading-dots::after {
          content: '';
          display: inline-block;
          width: 1.5em;
          text-align: left;
          animation: loadingDotsAnim 1.8s steps(1, end) infinite;
        }
        @keyframes progressShimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .loading-progress-bar {
          animation: progressShimmer 1.6s linear infinite;
        }
      `}</style>
    </div>
  );
}
