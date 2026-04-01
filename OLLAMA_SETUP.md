# Ollama Setup Guide

## What is Ollama?
Ollama runs AI models locally on your computer. Completely free, no internet dependency, no deprecation issues.

## Installation

### 1. Download Ollama for Windows
- Go to: https://ollama.com/download
- Download the Windows installer
- Install it (click through the installer)

### 2. Run Ollama
After installation, Ollama runs as a background service automatically.

To verify it's running, open PowerShell and run:
```powershell
curl http://127.0.0.1:11434/api/tags
```

If you see a response with available models, Ollama is ready.

### 3. Download a Model (First Time Only)
Open PowerShell and run:
```powershell
ollama pull mistral
```

This downloads the Mistral model (~5GB). Only needed once.

### 4. Done!
- Your backend will automatically use Ollama at `http://127.0.0.1:11434`
- Upload PDFs to the frontend
- Transactions will be parsed locally without any API limits

## Models Available (Free)
- `mistral` (7B) - Fast, good for transactions ✓ (Used by default)
- `neural-chat` (7B) - Good accuracy
- `dolphin-mixtral` (8x7B) - Better quality, slower
- `llama2` (7B) - Classic model

## Troubleshooting
If backend says "Cannot connect to Ollama":
1. Make sure Ollama is running (check Windows System Tray)
2. Run: `ollama serve` in PowerShell to start it manually
3. Verify: `curl http://127.0.0.1:11434/api/tags`
