import { contextBridge, ipcRenderer } from 'electron';
import type { AddProviderRequest, AppState, Settings, Toast } from '../shared/types';

// The only bridge between the UI and the main process. Provider pages get no preload at all.
const api = {
  getState: (): Promise<AppState> => ipcRenderer.invoke('get-state'),
  onState: (cb: (s: AppState) => void) => ipcRenderer.on('state', (_e, s) => cb(s)),
  onToast: (cb: (t: Toast) => void) => ipcRenderer.on('toast', (_e, t) => cb(t)),
  onOpenAdd: (cb: () => void) => ipcRenderer.on('open-add', () => cb()),
  onOpenSettings: (cb: () => void) => ipcRenderer.on('open-settings', () => cb()),
  activate: (id: string) => ipcRenderer.send('activate', id),
  toggleSplit: () => ipcRenderer.send('toggle-split'),
  toggleInSplit: (id: string) => ipcRenderer.send('toggle-in-split', id),
  reload: () => ipcRenderer.send('reload'),
  goHome: () => ipcRenderer.send('go-home'),
  setOverlay: (open: boolean) => ipcRenderer.send('set-overlay', open),
  updateSettings: (patch: Partial<Settings>) => ipcRenderer.send('update-settings', patch),
  addProvider: (req: AddProviderRequest) => ipcRenderer.send('add-provider', req),
  removeProvider: (id: string) => ipcRenderer.send('remove-provider', id),
  logout: (id: string) => ipcRenderer.send('logout', id),
  tabMenu: (id: string) => ipcRenderer.send('tab-menu', id),
  windowAction: (a: 'minimize' | 'maximize' | 'close') => ipcRenderer.send('window', a),
  relaunch: () => ipcRenderer.send('relaunch'),
};

export type LLMsApi = typeof api;
contextBridge.exposeInMainWorld('llms', api);
