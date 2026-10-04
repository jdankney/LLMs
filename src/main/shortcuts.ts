import type { Input, WebContents } from 'electron';
import type { ViewManager } from './viewManager';

/**
 * App shortcuts. Handled per WebContents (top bar + every provider page) via
 * before-input-event, so they work no matter which page has keyboard focus.
 */
export function attachShortcuts(wc: WebContents, getManager: () => ViewManager | undefined): void {
  wc.on('before-input-event', (event, input) => {
    const m = getManager();
    if (!m || input.type !== 'keyDown') return;
    if (handle(m, input)) event.preventDefault();
  });
}

function handle(m: ViewManager, input: Input): boolean {
  const { control: ctrl, shift, alt, meta } = input;
  const key = input.key;
  if (meta) return false;

  if (ctrl && !alt && /^[1-9]$/.test(key) && !shift) {
    m.activateIndex(Number(key) - 1);
    return true;
  }
  if (ctrl && key === 'Tab') {
    m.cycle(shift ? -1 : 1);
    return true;
  }
  if (ctrl && !alt && (key === 'PageDown' || key === 'PageUp')) {
    m.cycle(key === 'PageDown' ? 1 : -1);
    return true;
  }
  if ((ctrl && key.toLowerCase() === 'r') || key === 'F5') {
    m.reload(undefined, shift || (ctrl && key === 'F5'));
    return true;
  }
  if (ctrl && !alt && (key === '=' || key === '+')) {
    m.zoom(0.1);
    return true;
  }
  if (ctrl && !alt && (key === '-' || key === '_')) {
    m.zoom(-0.1);
    return true;
  }
  if (ctrl && !alt && key === '0') {
    m.zoom('reset');
    return true;
  }
  if (ctrl && !shift && key.toLowerCase() === 't') {
    m.topbar.webContents.send('open-add');
    return true;
  }
  if (ctrl && key === ',') {
    m.topbar.webContents.send('open-settings');
    return true;
  }
  if (alt && !ctrl && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    m.navigate(key === 'ArrowLeft' ? -1 : 1);
    return true;
  }
  if (alt && !ctrl && key === 'Home') {
    m.goHome();
    return true;
  }
  if (ctrl && shift && key.toLowerCase() === 'i') {
    m.toggleDevTools();
    return true;
  }
  if (key === 'F11') {
    m.window.setFullScreen(!m.window.isFullScreen());
    return true;
  }
  return false;
}
