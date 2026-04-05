#!/usr/bin/env bash
# OpenGravity — Ollama Installer for Linux/macOS
# This script is invoked by the OpenGravity agent server when Ollama is not detected.
# It uses the official Ollama install script.

set -e

echo "[OpenGravity] Installing Ollama..."
curl -fsSL https://ollama.com/install.sh | sh

echo "[OpenGravity] Starting Ollama service..."
if command -v systemctl &>/dev/null; then
    systemctl enable --now ollama 2>/dev/null || true
else
    nohup ollama serve &>/tmp/ollama.log &
    sleep 3
fi

# Verify
if curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    echo "[OpenGravity] Ollama is running on port 11434."
    exit 0
else
    echo "[OpenGravity] Ollama installed. You may need to start it manually: ollama serve"
    exit 1
fi
