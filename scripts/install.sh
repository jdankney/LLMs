#!/usr/bin/env bash
# Adds LLMs to the KDE app launcher (per-user, no root). Undo with scripts/uninstall.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APPS="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor"

cd "$ROOT"
npm run build
chmod +x scripts/llms
mkdir -p "$APPS" "$ICONS/512x512/apps" "$ICONS/scalable/apps" "$HOME/.local/bin"
cp resources/app-icon.png "$ICONS/512x512/apps/llms.png"
cp resources/app-icon.svg "$ICONS/scalable/apps/llms.svg"
ln -sf "$ROOT/scripts/llms" "$HOME/.local/bin/llms"

cat > "$APPS/llms.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=LLMs
GenericName=AI Chat
Comment=Lots of Login Models: every chatbot in one window
Exec=$ROOT/scripts/llms %U
Icon=llms
Terminal=false
Categories=Network;Utility;
StartupWMClass=llms
DESKTOP

update-desktop-database "$APPS" 2>/dev/null || true
echo "Installed. Find LLMs in your app launcher, or run 'llms' from a terminal."
