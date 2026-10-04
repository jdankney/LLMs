import { clipboard, Menu, shell, type MenuItemConstructorOptions, type WebContents } from 'electron';
import { AUTH_HOSTS, hostMatches, type Provider } from './providers';

/**
 * Keeps a provider tab on its own site. Login flows (and their popups) are allowed
 * to bounce through the sign-in domains; any other link opens in the system browser.
 */
export function attachNavigation(wc: WebContents, provider: Provider): void {
  const allowed = [...provider.hosts, ...AUTH_HOSTS];

  wc.setWindowOpenHandler(({ url }) => {
    if (hostMatches(url, AUTH_HOSTS)) {
      // "Sign in with Google" popups: a real child window that shares this tab's
      // cookie jar (window.open children inherit the opener's session) and keeps
      // window.opener working so the popup can hand the result back.
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
        },
      };
    }
    if (hostMatches(url, provider.hosts)) {
      wc.loadURL(url);
      return { action: 'deny' };
    }
    openExternal(url);
    return { action: 'deny' };
  });

  // Only user-initiated navigations are checked; server redirects during login are left alone.
  wc.on('will-navigate', (event, url) => {
    if (!hostMatches(url, allowed)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  wc.on('context-menu', (_event, params) => {
    const items: MenuItemConstructorOptions[] = [];

    if (params.misspelledWord) {
      for (const s of params.dictionarySuggestions.slice(0, 5)) {
        items.push({ label: s, click: () => wc.replaceMisspelling(s) });
      }
      items.push({
        label: 'Add to dictionary',
        click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      });
      items.push({ type: 'separator' });
    }

    if (params.linkURL) {
      items.push(
        { label: 'Open link in browser', click: () => openExternal(params.linkURL) },
        { label: 'Copy link', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }

    if (params.mediaType === 'image') {
      items.push(
        { label: 'Copy image', click: () => wc.copyImageAt(params.x, params.y) },
        { label: 'Save image', click: () => wc.downloadURL(params.srcURL) },
        { type: 'separator' },
      );
    }

    const f = params.editFlags;
    if (params.isEditable) {
      items.push(
        { role: 'undo', enabled: f.canUndo },
        { role: 'redo', enabled: f.canRedo },
        { type: 'separator' },
        { role: 'cut', enabled: f.canCut },
        { role: 'copy', enabled: f.canCopy },
        { role: 'paste', enabled: f.canPaste },
        { role: 'pasteAndMatchStyle', enabled: f.canPaste },
        { role: 'selectAll', enabled: f.canSelectAll },
      );
    } else if (params.selectionText) {
      items.push({ role: 'copy' });
    }

    if (items.length && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' });
    items.push(
      { label: 'Back', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Forward', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Reload', click: () => wc.reload() },
      { type: 'separator' },
      { label: 'Inspect element', click: () => wc.inspectElement(params.x, params.y) },
    );

    Menu.buildFromTemplate(items).popup();
  });
}

export function openExternal(url: string): void {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}
