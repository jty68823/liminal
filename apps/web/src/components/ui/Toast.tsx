'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useToastStore, type ToastType } from '@/store/toast.store';

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'rgba(34, 197, 94, 0.1)',
    border: 'rgba(34, 197, 94, 0.3)',
    icon: '\u2713',
  },
  error: {
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: '\u2715',
  },
  warning: {
    bg: 'rgba(234, 179, 8, 0.1)',
    border: 'rgba(234, 179, 8, 0.3)',
    icon: '\u26A0',
  },
  info: {
    bg: 'rgba(59, 130, 246, 0.1)',
    border: 'rgba(59, 130, 246, 0.3)',
    icon: '\u2139',
  },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      style={{ maxWidth: '380px' }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const style = typeStyles[toast.type];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="glass flex items-start gap-3 px-4 py-3 rounded-xl cursor-pointer"
              style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
              onClick={() => removeToast(toast.id)}
            >
              <span className="text-sm flex-shrink-0 mt-0.5">{style.icon}</span>
              <p
                className="text-sm leading-relaxed flex-1"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {toast.message}
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
