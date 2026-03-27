/**
 * BrowserManager — singleton that manages a persistent Chromium instance via Playwright.
 * Lazy-launches the browser on first use and provides page lifecycle management.
 */

interface BrowserInstance {
  browser: import('playwright').Browser;
  context: import('playwright').BrowserContext;
  page: import('playwright').Page;
}

class BrowserManagerImpl {
  private instance: BrowserInstance | null = null;
  private launching = false;
  private launchPromise: Promise<BrowserInstance> | null = null;

  /**
   * Check if Playwright is installed and available.
   */
  isAvailable(): boolean {
    try {
      require.resolve('playwright');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get or launch the browser and return the active page.
   */
  async getPage(): Promise<import('playwright').Page> {
    const inst = await this.ensureBrowser();
    // If page was closed, create a new one
    if (inst.page.isClosed()) {
      inst.page = await inst.context.newPage();
    }
    return inst.page;
  }

  /**
   * Get the browser context for advanced operations.
   */
  async getContext(): Promise<import('playwright').BrowserContext> {
    const inst = await this.ensureBrowser();
    return inst.context;
  }

  /**
   * Create a new page (tab) in the browser context.
   */
  async newPage(): Promise<import('playwright').Page> {
    const inst = await this.ensureBrowser();
    return inst.context.newPage();
  }

  /**
   * Close the browser instance.
   */
  async close(): Promise<void> {
    if (this.instance) {
      try {
        await this.instance.browser.close();
      } catch { /* already closed */ }
      this.instance = null;
      this.launchPromise = null;
    }
  }

  private async ensureBrowser(): Promise<BrowserInstance> {
    if (this.instance) return this.instance;

    // Prevent concurrent launches
    if (this.launchPromise) return this.launchPromise;

    this.launching = true;
    this.launchPromise = this.launch();

    try {
      this.instance = await this.launchPromise;
      return this.instance;
    } finally {
      this.launching = false;
    }
  }

  private async launch(): Promise<BrowserInstance> {
    const pw = await import('playwright');
    const browser = await pw.chromium.launch({
      headless: false, // Visible for computer-use scenarios
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Auto-cleanup on browser disconnect
    browser.on('disconnected', () => {
      this.instance = null;
      this.launchPromise = null;
    });

    return { browser, context, page };
  }
}

export const browserManager = new BrowserManagerImpl();
