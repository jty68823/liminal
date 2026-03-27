'use client';

import { useState, useEffect } from 'react';

interface ArtifactVersion {
  id: string;
  version: number;
  content: string;
  createdAt: number;
}

interface Props {
  artifactId: string;
  currentVersion: number;
  onRestore?: (content: string) => void;
}

export function ArtifactVersionHistory({ artifactId, currentVersion, onRestore }: Props) {
  const [versions, setVersions] = useState<ArtifactVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(currentVersion);
  const [showDiff, setShowDiff] = useState(false);

  useEffect(() => {
    fetch(`http://localhost:3001/api/v1/artifacts/${artifactId}/versions`)
      .then((r) => r.json())
      .then((data) => setVersions(data.versions ?? []))
      .catch(() => {});
  }, [artifactId]);

  return (
    <div className="glass rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Version History
        </h4>
        <button
          onClick={() => setShowDiff(!showDiff)}
          className="text-xs px-2 py-0.5 rounded"
          style={{ color: 'var(--color-accent-primary)', background: 'var(--color-accent-subtle)' }}
        >
          {showDiff ? 'List' : 'Diff'}
        </button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {versions.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Single version</p>
        ) : (
          versions.map((v) => (
            <div
              key={v.id}
              className={`flex items-center justify-between px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                v.version === selectedVersion ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
              onClick={() => setSelectedVersion(v.version)}
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>v{v.version}</span>
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(v.createdAt).toLocaleTimeString()}
                </span>
                {v.version !== currentVersion && onRestore && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestore(v.content); }}
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--color-accent-primary)' }}
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
