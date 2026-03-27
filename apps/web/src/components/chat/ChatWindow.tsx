'use client';

import { useRouter } from 'next/navigation';
import { useChatStore } from '@/store/chat.store';
import { useArtifactStore } from '@/store/artifact.store';
import { MessageList } from './MessageList';
import { InputBar } from './InputBar';
import { ArtifactPanel } from '@/components/artifacts/ArtifactPanel';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  conversationId: string | null;
  welcomeMode: boolean;
}

export function ChatWindow({ conversationId, welcomeMode }: Props) {
  const router = useRouter();
  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const { isOpen: artifactOpen } = useArtifactStore();

  const handleSend = async (content: string, images?: string[]) => {
    if (!content.trim() || isStreaming) return;

    try {
      await sendMessage(content, images, conversationId);

      if (welcomeMode) {
        const newId = useChatStore.getState().currentConversationId;
        if (newId) {
          router.push(`/chat/${newId}`);
        }
      }
    } catch (err) {
      console.error('Send failed:', err);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left pane — message area */}
      <div
        className="flex flex-col h-full transition-all duration-300"
        style={{
          width: artifactOpen ? '50%' : '100%',
          borderRight: artifactOpen ? '1px solid var(--color-border-subtle)' : 'none',
        }}
      >
        {!welcomeMode && (
          <div className="flex-1 overflow-hidden">
            <MessageList />
          </div>
        )}
        {welcomeMode && <div className="flex-1" />}

        <div
          className="px-4 pb-4 pt-2"
          style={{
            background:
              'linear-gradient(to top, var(--color-bg-primary) 80%, transparent)',
          }}
        >
          <div className="max-w-2xl mx-auto">
            <InputBar onSend={handleSend} disabled={isStreaming} />
          </div>
        </div>
      </div>

      {/* Right pane — artifact panel with spring animation */}
      <AnimatePresence>
        {artifactOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '50%', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="h-full overflow-hidden"
          >
            <ArtifactPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
