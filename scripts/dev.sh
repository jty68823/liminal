#!/bin/bash
# Liminal Development Server Startup
# Usage: ./scripts/dev.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Starting Liminal development servers..."

# Initialize database if not exists
if [ ! -f "data/liminal.db" ]; then
  echo "📦 Initializing database..."
  mkdir -p data
  node scripts/init-db.mjs
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "⚠️  Warning: Ollama is not running at http://localhost:11434"
  echo "    Start Ollama with: ollama serve"
fi

echo ""
echo "Starting services:"
echo "  API Server: http://localhost:3001"
echo "  Web UI:     http://localhost:3000"
echo ""

# Start all dev servers using turbo
pnpm turbo run dev --filter @liminal/api --filter @liminal/web
