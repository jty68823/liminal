/**
 * Working memory manager — maintains a structured scratchpad of
 * key facts, decisions, and active goals across a conversation.
 *
 * Unlike long-term memory (vector DB), working memory is session-scoped
 * and formatted for direct injection into the system prompt.
 */

export interface WorkingMemoryEntry {
  key: string;
  value: string;
  category: 'fact' | 'decision' | 'goal' | 'preference' | 'context';
  timestamp: number;
  priority: number; // 0-1, higher = more important
}

export class WorkingMemory {
  private entries: Map<string, WorkingMemoryEntry> = new Map();
  private maxEntries: number;

  constructor(maxEntries = 30) {
    this.maxEntries = maxEntries;
  }

  /**
   * Add or update a working memory entry.
   */
  set(key: string, value: string, category: WorkingMemoryEntry['category'] = 'fact', priority = 0.5): void {
    this.entries.set(key, {
      key,
      value,
      category,
      timestamp: Date.now(),
      priority,
    });

    // Evict lowest-priority entries if over limit
    if (this.entries.size > this.maxEntries) {
      this.evict();
    }
  }

  /**
   * Remove a working memory entry.
   */
  delete(key: string): boolean {
    return this.entries.delete(key);
  }

  /**
   * Get a specific entry.
   */
  get(key: string): WorkingMemoryEntry | undefined {
    return this.entries.get(key);
  }

  /**
   * Get all entries, optionally filtered by category.
   */
  getAll(category?: WorkingMemoryEntry['category']): WorkingMemoryEntry[] {
    const all = Array.from(this.entries.values());
    if (!category) return all;
    return all.filter((e) => e.category === category);
  }

  /**
   * Format working memory for injection into system prompt.
   * Groups by category with clear labels.
   */
  toPromptBlock(): string {
    if (this.entries.size === 0) return '';

    const grouped: Record<string, WorkingMemoryEntry[]> = {};
    for (const entry of this.entries.values()) {
      const cat = entry.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(entry);
    }

    const sections: string[] = [];
    const categoryLabels: Record<string, string> = {
      goal: 'Active Goals',
      decision: 'Key Decisions',
      fact: 'Known Facts',
      preference: 'User Preferences',
      context: 'Current Context',
    };

    for (const [cat, label] of Object.entries(categoryLabels)) {
      const entries = grouped[cat];
      if (!entries || entries.length === 0) continue;

      // Sort by priority (highest first)
      entries.sort((a, b) => b.priority - a.priority);

      const items = entries.map((e) => `- ${e.value}`).join('\n');
      sections.push(`### ${label}\n${items}`);
    }

    return `<working_memory>\n${sections.join('\n\n')}\n</working_memory>`;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get count of entries.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Extract potential working memory items from assistant text.
   * Looks for patterns like decisions, goals, preferences mentioned in response.
   */
  static extractFromText(text: string): Array<{ key: string; value: string; category: WorkingMemoryEntry['category'] }> {
    const items: Array<{ key: string; value: string; category: WorkingMemoryEntry['category'] }> = [];

    // Extract user preference patterns
    const prefPatterns = [
      /(?:user (?:prefers?|wants?|likes?)|preference:)\s*(.+?)(?:\.|$)/gi,
      /(?:always|never)\s+(.+?)(?:\.|$)/gi,
    ];
    for (const pattern of prefPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 5 && match[1].length < 200) {
          items.push({
            key: `pref_${items.length}`,
            value: match[1].trim(),
            category: 'preference',
          });
        }
      }
    }

    // Extract decision patterns
    const decisionPatterns = [
      /(?:decided|decision|chose|chosen|will use|using)\s+(.+?)(?:\.|$)/gi,
    ];
    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 5 && match[1].length < 200) {
          items.push({
            key: `decision_${items.length}`,
            value: match[1].trim(),
            category: 'decision',
          });
        }
      }
    }

    return items;
  }

  /**
   * Evict lowest-priority entries to stay within limit.
   */
  private evict(): void {
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => {
        // Sort by priority ascending, then by timestamp ascending (oldest first)
        if (a[1].priority !== b[1].priority) return a[1].priority - b[1].priority;
        return a[1].timestamp - b[1].timestamp;
      });

    while (this.entries.size > this.maxEntries && sorted.length > 0) {
      const entry = sorted.shift();
      if (entry) {
        this.entries.delete(entry[0]);
      }
    }
  }
}
