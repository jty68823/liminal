'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Lazy load Sandpack to avoid SSR issues and reduce initial bundle
const SandpackBundle = dynamic(
  () => import('@codesandbox/sandpack-react').then(m => {
    function SandpackImpl({ content, showCode, onToggle }: { content: string; showCode: boolean; onToggle: () => void }) {
      const { SandpackProvider, SandpackPreview, SandpackCodeEditor } = m;
      return (
        <SandpackProvider
          template="react"
          files={{ '/App.js': content }}
          theme="dark"
          options={{ recompileMode: 'delayed', recompileDelay: 500 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={onToggle}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-secondary)',
                  border: '1px solid var(--color-border-default)',
                  cursor: 'pointer',
                }}
              >
                {showCode ? 'Preview' : 'Code'}
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {showCode ? (
                <SandpackCodeEditor style={{ height: '100%' }} />
              ) : (
                <SandpackPreview style={{ height: '100%' }} showNavigator={false} />
              )}
            </div>
          </div>
        </SandpackProvider>
      );
    }
    return { default: SandpackImpl };
  }),
  { ssr: false, loading: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', fontSize: '13px' }}>
      Loading React sandbox...
    </div>
  )}
);

export function ReactArtifact({ content }: { content: string }) {
  const [showCode, setShowCode] = useState(false);
  return <SandpackBundle content={content} showCode={showCode} onToggle={() => setShowCode(s => !s)} />;
}
