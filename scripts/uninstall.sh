#!/usr/bin/env bash
# Removes the launcher entry. Your logins in ~/.config/LLMs are left alone.
rm -f "$HOME/.local/share/applications/llms.desktop" \
      "$HOME/.local/share/icons/hicolor/512x512/apps/llms.png" \
      "$HOME/.local/share/icons/hicolor/scalable/apps/llms.svg" \
      "$HOME/.local/bin/llms"
echo "Removed. Delete ~/.config/LLMs too if you want to wipe all logins."
