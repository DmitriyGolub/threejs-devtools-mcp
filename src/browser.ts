/**
 * Auto-launch browser via puppeteer-core using the system Chrome/Edge/Chromium.
 * Falls back to opening the URL in the default browser if no Chrome is found.
 */
import { exec } from 'node:child_process';
import fs from 'node:fs';

/** Well-known Chrome/Edge/Chromium paths per platform. */
function findChromePath(): string | null {
  const candidates: string[] = process.platform === 'win32' ? [
    `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
  ];

  if (process.env.CHROME_PATH) candidates.unshift(process.env.CHROME_PATH);

  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
  }
  return null;
}

/** Open URL in the system default browser (no puppeteer). */
function openInDefaultBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

export interface LaunchResult {
  method: 'puppeteer' | 'system-browser' | 'none';
  close?: () => Promise<void>;
}

/**
 * Launch a browser pointing to the proxy URL.
 *
 * Priority:
 * 1. BROWSER=none → skip
 * 2. puppeteer-core available + Chrome found → launch with puppeteer (programmatic control)
 * 3. Fallback → open in default system browser
 *
 * Set HEADLESS=true for headless mode (puppeteer only).
 * Set CHROME_PATH to use a specific browser executable.
 */
export async function launchBrowser(
  url: string,
  options: { headless?: boolean } = {},
): Promise<LaunchResult> {
  if (process.env.BROWSER === 'none') {
    console.error(`[threejs-devtools] Browser launch disabled (BROWSER=none)`);
    console.error(`[threejs-devtools] Open ${url} manually in your browser`);
    return { method: 'none' };
  }

  const chromePath = findChromePath();

  if (chromePath) {
    try {
      const pptr = await import('puppeteer-core');
      const browser = await pptr.default.launch({
        executablePath: chromePath,
        headless: options.headless ?? false,
        args: [
          '--no-first-run',
          '--no-default-browser-check',
          '--window-size=1280,800',
        ],
        defaultViewport: null,
      });

      const pages = await browser.pages();
      const page = pages[0] || await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      console.error(`[threejs-devtools] Browser launched via puppeteer (${options.headless ? 'headless' : 'headed'})`);
      return {
        method: 'puppeteer',
        close: async () => { try { await browser.close(); } catch { /* ignore */ } },
      };
    } catch (err) {
      console.error(`[threejs-devtools] Puppeteer failed: ${(err as Error).message}, opening system browser`);
    }
  }

  // Fallback: system browser
  openInDefaultBrowser(url);
  console.error(`[threejs-devtools] Opened ${url} in system browser`);
  return { method: 'system-browser' };
}

/** Close browser if we launched it via puppeteer. */
export async function closeBrowser(result: LaunchResult): Promise<void> {
  if (result.close) await result.close();
}
