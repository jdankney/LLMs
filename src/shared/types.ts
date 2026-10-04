// Types shared between the main process and the top bar UI.

export type TabStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface ProviderInfo {
  id: string;
  name: string;
  color: string;
  /** Image URL for the tab icon; empty means "use a letter badge". */
  icon: string;
  enabled: boolean;
  /** Shown in a pane while split view is on. */
  inSplit: boolean;
  /** True for extra accounts and custom sites (can be removed). */
  removable: boolean;
  status: TabStatus;
}

/** A provider the user added with "+": another account of a built-in, or any site. */
export interface CustomProvider {
  id: string;
  name: string;
  url: string;
  partition: string;
  hosts: string[];
  color: string;
  /** Built-in provider this is another account of (its icon is reused). */
  base?: string;
  /** Favicon as a data: URL, fetched the first time a custom site loads. */
  icon?: string;
}

export type AddProviderRequest =
  | { kind: 'account'; base: string; name: string }
  | { kind: 'site'; url: string; name: string };

export interface Settings {
  /** Provider ids in display order (includes disabled ones). */
  order: string[];
  disabled: string[];
  custom: CustomProvider[];
  /** Providers shown side by side. Fewer than two means split view is off. */
  split: string[];
  /** Per-provider zoom factor (1 = 100%). */
  zoom: Record<string, number>;
  lastActive: string | null;
  /** Minutes a background tab stays loaded after you leave it. 0 = forever. */
  keepAliveMinutes: number;
  /** Use KDE's own title bar instead of the custom one. Needs a restart. */
  nativeFrame: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  maximized?: boolean;
}

export interface AppState {
  providers: ProviderInfo[];
  active: string | null;
  /** Split view is on (2-4 panes). */
  split: boolean;
  settings: Settings;
  maximized: boolean;
}

export interface Toast {
  text: string;
  kind?: 'info' | 'error';
}
