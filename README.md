# LLMs — Lots of Login Models

One window, every free chatbot you're logged into. Each provider is its real website in
its own Chromium view with its own saved cookies, behind one clean toggle bar.

## Run

```sh
npm install
npm start                # build + launch
./scripts/install.sh     # add to the KDE app launcher (+ `llms` command)
```

After changing code: `npm run build`, then relaunch.

## How it works

- `src/main/providers.ts`: the provider list (URL, cookie partition, allowed domains). Add or fix providers here.
- `src/main/viewManager.ts`: window, lazy tab loading, keep-alive unloading, layout.
- `src/main/sessions.ts`: per-provider cookie jars, Chrome user agent, permissions, downloads.
- `src/main/navigation.ts`: login popups, external links → system browser, right-click menu.
- `src/main/shortcuts.ts`: keyboard shortcuts.
- `src/renderer/`: the top bar and settings panel (plain TS/HTML/CSS).

The **+** button adds a second account of any provider (separate cookies) or any website of your own; both can be removed again in Settings or from the tab's right-click menu.

Logins and settings live in `~/.config/LLMs/`. Gemini and AI Studio share one Google login.

## Shortcuts

| Keys | Action |
|---|---|
| Ctrl+1…9 | Jump to provider |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous provider |
| Ctrl+R / Ctrl+Shift+R | Reload / hard reload |
| Ctrl + / − / 0 | Zoom (remembered per provider) |
| Alt+← / → | Back / forward |
| Alt+Home | Back to provider start page |
| Ctrl+T | Add a tab: another account or a custom site |
| Ctrl+, | Settings |
| Ctrl+Shift+I | DevTools for the current page |
| F11 | Fullscreen |
| Right-click a tab | Reload, unload, open in browser, log out |
