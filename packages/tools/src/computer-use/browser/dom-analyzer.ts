/**
 * DOM Analyzer — page-injected script that builds a simplified interactive
 * element map for the LLM to understand page structure.
 */

import type { Page } from 'playwright';

export interface InteractiveElement {
  index: number;
  tag: string;
  role?: string;
  text: string;
  selector: string;
  type?: string;
  href?: string;
  placeholder?: string;
  ariaLabel?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface DomSnapshot {
  url: string;
  title: string;
  elements: InteractiveElement[];
  summary: string;
}

/**
 * Analyze a page and return a simplified map of interactive elements.
 */
export async function analyzeDom(page: Page): Promise<DomSnapshot> {
  const url = page.url();
  const title = await page.title();

  const elements = await page.evaluate(() => {
    const interactiveSelectors = [
      'a[href]',
      'button',
      'input',
      'textarea',
      'select',
      '[role="button"]',
      '[role="link"]',
      '[role="tab"]',
      '[role="menuitem"]',
      '[onclick]',
      '[tabindex]',
    ];

    const seen = new Set<Element>();
    const results: Array<{
      tag: string;
      role?: string;
      text: string;
      type?: string;
      href?: string;
      placeholder?: string;
      ariaLabel?: string;
      rect: { x: number; y: number; width: number; height: number };
      selector: string;
    }> = [];

    for (const sel of interactiveSelectors) {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        seen.add(el);

        const rect = el.getBoundingClientRect();
        // Skip off-screen or invisible elements
        if (rect.width === 0 || rect.height === 0) continue;
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

        const htmlEl = el as HTMLElement;
        const text = (htmlEl.innerText || htmlEl.textContent || '').trim().slice(0, 80);
        const tag = el.tagName.toLowerCase();

        // Build a reasonably unique CSS selector
        let selector = tag;
        if (el.id) {
          selector = `#${el.id}`;
        } else if (el.className && typeof el.className === 'string') {
          const cls = el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.');
          if (cls) selector = `${tag}.${cls}`;
        }

        results.push({
          tag,
          role: el.getAttribute('role') ?? undefined,
          text,
          type: el.getAttribute('type') ?? undefined,
          href: el.getAttribute('href') ?? undefined,
          placeholder: el.getAttribute('placeholder') ?? undefined,
          ariaLabel: el.getAttribute('aria-label') ?? undefined,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
          selector,
        });
      }
    }

    return results;
  });

  const mapped: InteractiveElement[] = elements.map((el, idx) => ({
    index: idx,
    tag: el.tag,
    role: el.role,
    text: el.text,
    selector: el.selector,
    type: el.type,
    href: el.href,
    placeholder: el.placeholder,
    ariaLabel: el.ariaLabel,
    boundingBox: el.rect,
  }));

  // Build a text summary for the LLM
  const lines = mapped.map((el) => {
    const parts = [`[${el.index}] <${el.tag}>`];
    if (el.role) parts.push(`role="${el.role}"`);
    if (el.text) parts.push(`"${el.text}"`);
    if (el.href) parts.push(`href="${el.href}"`);
    if (el.placeholder) parts.push(`placeholder="${el.placeholder}"`);
    if (el.type) parts.push(`type="${el.type}"`);
    return parts.join(' ');
  });

  return {
    url,
    title,
    elements: mapped,
    summary: `Page: ${title}\nURL: ${url}\n\nInteractive Elements (${mapped.length}):\n${lines.join('\n')}`,
  };
}
