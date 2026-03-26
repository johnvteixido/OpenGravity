# OpenGravity — Ollama installer for Windows (PowerShell)
# This script is run by the OpenGravity app when Ollama is not detected.

param()
$ErrorActionPreference = "Stop"

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  OpenGravity — Installing Ollama" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan

# Check if already installed
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  $version = & ollama --version
  Write-Host "✓ Ollama already installed: $version" -ForegroundColor Green
  exit 0
}

# Download Ollama installer
$installerUrl = "https://ollama.com/download/OllamaSetup.exe"
$tmpDir = [System.IO.Path]::GetTempPath()
$installerPath = Join-Path $tmpDir "OllamaSetup.exe"

Write-Host "→ Downloading Ollama installer…" -ForegroundColor Yellow
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing

Write-Host "→ Running installer (silent)…" -ForegroundColor Yellow
Start-Process -FilePath $installerPath -ArgumentList "/S" -Wait -NoNewWindow

# Wait for Ollama to start
Start-Sleep -Seconds 5

# Verify
try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 5 -UseBasicParsing
  if ($response.StatusCode -eq 200) {
    Write-Host "✓ Ollama is running at http://127.0.0.1:11434" -ForegroundColor Green
  }
} catch {
  Write-Host "→ Starting Ollama…" -ForegroundColor Yellow
  Start-Process "ollama" -ArgumentList "serve" -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

# Cleanup
Remove-Item $installerPath -Force -ErrorAction SilentlyContinue

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Setup complete! Return to OpenGravity." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
