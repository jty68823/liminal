'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { useChatStore } from '@/store/chat.store';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function ConversationPage() {
  const params = useParams();
  const id = params.id as string;

  const setCurrentConversation = useChatStore((s) => s.setCurrentConversation);
  const loadConversations = useChatStore((s) => s.loadConversations);

  useEffect(() => {
    if (id) {
      setCurrentConversation(id);
      loadConversations();
    }
  }, [id, setCurrentConversation, loadConversations]);

  return <ChatWindow conversationId={id} welcomeMode={false} />;
}
