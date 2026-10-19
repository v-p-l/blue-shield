// Minimal Chrome DevTools Protocol client: no dependency, just node's global WebSocket.
// Used by tools/smoke.mjs; see the "Test de fumée" section of the README.

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9333; // not 9222: that one is often taken by a Chrome the user started
const BASE = `http://localhost:${PORT}`; // 127.0.0.1 makes the /json endpoints answer 404

const CHROMES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];

export const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function waitForBrowser(deadline = 20000) {
  const until = Date.now() + deadline;
  while (Date.now() < until) {
    try {
      return await (await fetch(`${BASE}/json/version`)).json();
    } catch {
      await sleep(300);
    }
  }
  throw new Error("Chrome n'a pas ouvert son port de debug");
}

// A throwaway Chrome: its own profile, so the user's channels and cookies stay untouched.
export async function launchChrome({ headless = false } = {}) {
  const { existsSync } = await import('node:fs');
  const bin = CHROMES.find((p) => existsSync(p));
  if (!bin) throw new Error('Chrome introuvable: renseigne son chemin dans tools/cdp.mjs');
  const profile = mkdtempSync(join(tmpdir(), 'blueshield-smoke-'));
  const child = spawn(bin, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--enable-unsafe-extension-debugging', // required by Extensions.loadUnpacked
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,900',
    ...(headless ? ['--headless=new'] : []),
    'about:blank',
  ], { detached: false, stdio: 'ignore' });
  const version = await waitForBrowser();
  return {
    version,
    close() {
      child.kill();
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {
        // Chrome may still hold a file lock; the OS cleans its temp dir anyway.
      }
    },
  };
}

export async function listTargets() {
  return (await fetch(`${BASE}/json/list`)).json();
}

export async function newTab(url) {
  const res = await fetch(`${BASE}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!res.ok) throw new Error(`nouvel onglet: HTTP ${res.status}`);
  return res.json();
}

export async function closeTab(id) {
  await fetch(`${BASE}/json/close/${id}`);
}

export class Session {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const waiter = msg.id && this.pending.get(msg.id);
      if (!waiter) return;
      this.pending.delete(msg.id);
      msg.error ? waiter.reject(new Error(JSON.stringify(msg.error))) : waiter.resolve(msg.result);
    });
  }

  static async open(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    return new Session(ws);
  }

  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`délai dépassé: ${method}`));
      }, 60000);
    });
  }

  // Evaluates in the page's own JS world, so it sees YouTube's objects.
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || 'évaluation en échec');
    return res.result.value;
  }

  viewport(width, height, scale = 1) {
    return this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  }

  close() {
    this.ws.close();
  }
}

// Opens a tab, runs `fn`, then always closes the tab.
export async function withTab(url, fn) {
  const tab = await newTab(url);
  const session = await Session.open(tab.webSocketDebuggerUrl);
  try {
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    return await fn(session, tab);
  } finally {
    session.close();
    await closeTab(tab.id);
  }
}

// Loads the unpacked extension: Chrome ignores --load-extension since v137.
export async function loadExtension(browserWsUrl, path) {
  const session = await Session.open(browserWsUrl);
  try {
    const { id } = await session.send('Extensions.loadUnpacked', { path });
    return id;
  } finally {
    session.close();
  }
}
