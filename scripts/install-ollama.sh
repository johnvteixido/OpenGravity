#!/usr/bin/env bash
# OpenGravity — Ollama installer for Linux and macOS
# This script is run by the OpenGravity app when Ollama is not detected.

set -euo pipefail

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OpenGravity — Installing Ollama"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v ollama &>/dev/null; then
  echo "✓ Ollama is already installed: $(ollama --version)"
  exit 0
fi

OS="$(uname -s)"
echo "→ Detected OS: $OS"

if [[ "$OS" == "Darwin" ]]; then
  # macOS — check for Homebrew first
  if command -v brew &>/dev/null; then
    echo "→ Installing Ollama via Homebrew…"
    brew install ollama
  else
    echo "→ Downloading Ollama for macOS…"
    TMPDIR=$(mktemp -d)
    curl -fsSL "https://ollama.com/download/Ollama-darwin.zip" -o "$TMPDIR/ollama.zip"
    unzip -q "$TMPDIR/ollama.zip" -d "$TMPDIR"
    echo "→ Moving Ollama.app to /Applications…"
    cp -r "$TMPDIR/Ollama.app" /Applications/Ollama.app
    open /Applications/Ollama.app
    rm -rf "$TMPDIR"
  fi
elif [[ "$OS" == "Linux" ]]; then
  echo "→ Installing Ollama via official installer…"
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo "✗ Unsupported OS: $OS"
  echo "  Please install Ollama manually from https://ollama.com/download"
  exit 1
fi

echo ""
echo "✓ Ollama installed successfully!"
echo "  Starting Ollama service…"

if [[ "$OS" == "Linux" ]]; then
  if command -v systemctl &>/dev/null; then
    systemctl --user enable --now ollama.service 2>/dev/null || true
  fi
fi

# Give it a moment to start
sleep 2

if curl -sf http://127.0.0.1:11434/api/tags &>/dev/null; then
  echo "✓ Ollama is running at http://127.0.0.1:11434"
else
  echo "→ Starting Ollama in background…"
  ollama serve &>/dev/null &
  sleep 3
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup complete! Return to OpenGravity."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
