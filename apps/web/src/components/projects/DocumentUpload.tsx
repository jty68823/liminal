'use client';

import { useState, useRef } from 'react';

interface Props {
  projectId?: string;
  onUploadComplete?: () => void;
}

export function DocumentUpload({ projectId, onUploadComplete }: Props) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setStatus(null);

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      if (projectId) form.append('project_id', projectId);

      try {
        const res = await fetch('http://localhost:3001/api/v1/documents', {
          method: 'POST',
          body: form,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        setStatus(`Uploaded: ${file.name}`);
      } catch (err) {
        setStatus(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
      }
    }

    setUploading(false);
    onUploadComplete?.();
  };

  return (
    <div
      className={`glass rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-2 border-[var(--color-accent-primary)]' : 'border border-dashed border-[var(--color-border)]'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.txt,.md,.ts,.tsx,.js,.jsx,.py,.rs,.go,.json,.csv"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />
      <svg className="mx-auto mb-3" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
        PDF, TXT, MD, Code files supported
      </p>
      {status && (
        <p className="text-xs mt-2" style={{ color: status.startsWith('Error') ? '#ef4444' : 'var(--color-accent-primary)' }}>
          {status}
        </p>
      )}
    </div>
  );
}
