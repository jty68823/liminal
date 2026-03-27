import type { ToolHandler } from './registry.js';

// ---------------------------------------------------------------------------
// Types for SearXNG and DuckDuckGo responses
// ---------------------------------------------------------------------------

interface SearxResult {
  title?: string;
  url?: string;
  content?: string;
}

interface SearxResponse {
  results?: SearxResult[];
}

interface DuckDuckGoRelatedTopic {
  Text?: string;
  FirstURL?: string;
}

interface DuckDuckGoResponse {
  Abstract?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  RelatedTopics?: DuckDuckGoRelatedTopic[];
  Answer?: string;
}

// ---------------------------------------------------------------------------
// Helper: fetch with a basic timeout
// ---------------------------------------------------------------------------

async function fetchWithTimeout(
  url: string,
  timeoutMs = 15000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// SearXNG search
// ---------------------------------------------------------------------------

async function searxSearch(
  query: string,
  numResults: number,
  baseUrl: string,
): Promise<string> {
  const url =
    `${baseUrl}/search` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json` +
    `&engines=google,bing` +
    `&pageno=1`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`SearXNG returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as SearxResponse;
  const results = (data.results ?? []).slice(0, numResults);

  if (results.length === 0) {
    return 'No results found.';
  }

  const lines: string[] = [`Search results for: ${query}`, ''];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title ?? '(no title)'}`);
    lines.push(`   URL: ${r.url ?? '(no url)'}`);
    if (r.content) {
      const snippet = r.content.replace(/\s+/g, ' ').trim().slice(0, 200);
      lines.push(`   ${snippet}`);
    }
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

// ---------------------------------------------------------------------------
// DuckDuckGo instant answers fallback
// ---------------------------------------------------------------------------

async function duckDuckGoSearch(
  query: string,
  numResults: number,
): Promise<string> {
  const url =
    `https://api.duckduckgo.com/` +
    `?q=${encodeURIComponent(query)}` +
    `&format=json` +
    `&t=liminal` +
    `&no_redirect=1` +
    `&no_html=1` +
    `&skip_disambig=1`;

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`DuckDuckGo API returned HTTP ${response.status}`);
  }

  const data = (await response.json()) as DuckDuckGoResponse;
  const lines: string[] = [`Search results for: ${query}`, ''];

  // Abstract / direct answer
  if (data.Abstract) {
    lines.push(`Summary: ${data.Abstract}`);
    if (data.AbstractURL) lines.push(`Source: ${data.AbstractURL} (${data.AbstractSource ?? ''})`);
    lines.push('');
  } else if (data.Answer) {
    lines.push(`Answer: ${data.Answer}`);
    lines.push('');
  }

  // Related topics
  const topics = (data.RelatedTopics ?? [])
    .filter((t) => t.Text && t.FirstURL)
    .slice(0, numResults);

  if (topics.length > 0) {
    lines.push('Related:');
    topics.forEach((t, i) => {
      const snippet = (t.Text ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
      lines.push(`${i + 1}. ${snippet}`);
      lines.push(`   URL: ${t.FirstURL}`);
      lines.push('');
    });
  }

  if (lines.length <= 2) {
    // Only header, no useful content
    return (
      `No instant-answer results found for: ${query}\n` +
      `(DuckDuckGo instant answers API may not have data for this query. ` +
      `Try a different search or set SEARXNG_URL for full web search.)`
    );
  }

  return lines.join('\n').trimEnd();
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const webSearchTool: ToolHandler = {
  definition: {
    name: 'web_search',
    description:
      'Search the web for information. Uses SearXNG if SEARXNG_URL env var is set, otherwise falls back to DuckDuckGo instant answers.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        num_results: {
          type: 'number',
          description: 'Number of results to return (default: 5)',
        },
      },
      required: ['query'],
    },
  },

  async execute(input: Record<string, unknown>): Promise<string> {
    const query = input['query'] as string;
    const numResults = Math.min(
      Math.max(1, (input['num_results'] as number | undefined) ?? 5),
      20,
    );

    if (!query || typeof query !== 'string') {
      return 'Error: "query" must be a non-empty string.';
    }

    const searxngUrl = process.env['SEARXNG_URL'];

    if (searxngUrl) {
      try {
        return await searxSearch(query, numResults, searxngUrl.replace(/\/$/, ''));
      } catch (err: unknown) {
        const error = err as Error;
        // Fall through to DuckDuckGo on SearXNG failure
        const fallbackResult = await duckDuckGoSearch(query, numResults).catch(
          (ddgErr: unknown) => {
            const ddg = ddgErr as Error;
            return `Error searching with SearXNG: ${error.message}\nError falling back to DuckDuckGo: ${ddg.message}`;
          },
        );
        return `(SearXNG unavailable: ${error.message})\n\n` + fallbackResult;
      }
    }

    // No SearXNG — use DuckDuckGo directly
    try {
      return await duckDuckGoSearch(query, numResults);
    } catch (err: unknown) {
      const error = err as Error;
      return `Error performing web search: ${error.message ?? String(err)}`;
    }
  },
};

export const fetchPageTool: ToolHandler = {
  definition: {
    name: 'fetch_page',
    description: 'Fetch and extract the readable text content from a web page URL. Use this after web_search to get full article content.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The full URL to fetch' },
      },
      required: ['url'],
    },
  },
  async execute(input) {
    const url = input['url'] as string;
    if (!url || typeof url !== 'string') return 'Error: url parameter is required';
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Liminal/1.0)' },
      });
      if (!resp.ok) return `Error: HTTP ${resp.status} for ${url}`;
      const html = await resp.text();
      const { parse } = await import('node-html-parser');
      const root = parse(html);
      root.querySelectorAll('script,style,nav,footer,header,aside,[role="navigation"],[role="banner"]').forEach(el => el.remove());
      const text = root.innerText.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      return text.slice(0, 4000) + (text.length > 4000 ? '\n\n[...truncated]' : '');
    } catch (err) {
      return `Error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
};
