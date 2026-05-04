#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

NEXT_PORT="${PORT:-3000}"
OLLAMA_HOST_URL="${OLLAMA_HOST_URL:-http://127.0.0.1:11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-qwen:0.5b}"

cleanup() {
  local exit_code=$?

  if [[ -n "${OLLAMA_PID:-}" ]] && kill -0 "$OLLAMA_PID" 2>/dev/null; then
    kill "$OLLAMA_PID" 2>/dev/null || true
  fi

  if [[ -n "${NEXT_PID:-}" ]] && kill -0 "$NEXT_PID" 2>/dev/null; then
    kill "$NEXT_PID" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

echo "[dev-with-ollama] Iniciando Next.js en puerto ${NEXT_PORT}..."
pnpm run dev:next &
NEXT_PID=$!

# Espera hasta que Next.js responda
for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:${NEXT_PORT}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://127.0.0.1:${NEXT_PORT}" >/dev/null 2>&1; then
  echo "[dev-with-ollama] Next.js no respondió en el tiempo esperado; no se iniciará Ollama."
  wait "$NEXT_PID"
  exit 1
fi

echo "[dev-with-ollama] Next.js activo. Iniciando Ollama justo después..."

if ! command -v ollama >/dev/null 2>&1; then
  echo "[dev-with-ollama] Ollama no está instalado en PATH."
  wait "$NEXT_PID"
  exit 1
fi

if curl -fsS "${OLLAMA_HOST_URL}/api/tags" >/dev/null 2>&1; then
  echo "[dev-with-ollama] Ollama ya está corriendo en ${OLLAMA_HOST_URL}."
  OLLAMA_PID=""
else
  nohup ollama serve >/tmp/ollama.log 2>&1 &
  OLLAMA_PID=$!

  for _ in {1..30}; do
    if curl -fsS "${OLLAMA_HOST_URL}/api/tags" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl -fsS "${OLLAMA_HOST_URL}/api/tags" >/dev/null 2>&1; then
    echo "[dev-with-ollama] No se pudo levantar Ollama en ${OLLAMA_HOST_URL}."
    wait "$NEXT_PID"
    exit 1
  fi
fi

if ! ollama list | awk '{print $1}' | grep -Fxq "$OLLAMA_MODEL"; then
  echo "[dev-with-ollama] Descargando modelo ${OLLAMA_MODEL}..."
  ollama pull "$OLLAMA_MODEL"
fi

echo "[dev-with-ollama] Listo: Next.js + Ollama (${OLLAMA_MODEL})."
wait "$NEXT_PID"
