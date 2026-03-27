'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  version: string | null;
  author: string | null;
  riskScore: number | null;
  enabled: number;
  sourceUrl: string | null;
  installedAt: number;
}

interface MarketplaceSkill {
  name: string;
  description: string;
  version: string;
  author: string;
  risk_score: number;
}

export function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceSkill[]>([]);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    try {
      const res = await fetch('/api/v1/skills');
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills ?? []);
      }
    } catch { /* ignore */ }
  };

  const loadMarketplace = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/skills/marketplace/browse');
      if (res.ok) {
        const data = await res.json();
        setMarketplace(data.skills ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const toggleSkill = async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/v1/skills/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      loadSkills();
    } catch { /* ignore */ }
  };

  const removeSkill = async (id: string) => {
    try {
      await fetch(`/api/v1/skills/${id}`, { method: 'DELETE' });
      loadSkills();
    } catch { /* ignore */ }
  };

  const verifySkill = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/skills/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        loadSkills(); // Refresh to get updated risk score
      }
    } catch { /* ignore */ }
  };

  const riskColor = (score: number) => {
    if (score <= 10) return '#22c55e';
    if (score <= 30) return '#eab308';
    if (score <= 60) return '#f97316';
    return '#ef4444';
  };

  const filteredSkills = skills.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-3">
      {/* Search */}
      <input
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search skills..."
        className="w-full text-xs px-3 py-2 rounded-lg bg-transparent border focus:outline-none neon-focus"
        style={{ borderColor: 'var(--color-border-default)', color: 'var(--color-text-primary)' }}
      />

      {/* Installed Skills */}
      <div className="space-y-1.5">
        {filteredSkills.length === 0 && (
          <p className="text-xs px-2 py-1" style={{ color: 'var(--color-text-muted)' }}>
            No skills installed
          </p>
        )}
        <AnimatePresence>
          {filteredSkills.map((skill) => (
            <motion.div
              key={skill.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="glass rounded-lg p-2.5"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleSkill(skill.id, !!skill.enabled)}
                  className="w-8 h-4 rounded-full flex-shrink-0 relative"
                  style={{
                    background: skill.enabled ? 'var(--color-accent-primary)' : 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                  }}
                >
                  <span
                    className="absolute top-0.5 w-3 h-3 rounded-full bg-white"
                    style={{
                      left: skill.enabled ? '16px' : '2px',
                      transition: 'left 0.2s var(--ease-spring)',
                    }}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {skill.name}
                  </p>
                </div>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${riskColor(skill.riskScore ?? 0)}20`,
                    color: riskColor(skill.riskScore ?? 0),
                    fontSize: '10px',
                  }}
                >
                  {skill.riskScore ?? 0}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => verifySkill(skill.id)}
                    className="text-xs p-1 rounded opacity-60 hover:opacity-100"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Verify"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </button>
                  <button
                    onClick={() => removeSkill(skill.id)}
                    className="text-xs p-1 rounded opacity-60 hover:opacity-100"
                    style={{ color: 'var(--color-text-muted)' }}
                    title="Remove"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              {skill.description && (
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  {skill.description}
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Marketplace Button */}
      <button
        onClick={() => {
          setShowMarketplace(!showMarketplace);
          if (!showMarketplace) loadMarketplace();
        }}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium glow-hover"
        style={{
          background: 'var(--color-accent-subtle)',
          color: 'var(--color-accent-primary)',
          border: '1px solid rgba(212,149,107,0.15)',
        }}
      >
        {showMarketplace ? 'Hide' : 'Browse'} Marketplace
      </button>

      {/* Marketplace */}
      <AnimatePresence>
        {showMarketplace && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5 overflow-hidden"
          >
            {loading && (
              <p className="text-xs text-center py-2" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
            )}
            {marketplace.map((ms) => (
              <div key={ms.name} className="glass rounded-lg p-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {ms.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {ms.description}
                    </p>
                  </div>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{
                      background: `${riskColor(ms.risk_score)}20`,
                      color: riskColor(ms.risk_score),
                      fontSize: '10px',
                    }}
                  >
                    {ms.risk_score}
                  </span>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
