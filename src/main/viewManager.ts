import { BaseWindow, WebContentsView, dialog, nativeTheme, net, session, type WebContents } from 'electron';
import path from 'node:path';
import type { AddProviderRequest, AppState, CustomProvider, Settings, TabStatus, Toast } from '../shared/types';
import { attachNavigation, openExternal } from './navigation';
import { allProviders, findProvider, iconFor, isExtra, PROVIDERS, type Provider } from './providers';
import { getProviderSession } from './sessions';
import { getSettings, updateSettings } from './settings';

export const TOPBAR_HEIGHT = 46;
const SWEEP_INTERVAL_MS = 30_000;

interface Tab {
  view: WebContentsView;
  status: TabStatus;
  /** When this tab was last hidden; undefined while it is the active tab. */
  hiddenAt?: number;
}

export class ViewManager {
  readonly window: BaseWindow;
  readonly topbar: WebContentsView;
  private tabs = new Map<string, Tab>();
  private active: string | null = null;
  private overlayOpen = false;
  private htmlFullscreen = false;
  private sweepTimer: NodeJS.Timeout;

  constructor(private onInput: (wc: WebContents) => void) {
    const s = getSettings();
    this.window = new BaseWindow({
      width: s.bounds?.width ?? 1280,
      height: s.bounds?.height ?? 860,
      x: s.bounds?.x,
      y: s.bounds?.y,
      minWidth: 640,
      minHeight: 420,
      title: 'LLMs',
      frame: s.nativeFrame,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e0e11' : '#f6f6f8',
      icon: path.join(__dirname, '../../resources/app-icon.png'),
      show: false,
    });
    if (s.maximized) this.window.maximize();

    this.topbar = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, '../preload/topbar.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    // Transparent so the settings overlay can dim the page underneath it.
    this.topbar.setBackgroundColor('#00000000');
    this.topbar.webContents.loadFile(path.join(__dirname, '../renderer/index.html'));
    this.topbar.webContents.once('did-finish-load', () => this.window.show());
    this.onInput(this.topbar.webContents);
    this.window.contentView.addChildView(this.topbar);

    this.window.on('resize', () => this.layout());
    this.window.on('maximize', () => this.pushState());
    this.window.on('unmaximize', () => this.pushState());
    this.window.on('close', () => this.saveBounds());

    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.window.on('closed', () => clearInterval(this.sweepTimer));

    this.layout();
  }

  // ---------- providers & order ----------

  enabledProviders(): Provider[] {
    const s = getSettings();
    return s.order
      .map((id) => findProvider(id)!)
      .filter((p) => p && !s.disabled.includes(p.id));
  }

  getState(): AppState {
    const s = getSettings();
    return {
      providers: s.order.map((id) => {
        const p = findProvider(id)!;
        return {
          id: p.id,
          name: p.name,
          color: p.color,
          icon: iconFor(p),
          removable: isExtra(p.id),
          enabled: !s.disabled.includes(p.id),
          status: this.tabs.get(p.id)?.status ?? 'unloaded',
        };
      }),
      active: this.active,
      settings: s,
      maximized: this.window.isMaximized(),
    };
  }

  pushState(): void {
    if (!this.topbar.webContents.isDestroyed()) this.topbar.webContents.send('state', this.getState());
  }

  toast(t: Toast): void {
    this.topbar.webContents.send('toast', t);
  }

  // ---------- tabs ----------

  /** Show a provider, loading it on first use. */
  activate(id: string): void {
    const provider = findProvider(id);
    if (!provider || getSettings().disabled.includes(id)) return;

    if (this.active && this.active !== id) {
      const prev = this.tabs.get(this.active);
      if (prev) {
        prev.view.setVisible(false);
        prev.hiddenAt = Date.now();
      }
    }

    let tab = this.tabs.get(id);
    if (!tab) tab = this.createTab(provider);
    tab.hiddenAt = undefined;
    tab.view.setVisible(true);
    this.active = id;
    updateSettings({ lastActive: id });
    this.layout();
    if (!this.overlayOpen) tab.view.webContents.focus();
    this.pushState();
  }

  cycle(step: number): void {
    const list = this.enabledProviders();
    if (!list.length) return;
    const i = list.findIndex((p) => p.id === this.active);
    this.activate(list[(i + step + list.length) % list.length].id);
  }

  activateIndex(index: number): void {
    const p = this.enabledProviders()[index];
    if (p) this.activate(p.id);
  }

  private createTab(provider: Provider): Tab {
    const ses = getProviderSession(provider.partition, (text, kind) => this.toast({ text, kind }));
    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: true,
      },
    });
    view.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#0e0e11' : '#ffffff');
    const tab: Tab = { view, status: 'loading' };
    this.tabs.set(provider.id, tab);

    const wc = view.webContents;
    const setStatus = (status: TabStatus) => {
      if (tab.status === status) return;
      tab.status = status;
      this.pushState();
    };
    wc.on('did-start-loading', () => setStatus('loading'));
    wc.on('did-stop-loading', () => {
      if (tab.status !== 'error') setStatus('ready');
    });
    wc.on('did-start-navigation', (d) => {
      if (d.isMainFrame && !d.isSameDocument) setStatus('loading');
    });
    wc.on('did-fail-load', (_e, code, _desc, _url, isMainFrame) => {
      // -3 is ERR_ABORTED: a navigation replaced by another one, not a failure.
      if (isMainFrame && code !== -3) setStatus('error');
    });
    wc.on('render-process-gone', () => setStatus('error'));
    wc.on('did-navigate', () => {
      const zoom = getSettings().zoom[provider.id];
      if (zoom) wc.setZoomFactor(zoom);
    });
    if (provider.custom && !provider.base && !provider.icon) {
      wc.once('page-favicon-updated', (_e, favicons) => void this.saveFavicon(provider.id, favicons));
    }
    wc.on('enter-html-full-screen', () => this.setHtmlFullscreen(true));
    wc.on('leave-html-full-screen', () => this.setHtmlFullscreen(false));

    attachNavigation(wc, provider);
    this.onInput(wc);

    // Insert below the top bar so the settings overlay always draws on top.
    this.window.contentView.addChildView(view, this.window.contentView.children.indexOf(this.topbar));
    wc.loadURL(provider.url);
    return tab;
  }

  /** Close a tab's page to free memory. Its cookies stay, so it comes back logged in. */
  unload(id: string): void {
    const tab = this.tabs.get(id);
    if (!tab) return;
    this.tabs.delete(id);
    this.window.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    if (this.active === id) this.active = null;
    this.pushState();
  }

  reload(id = this.active, hard = false): void {
    if (!id) return;
    const tab = this.tabs.get(id);
    if (!tab) return this.activate(id);
    if (tab.status === 'error' || tab.view.webContents.isCrashed()) {
      const provider = findProvider(id)!;
      tab.view.webContents.loadURL(provider.url);
    } else if (hard) tab.view.webContents.reloadIgnoringCache();
    else tab.view.webContents.reload();
  }

  goHome(id = this.active): void {
    const provider = findProvider(id);
    const tab = id ? this.tabs.get(id) : undefined;
    if (provider && tab) tab.view.webContents.loadURL(provider.url);
  }

  navigate(dir: -1 | 1): void {
    const tab = this.active ? this.tabs.get(this.active) : undefined;
    if (!tab) return;
    const h = tab.view.webContents.navigationHistory;
    if (dir < 0 && h.canGoBack()) h.goBack();
    if (dir > 0 && h.canGoForward()) h.goForward();
  }

  zoom(delta: number | 'reset'): void {
    const id = this.active;
    const tab = id ? this.tabs.get(id) : undefined;
    if (!id || !tab) return;
    const wc = tab.view.webContents;
    const next = delta === 'reset' ? 1 : Math.min(3, Math.max(0.5, Math.round((wc.getZoomFactor() + delta) * 10) / 10));
    wc.setZoomFactor(next);
    const zoom = { ...getSettings().zoom };
    if (next === 1) delete zoom[id];
    else zoom[id] = next;
    updateSettings({ zoom });
    this.toast({ text: `Zoom ${Math.round(next * 100)}%` });
  }

  toggleDevTools(): void {
    const tab = this.active ? this.tabs.get(this.active) : undefined;
    tab?.view.webContents.toggleDevTools();
  }

  openInBrowser(id = this.active): void {
    const tab = id ? this.tabs.get(id) : undefined;
    const provider = findProvider(id);
    if (provider) openExternal(tab?.view.webContents.getURL() || provider.url);
  }

  async logout(id: string): Promise<void> {
    const provider = findProvider(id);
    if (!provider) return;
    const sharers = allProviders().filter((p) => p.partition === provider.partition);
    const names = sharers.map((p) => p.name).join(' and ');
    const { response } = await dialog.showMessageBox(this.window, {
      type: 'warning',
      buttons: ['Cancel', 'Log out'],
      defaultId: 0,
      cancelId: 0,
      title: 'Log out',
      message: `Log out of ${names}?`,
      detail: 'This clears cookies and site data for this login. You will need to sign in again.',
    });
    if (response !== 1) return;
    await session.fromPartition(provider.partition).clearStorageData();
    for (const p of sharers) if (this.tabs.has(p.id)) this.reload(p.id);
    this.toast({ text: `Logged out of ${names}` });
  }

  // ---------- adding & removing providers ("+") ----------

  /** Create an extra account of a built-in provider, or a tab for any site. Returns the new id. */
  addProvider(req: AddProviderRequest): string | null {
    const s = getSettings();
    const name = req.name.trim().slice(0, 40);
    let entry: CustomProvider;

    if (req.kind === 'account') {
      const found = findProvider(req.base);
      if (!found) return null;
      const root = findProvider(found.base ?? found.id)!;
      const id = this.freeId(root.id);
      entry = {
        id,
        name: name || `${root.name} ${id.split('-').pop()}`,
        url: root.url,
        // Its own cookie jar, even when the original shares one (Google).
        partition: `persist:${id}`,
        hosts: root.hosts,
        color: root.color,
        base: root.id,
      };
    } else {
      let url: URL;
      try {
        url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(req.url.trim()) ? req.url.trim() : `https://${req.url.trim()}`);
      } catch {
        this.toast({ text: "That doesn't look like a web address", kind: 'error' });
        return null;
      }
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        this.toast({ text: 'Only http and https sites can be added', kind: 'error' });
        return null;
      }
      const host = url.hostname.replace(/^www\./, '');
      const id = this.freeId('site');
      entry = {
        id,
        name: name || host,
        url: url.toString(),
        partition: `persist:${id}`,
        hosts: [host],
        color: '#8b7cff',
      };
    }

    updateSettings({ custom: [...s.custom, entry], order: [...s.order, entry.id] });
    this.activate(entry.id);
    return entry.id;
  }

  async removeProvider(id: string): Promise<void> {
    const entry = getSettings().custom.find((c) => c.id === id);
    if (!entry) return;
    const { response } = await dialog.showMessageBox(this.window, {
      type: 'warning',
      buttons: ['Cancel', 'Remove'],
      defaultId: 0,
      cancelId: 0,
      title: 'Remove tab',
      message: `Remove ${entry.name}?`,
      detail: 'Its login and site data are deleted from this computer.',
    });
    if (response !== 1) return;

    const s = getSettings();
    this.unload(id);
    await session.fromPartition(entry.partition).clearStorageData();
    const zoom = { ...s.zoom };
    delete zoom[id];
    updateSettings({
      custom: s.custom.filter((c) => c.id !== id),
      order: s.order.filter((x) => x !== id),
      disabled: s.disabled.filter((x) => x !== id),
      zoom,
      lastActive: s.lastActive === id ? null : s.lastActive,
    });
    this.applySettings(s);
    this.toast({ text: `Removed ${entry.name}` });
  }

  /** Smallest unused "<root>-N" id (chatgpt-2, chatgpt-3, ...). */
  private freeId(root: string): string {
    const taken = new Set(allProviders().map((p) => p.id));
    for (let n = 2; ; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
  }

  private async saveFavicon(id: string, favicons: string[]): Promise<void> {
    for (const href of favicons.slice(0, 3)) {
      try {
        const res = await net.fetch(href, { signal: AbortSignal.timeout(5000) });
        const type = res.headers.get('content-type')?.split(';')[0] ?? '';
        if (!res.ok || !type.startsWith('image/')) continue;
        const bytes = Buffer.from(await res.arrayBuffer());
        if (bytes.length === 0 || bytes.length > 200_000) continue;
        const icon = `data:${type};base64,${bytes.toString('base64')}`;
        const s = getSettings();
        if (!s.custom.some((c) => c.id === id)) return; // removed while fetching
        updateSettings({ custom: s.custom.map((c) => (c.id === id ? { ...c, icon } : c)) });
        this.pushState();
        return;
      } catch {
        // Try the next candidate.
      }
    }
  }

  /** Called after settings change: unload tabs that were disabled, fix the active tab. */
  applySettings(prev: Settings): void {
    const s = getSettings();
    for (const id of s.disabled) if (this.tabs.has(id)) this.unload(id);
    if (!this.active || s.disabled.includes(this.active)) {
      const first = this.enabledProviders()[0];
      if (first) this.activate(first.id);
    }
    if (prev.keepAliveMinutes !== s.keepAliveMinutes) this.sweep();
    this.pushState();
  }

  /** Unload background tabs that have been hidden longer than the keep-alive window. */
  private sweep(): void {
    const minutes = getSettings().keepAliveMinutes;
    if (minutes <= 0) return;
    const cutoff = Date.now() - minutes * 60_000;
    for (const [id, tab] of this.tabs) {
      if (id !== this.active && tab.hiddenAt !== undefined && tab.hiddenAt < cutoff) this.unload(id);
    }
  }

  // ---------- layout ----------

  setOverlay(open: boolean): void {
    this.overlayOpen = open;
    this.layout();
    if (open) this.topbar.webContents.focus();
    else if (this.active) this.tabs.get(this.active)?.view.webContents.focus();
  }

  private setHtmlFullscreen(on: boolean): void {
    this.htmlFullscreen = on;
    this.window.setFullScreen(on);
    this.topbar.setVisible(!on);
    this.layout();
  }

  layout(): void {
    const { width, height } = this.window.getContentBounds();
    const top = this.htmlFullscreen ? 0 : TOPBAR_HEIGHT;
    this.topbar.setBounds({ x: 0, y: 0, width, height: this.overlayOpen ? height : TOPBAR_HEIGHT });
    for (const [id, tab] of this.tabs) {
      if (id === this.active) tab.view.setBounds({ x: 0, y: top, width, height: Math.max(0, height - top) });
    }
  }

  private saveBounds(): void {
    const maximized = this.window.isMaximized();
    updateSettings(maximized ? { maximized } : { maximized, bounds: this.window.getNormalBounds() });
  }
}
