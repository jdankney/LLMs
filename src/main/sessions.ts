import { app, session, type Session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

// A plain desktop Chrome user agent built from Electron's own Chromium version, so
// the UA always matches the real engine. Without this, Google sign-in rejects the
// "Electron/x.y" UA as an insecure embedded browser and Cloudflare gets suspicious.
export const CHROME_UA =
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ` +
  `Chrome/${process.versions.chrome.split('.')[0]}.0.0.0 Safari/537.36`;

const ALLOWED_PERMISSIONS = new Set([
  'media', // mic for voice mode
  'clipboard-sanitized-write',
  'clipboard-read',
  'notifications',
  'fullscreen',
]);

type DownloadListener = (text: string, kind?: 'info' | 'error') => void;

const configured = new Set<string>();

export function getProviderSession(partition: string, onDownload: DownloadListener): Session {
  const ses = session.fromPartition(partition);
  if (configured.has(partition)) return ses;
  configured.add(partition);

  ses.setUserAgent(CHROME_UA);
  ses.setSpellCheckerLanguages([app.getLocale() || 'en-US']);

  ses.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission));
  });
  ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));

  ses.on('will-download', (_event, item) => {
    const target = uniquePath(path.join(app.getPath('downloads'), item.getFilename()));
    item.setSavePath(target);
    item.once('done', (_e, state) => {
      if (state === 'completed') onDownload(`Saved ${path.basename(target)} to Downloads`);
      else if (state === 'interrupted') onDownload(`Download failed: ${item.getFilename()}`, 'error');
    });
  });

  return ses;
}

function uniquePath(p: string): string {
  if (!fs.existsSync(p)) return p;
  const { dir, name, ext } = path.parse(p);
  for (let i = 1; ; i++) {
    const candidate = path.join(dir, `${name} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
}
