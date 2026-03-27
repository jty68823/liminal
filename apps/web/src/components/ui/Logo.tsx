'use client';

interface LogoProps {
  size?: number;
  className?: string;
  gradient?: boolean;
  glow?: boolean;
  color?: string;
}

export function Logo({ size = 24, className, gradient = false, glow = false, color }: LogoProps) {
  const gradId = 'liminal-logo-grad';
  const glowId = 'liminal-logo-glow';
  const useSolidColor = !!color;
  const fill = useSolidColor ? color : `url(#${gradId})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
      style={glow ? { filter: `url(#${glowId})` } : undefined}
    >
      <defs>
        {!useSolidColor && (
          gradient ? (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8a87c" />
              <stop offset="50%" stopColor="#d4956b" />
              <stop offset="100%" stopColor="#b87a50" />
            </linearGradient>
          ) : (
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4956b" />
              <stop offset="100%" stopColor="#b87a50" />
            </linearGradient>
          )
        )}
        {glow && (
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      {/* Left top: quarter-circle pie wedge */}
      <path
        d="M5 5 L52 5 A47 47 0 0 1 5 52 Z"
        fill={fill}
        opacity="0.95"
      />
      {/* Left bottom: rounded square */}
      <rect
        x="5" y="57" width="40" height="38" rx="10"
        fill={fill}
        opacity="0.9"
      />
      {/* Right: Gothic pointed arch */}
      <path
        d="M57 95 L57 38 A19 19 0 0 1 95 38 L95 95 Z"
        fill={fill}
      />
    </svg>
  );
}
