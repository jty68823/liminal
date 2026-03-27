'use client';

import React, { useState, useEffect, type ReactElement } from 'react';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

interface Props {
  rootPath: string;
}

export function FileTreeViewer({ rootPath }: Props) {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Build tree from root path using tools API
    fetch(`http://localhost:3001/api/v1/tools/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool: 'list_directory', input: { path: rootPath, recursive: false } }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.output) {
          const lines = data.output.split('\n').filter(Boolean);
          const root: TreeNode = { name: rootPath.split('/').pop() ?? rootPath, path: rootPath, type: 'directory', children: [] };
          for (const line of lines) {
            const isDir = line.endsWith('/');
            const name = isDir ? line.slice(0, -1) : line;
            root.children?.push({ name, path: `${rootPath}/${name}`, type: isDir ? 'directory' : 'file' });
          }
          setTree(root);
        }
      })
      .catch(() => setTree(null));
  }, [rootPath]);

  const toggleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth = 0): React.JSX.Element => (
    <div key={node.path} style={{ paddingLeft: depth * 16 }}>
      <div
        className="flex items-center gap-1.5 py-0.5 px-1 rounded text-sm cursor-pointer hover:bg-white/5"
        onClick={() => node.type === 'directory' && toggleExpand(node.path)}
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {node.type === 'directory' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ transform: expanded.has(node.path) ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="9 18 15 12 9 6" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          </svg>
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {node.type === 'directory' && expanded.has(node.path) && node.children?.map((child) => <React.Fragment key={child.path}>{renderNode(child, depth + 1)}</React.Fragment>)}
    </div>
  );

  if (!tree) return <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No project path set</div>;

  return <div className="text-sm font-mono">{renderNode(tree)}</div>;
}
