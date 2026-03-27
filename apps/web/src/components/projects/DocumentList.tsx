'use client';

import { useState, useEffect } from 'react';

interface Document {
  id: string;
  filename: string;
  mimeType: string | null;
  status: string;
  chunkCount: number | null;
  createdAt: number;
}

interface Props {
  projectId?: string;
  refreshTrigger?: number;
}

export function DocumentList({ projectId, refreshTrigger }: Props) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = projectId
      ? `http://localhost:3001/api/v1/documents?project_id=${projectId}`
      : 'http://localhost:3001/api/v1/documents';

    fetch(url)
      .then((r) => r.json())
      .then((data) => setDocs(data.documents ?? []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [projectId, refreshTrigger]);

  const handleDelete = async (id: string) => {
    await fetch(`http://localhost:3001/api/v1/documents/${id}`, { method: 'DELETE' });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  if (loading) return <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading documents...</div>;
  if (docs.length === 0) return <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No documents yet.</div>;

  const statusColors: Record<string, string> = {
    ready: '#4caf7d',
    processing: 'var(--color-accent-primary)',
    pending: 'var(--color-text-muted)',
    error: '#ef4444',
  };

  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <div key={doc.id} className="glass rounded-lg px-3 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="truncate" style={{ color: 'var(--color-text-primary)' }}>{doc.filename}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
              color: statusColors[doc.status] ?? 'var(--color-text-muted)',
              background: `${statusColors[doc.status] ?? 'var(--color-text-muted)'}15`,
            }}>
              {doc.status} {doc.chunkCount ? `(${doc.chunkCount} chunks)` : ''}
            </span>
          </div>
          <button
            onClick={() => handleDelete(doc.id)}
            className="text-xs opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: '#ef4444' }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
