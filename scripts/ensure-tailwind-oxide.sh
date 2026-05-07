#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

node <<'NODE'
const { execFileSync } = require('node:child_process')

function isMuslLinux() {
  if (process.platform !== 'linux') {
    return false
  }

  try {
    const report = process.report?.getReport?.()
    return !report?.header?.glibcVersionRuntime
  } catch {
    return false
  }
}

function isBindingPresent() {
  const platform = process.platform
  const arch = process.arch
  const isMusl = isMuslLinux()

  const candidates = []
  if (platform === 'linux' && arch === 'x64') {
    candidates.push(isMusl ? '@tailwindcss/oxide-linux-x64-musl' : '@tailwindcss/oxide-linux-x64-gnu')
  } else if (platform === 'linux' && arch === 'arm64') {
    candidates.push(isMusl ? '@tailwindcss/oxide-linux-arm64-musl' : '@tailwindcss/oxide-linux-arm64-gnu')
  } else if (platform === 'linux' && arch === 'arm') {
    candidates.push(isMusl ? '@tailwindcss/oxide-linux-arm-musleabihf' : '@tailwindcss/oxide-linux-arm-gnueabihf')
  }

  return candidates.some((candidate) => {
    try {
      require.resolve(`${candidate}/package.json`)
      return true
    } catch {
      return false
    }
  })
}

if (isBindingPresent()) {
  process.exit(0)
}

console.log('[ensure-tailwind-oxide] Missing Tailwind native binding; reinstalling dependencies with pnpm...')
execFileSync('pnpm', ['install'], { stdio: 'inherit' })
NODE