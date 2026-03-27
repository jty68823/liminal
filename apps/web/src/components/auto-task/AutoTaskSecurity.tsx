'use client';

import type { SecurityLevel } from '@/types/auto-task';

interface Props {
  value: SecurityLevel;
  onChange: (level: SecurityLevel) => void;
}

const LEVELS: Array<{
  level: SecurityLevel;
  label: string;
  description: string;
  icon: string;
  color: string;
}> = [
  {
    level: 1,
    label: '레벨 1 — 제한 없음',
    description: '모든 도구를 보안 검사 없이 자유롭게 실행합니다. 신뢰할 수 있는 환경에서만 사용하세요.',
    icon: '⚡',
    color: '#6366f1',
  },
  {
    level: 2,
    label: '레벨 2 — 표준 보안',
    description: '파일 바이러스 검사 및 기본 명령어 패턴 검증을 수행합니다.',
    icon: '🛡',
    color: '#f59e0b',
  },
  {
    level: 3,
    label: '레벨 3 — 고보안',
    description: '샌드박스 실행, AES-256 파일 암호화, SHA-256 해시 검증을 적용합니다.',
    icon: '🔒',
    color: '#ef4444',
  },
];

export function AutoTaskSecurity({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
        보안 레벨
      </p>
      <div className="space-y-1.5">
        {LEVELS.map(({ level, label, description, icon, color }) => {
          const isSelected = value === level;
          return (
            <button
              key={level}
              onClick={() => onChange(level)}
              className="w-full text-left rounded-lg px-3 py-2.5 glass transition-all duration-150"
              style={{
                border: isSelected ? `1px solid ${color}40` : '1px solid var(--glass-border)',
                boxShadow: isSelected ? `0 0 8px ${color}20` : 'none',
                background: isSelected ? `${color}10` : 'transparent',
              }}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontSize: '14px' }}>{icon}</span>
                <span
                  className="text-xs font-semibold"
                  style={{ color: isSelected ? color : 'var(--color-text-primary)' }}
                >
                  {label}
                </span>
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)', paddingLeft: '22px' }}>
                {description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
