#!/bin/zsh
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required before running this app."
  echo "Download it from: https://nodejs.org/zh-cn/download"
  read "?Press Enter to exit."
  exit 1
fi

echo "Starting Ruankao Practice..."
echo "Open http://localhost:${PORT:-8787}"
npm start
