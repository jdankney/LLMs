# LLMs — Lots of Login Models

One window, every free chatbot you're logged into. Each provider is its real website in
its own Chromium view, with an isolated cookie jar (Gemini and AI Studio share one
Google login), behind one clean toggle bar.

## Requirements

- Linux (KDE Plasma on Wayland is the primary target; X11 works too)
- Node.js 22.12+ and npm

## Run

```sh
npm install
npm start                # build + launch
npm run dev              # build + launch with Electron logging
./scripts/install.sh     # add to the KDE app launcher (+ `llms` command)
```

After changing code: `npm run build`, then relaunch.

## Uninstall

With the app closed:

```sh
./scripts/uninstall.sh
rm -rf ~/.config/LLMs    # also deletes all saved logins and settings
```

## How it works

- `src/main/providers.ts`: the provider list (URL, cookie partition, allowed domains). Add or fix providers here.
- `src/main/viewManager.ts`: window, lazy tab loading, keep-alive unloading, layout.
- `src/main/sessions.ts`: per-provider cookie jars, Chrome user agent, permissions, downloads.
- `src/main/navigation.ts`: login popups, external links → system browser, right-click menu.
- `src/main/shortcuts.ts`: keyboard shortcuts.
- `src/renderer/`: the top bar and settings panel (plain TS/HTML/CSS).

The **+** button adds a second account of any provider (separate cookies) or any website of your own; both can be removed again in Settings or from the tab's right-click menu.

**Split view** shows 2–4 providers side by side (two or three in columns, four in a 2×2 grid, in tab bar order). Turn it on with the split button or Ctrl+\, then Shift+click tabs to add or remove panes. Click into a pane to focus it; reload, zoom and shortcuts act on the focused pane, and a plain click on another tab swaps it into the split (panes stay in tab-bar order). The layout is remembered across restarts.

Logins and settings live in `~/.config/LLMs/`. With the app closed, delete that folder to wipe every saved login.

## Privacy

The app itself has no telemetry, analytics or API keys. Each provider runs in its own
Chromium session; cookies, cache and settings stay in `~/.config/LLMs/`. Custom sites get
the same isolated cookie jars as built-in providers.

## Security

Provider pages run with `sandbox`, `contextIsolation` and no Node integration. Only the
top bar gets a preload bridge. Links outside a provider's allowed domains open in the
system browser; login popups stay in the provider's cookie jar.

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl+1…9 | Jump to provider |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous provider (or pane, in split view) |
| Ctrl+PageDown / Ctrl+PageUp | Next / previous provider (or pane, in split view) |
| Ctrl+\ | Split view on / off |
| Shift+click a tab | Add / remove it as a pane (up to 4) |
| Ctrl+R / Ctrl+Shift+R | Reload / hard reload |
| F5 / Shift+F5 | Reload / hard reload |
| Ctrl + / − / 0 | Zoom (remembered per provider) |
| Alt+← / → | Back / forward |
| Alt+Home | Back to provider start page |
| Ctrl+T | Add a tab: another account or a custom site |
| Ctrl+, | Settings |
| Ctrl+Shift+I | DevTools for the current page |
| F11 | Fullscreen |
| Right-click a tab | Reload, back to start page, unload, open in browser, log out |

## Disclaimer

LLMs is an unofficial wrapper around third-party websites. It is not affiliated with or
endorsed by any provider. All trademarks belong to their respective owners, and you are
responsible for complying with each provider's terms of service.
