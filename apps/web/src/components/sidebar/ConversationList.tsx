'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useChatStore, type Conversation } from '@/store/chat.store';

interface ConversationGroup {
  label: string;
  items: Conversation[];
}

function groupConversations(conversations: Conversation[]): ConversationGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);

  const today: Conversation[] = [];
  const yesterday: Conversation[] = [];
  const thisWeek: Conversation[] = [];
  const older: Conversation[] = [];

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt ?? conv.createdAt);
    if (date >= todayStart) {
      today.push(conv);
    } else if (date >= yesterdayStart) {
      yesterday.push(conv);
    } else if (date >= weekStart) {
      thisWeek.push(conv);
    } else {
      older.push(conv);
    }
  }

  const groups: ConversationGroup[] = [];
  if (today.length > 0) groups.push({ label: 'Today', items: today });
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
  if (thisWeek.length > 0) groups.push({ label: 'This week', items: thisWeek });
  if (older.length > 0) groups.push({ label: 'Older', items: older });

  return groups;
}

function truncateTitle(title: string, maxLen = 38): string {
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen - 1) + '\u2026';
}

/** Memoized individual conversation item to avoid re-rendering the entire list */
const ConversationItem = React.memo(function ConversationItem({
  conv,
  isActive,
  onSelect,
}: {
  conv: Conversation;
  isActive: boolean;
  onSelect?: () => void;
}) {
  return (
    <Link
      href={`/chat/${conv.id}`}
      onClick={onSelect}
      className={`conversation-item flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left group ${isActive ? 'active' : ''}`}
      style={{
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-shrink-0 opacity-50"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="text-sm truncate flex-1 leading-snug">
        {truncateTitle(conv.title ?? 'Untitled conversation')}
      </span>
      {isActive && (
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            background: 'var(--color-accent-primary)',
            boxShadow: '0 0 6px rgba(212,149,107,0.4)',
          }}
        />
      )}
    </Link>
  );
});

interface Props {
  onSelect?: () => void;
}

export function ConversationList({ onSelect }: Props) {
  const conversations = useChatStore((s) => s.conversations);
  const params = useParams();
  const currentId = params?.id as string | undefined;

  const groups = useMemo(() => {
    const sorted = [...conversations].sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime()
    );
    return groupConversations(sorted);
  }, [conversations]);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
          style={{ background: 'var(--color-bg-elevated)', boxShadow: 'var(--shadow-sm)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)' }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          No conversations yet
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
          Start a new chat to begin
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <div key={group.label} className="mb-2">
          <p
            className="px-3 py-1 text-xs font-medium uppercase tracking-wider"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {group.label}
          </p>
          {group.items.map((conv) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === currentId}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
