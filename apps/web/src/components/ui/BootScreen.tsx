'use client';

import { useState, useEffect } from 'react';

interface BootScreenProps {
  onComplete: () => void;
  /** Skip animation and immediately call onComplete (e.g. for revisits) */
  skip?: boolean;
}

/**
 * Boot animation: the three logo shapes (quarter-circle, rounded square, gothic arch)
 * fly in from different directions and assemble into the Liminal logo,
 * then the title fades in and the screen dissolves away.
 *
 * Total duration: ~2.8s
 */
export function BootScreen({ onComplete, skip = false }: BootScreenProps) {
  const [phase, setPhase] = useState<'shapes' | 'assemble' | 'title' | 'fadeout' | 'done'>(
    skip ? 'done' : 'shapes'
  );

  useEffect(() => {
    if (skip) {
      onComplete();
      return;
    }

    const timers = [
      setTimeout(() => setPhase('assemble'), 400),
      setTimeout(() => setPhase('title'), 1200),
      setTimeout(() => setPhase('fadeout'), 2200),
      setTimeout(() => {
        setPhase('done');
        onComplete();
      }, 2800),
    ];

    return () => timers.forEach(clearTimeout);
  }, [skip, onComplete]);

  if (phase === 'done') return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0b',
        opacity: phase === 'fadeout' ? 0 : 1,
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: phase === 'fadeout' ? 'none' : 'all',
      }}
    >
      {/* Ambient glow behind logo */}
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,149,107,0.12) 0%, transparent 70%)',
          opacity: phase === 'shapes' ? 0 : 1,
          transform: phase === 'shapes' ? 'scale(0.5)' : 'scale(1)',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo SVG with animated shapes */}
      <svg
        width={120}
        height={120}
        viewBox="0 0 100 100"
        fill="none"
        style={{ marginBottom: 32, position: 'relative', zIndex: 1 }}
      >
        <defs>
          <linearGradient id="boot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8a87c" />
            <stop offset="50%" stopColor="#d4956b" />
            <stop offset="100%" stopColor="#b87a50" />
          </linearGradient>
          <filter id="boot-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Quarter-circle — flies in from top-left */}
        <path
          d="M5 5 L52 5 A47 47 0 0 1 5 52 Z"
          fill="url(#boot-grad)"
          opacity="0.95"
          style={{
            transform:
              phase === 'shapes'
                ? 'translate(-60px, -60px) scale(0.6) rotate(-45deg)'
                : 'translate(0, 0) scale(1) rotate(0deg)',
            transformOrigin: '28px 28px',
            transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
            opacity: phase === 'shapes' ? 0 : 0.95,
            filter: phase !== 'shapes' ? 'url(#boot-glow)' : undefined,
          }}
        />

        {/* Rounded square — flies in from bottom-left */}
        <rect
          x="5" y="57" width="40" height="38" rx="10"
          fill="url(#boot-grad)"
          style={{
            transform:
              phase === 'shapes'
                ? 'translate(-50px, 60px) scale(0.6) rotate(30deg)'
                : 'translate(0, 0) scale(1) rotate(0deg)',
            transformOrigin: '25px 76px',
            transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s, opacity 0.4s ease 0.1s',
            opacity: phase === 'shapes' ? 0 : 0.9,
            filter: phase !== 'shapes' ? 'url(#boot-glow)' : undefined,
          }}
        />

        {/* Gothic arch — flies in from right */}
        <path
          d="M57 95 L57 38 A19 19 0 0 1 95 38 L95 95 Z"
          fill="url(#boot-grad)"
          style={{
            transform:
              phase === 'shapes'
                ? 'translate(60px, 20px) scale(0.6) rotate(15deg)'
                : 'translate(0, 0) scale(1) rotate(0deg)',
            transformOrigin: '76px 66px',
            transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s, opacity 0.4s ease 0.2s',
            opacity: phase === 'shapes' ? 0 : 1,
            filter: phase !== 'shapes' ? 'url(#boot-glow)' : undefined,
          }}
        />
      </svg>

      {/* Title */}
      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          letterSpacing: '-0.03em',
          fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif",
          background: 'linear-gradient(135deg, #e8c4a0, #d4956b, #b87a50)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          opacity: phase === 'title' || phase === 'fadeout' ? 1 : 0,
          transform: phase === 'title' || phase === 'fadeout' ? 'translateY(0)' : 'translateY(12px)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          marginBottom: 8,
          position: 'relative',
          zIndex: 1,
        }}
      >
        Liminal
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: '0.8125rem',
          color: '#6b6b65',
          fontFamily: "'Inter', -apple-system, 'Segoe UI', sans-serif",
          letterSpacing: '0.04em',
          opacity: phase === 'title' || phase === 'fadeout' ? 1 : 0,
          transform: phase === 'title' || phase === 'fadeout' ? 'translateY(0)' : 'translateY(8px)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s',
          position: 'relative',
          zIndex: 1,
        }}
      >
        Local AI Interface
      </p>
    </div>
  );
}
