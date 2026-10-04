import { app, ipcMain, Menu, nativeTheme } from 'electron';
import type { Settings } from '../shared/types';
import type { AddProviderRequest } from '../shared/types';
import { allProviders, isExtra } from './providers';
import { CHROME_UA } from './sessions';
import { getSettings, loadSettings, saveNow, updateSettings } from './settings';
import { attachShortcuts } from './shortcuts';
import { ViewManager } from './viewManager';

app.setName('LLMs');
app.userAgentFallback = CHROME_UA;
// Native Wayland on KDE when available (also passed by the launcher).
app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');

let manager: ViewManager | undefined;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!manager) return;
    if (manager.window.isMinimized()) manager.window.restore();
    manager.window.focus();
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'system';
    Menu.setApplicationMenu(null);
    loadSettings();
    registerIpc();

    manager = new ViewManager((wc) => attachShortcuts(wc, () => manager));
    const s = getSettings();
    const enabled = manager.enabledProviders();
    const start = enabled.find((p) => p.id === s.lastActive) ?? enabled[0];
    if (start) manager.activate(start.id);

    manager.window.on('closed', () => {
      manager = undefined;
      app.quit();
    });
  });

  app.on('before-quit', saveNow);
  app.on('window-all-closed', () => app.quit());
}

function registerIpc(): void {
  ipcMain.handle('get-state', () => manager?.getState());
  ipcMain.on('activate', (_e, id: string) => manager?.activate(id));
  ipcMain.on('reload', () => manager?.reload());
  ipcMain.on('go-home', () => manager?.goHome());
  ipcMain.on('set-overlay', (_e, open: boolean) => manager?.setOverlay(open));
  ipcMain.on('logout', (_e, id: string) => manager?.logout(id));
  ipcMain.on('unload', (_e, id: string) => manager?.unload(id));

  ipcMain.on('update-settings', (_e, patch: Partial<Settings>) => {
    const prev = getSettings();
    const allowed: Partial<Settings> = {};
    if (Array.isArray(patch.order)) allowed.order = patch.order.filter((id) => allProviders().some((p) => p.id === id));
    if (Array.isArray(patch.disabled)) allowed.disabled = patch.disabled;
    if (typeof patch.keepAliveMinutes === 'number') allowed.keepAliveMinutes = patch.keepAliveMinutes;
    if (typeof patch.nativeFrame === 'boolean') allowed.nativeFrame = patch.nativeFrame;
    updateSettings(allowed);
    manager?.applySettings(prev);
  });

  ipcMain.on('add-provider', (_e, req: AddProviderRequest) => {
    if (req?.kind === 'account' || req?.kind === 'site') manager?.addProvider(req);
  });
  ipcMain.on('remove-provider', (_e, id: string) => void manager?.removeProvider(id));

  ipcMain.on('tab-menu', (_e, id: string) => {
    const m = manager;
    if (!m) return;
    const status = m.getState().providers.find((p) => p.id === id)?.status;
    Menu.buildFromTemplate([
      { label: 'Reload', click: () => m.reload(id) },
      { label: 'Back to start page', click: () => m.goHome(id), enabled: status !== 'unloaded' },
      { label: 'Unload tab (free memory)', click: () => m.unload(id), enabled: status !== 'unloaded' },
      { label: 'Open in browser', click: () => m.openInBrowser(id) },
      { type: 'separator' },
      { label: 'Log out…', click: () => m.logout(id) },
      ...(isExtra(id) ? [{ label: 'Remove tab…', click: () => m.removeProvider(id) }] : []),
    ]).popup({ window: m.window });
  });

  ipcMain.on('window', (_e, action: 'minimize' | 'maximize' | 'close') => {
    const w = manager?.window;
    if (!w) return;
    if (action === 'minimize') w.minimize();
    else if (action === 'maximize') (w.isMaximized() ? w.unmaximize() : w.maximize());
    else w.close();
  });

  ipcMain.on('relaunch', () => {
    saveNow();
    app.relaunch();
    app.exit(0);
  });
}
