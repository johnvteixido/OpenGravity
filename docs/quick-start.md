# Quick Start Guide

Welcome to OpenGravity!

## 1. Prerequisites

- Node.js 20+
- Python 3.11+
- Git

## 2. Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/johnvteixido/OpenGravity.git
   cd OpenGravity
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## 3. Launching

Start the development server:

```bash
npm run dev
```

This will concurrently:

1. Start the Vite React renderer.
2. Launch the Python agent server on `127.0.0.1:7432`.
3. Launch the Electron app container.

## 4. Setup

Follow the on-screen Setup Wizard inside the app. If you don't have Ollama installed, OpenGravity will download it for you and boot up the selected model.
