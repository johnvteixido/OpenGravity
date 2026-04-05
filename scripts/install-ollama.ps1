# OpenGravity — Ollama Installer for Windows
# This script is invoked by the OpenGravity agent server when Ollama is not detected.
# It downloads and runs the official Ollama installer for Windows.

$ErrorActionPreference = "Stop"

$OllamaInstallerUrl = "https://ollama.com/download/OllamaSetup.exe"
$InstallerPath = Join-Path $env:TEMP "OllamaSetup.exe"

Write-Host "[OpenGravity] Downloading Ollama installer..."
Try {
    Invoke-WebRequest -Uri $OllamaInstallerUrl -OutFile $InstallerPath -UseBasicParsing
    Write-Host "[OpenGravity] Download complete. Running installer..."
    Start-Process -FilePath $InstallerPath -ArgumentList "/SILENT" -Wait
    Write-Host "[OpenGravity] Ollama installed successfully."
    # Wait a moment for the service to start
    Start-Sleep -Seconds 3
    # Verify
    $result = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($result.StatusCode -eq 200) {
        Write-Host "[OpenGravity] Ollama is running on port 11434."
        exit 0
    } else {
        Write-Host "[OpenGravity] Ollama installed but not yet responding. Please start it manually."
        exit 1
    }
} Catch {
    Write-Error "[OpenGravity] Failed to install Ollama: $_"
    exit 1
}
