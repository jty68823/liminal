'use client';

// SSR-safe ambient particles — no runtime randomization
const PARTICLES = [
  { x: '8%', y: '15%', size: 3, delay: 0, duration: 7 },
  { x: '85%', y: '12%', size: 2, delay: 1.5, duration: 9 },
  { x: '22%', y: '75%', size: 2.5, delay: 3, duration: 8 },
  { x: '70%', y: '80%', size: 2, delay: 0.8, duration: 10 },
  { x: '45%', y: '8%', size: 3, delay: 2, duration: 7.5 },
  { x: '92%', y: '45%', size: 2, delay: 4, duration: 9.5 },
  { x: '15%', y: '55%', size: 2.5, delay: 1, duration: 8.5 },
  { x: '60%', y: '25%', size: 2, delay: 3.5, duration: 11 },
  { x: '35%', y: '90%', size: 3, delay: 2.5, duration: 7 },
  { x: '78%', y: '60%', size: 2, delay: 0.5, duration: 10 },
  { x: '50%', y: '40%', size: 2.5, delay: 4.5, duration: 8 },
  { x: '5%', y: '35%', size: 2, delay: 1.8, duration: 9 },
  { x: '88%', y: '88%', size: 3, delay: 3.2, duration: 7.5 },
  { x: '30%', y: '20%', size: 2, delay: 2.8, duration: 10 },
  { x: '65%', y: '70%', size: 2.5, delay: 0.3, duration: 8.5 },
  { x: '42%', y: '55%', size: 2, delay: 5, duration: 9 },
];

export function AmbientParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-float"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            background: 'var(--color-accent-primary)',
            opacity: 0.04 + (i % 3) * 0.015,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            filter: 'blur(0.5px)',
          }}
        />
      ))}
    </div>
  );
}
