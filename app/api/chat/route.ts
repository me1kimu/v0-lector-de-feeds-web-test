import {
  consumeStream,
  convertToModelMessages,
  generateText,
  streamText,
  UIMessage,
  type LanguageModel,
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

// Create OpenRouter provider for free models
// Uses chat completions endpoint for OpenAI compatibility
const createOpenRouterClient = () => {
  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    compatibility: 'compatible',
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://feedreader.app',
      'X-Title': 'FeedReader',
    },
  })
}

// OpenRouter models in priority order (all free)
const OPENROUTER_FALLBACK_MODELS = [
  'google/gemma-3-27b-it:free',
  'nvidia/llama-nemotron-embed-vl-1b-v2:free',
  'minimax/minimax-m2.5:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
]

// Create Google Gemini provider - automatically uses GOOGLE_GENERATIVE_AI_API_KEY env var
const google = createGoogleGenerativeAI()

// Create Ollama provider for local models
// Ollama runs on http://localhost:11434 by default
const createOllamaClient = () => {
  const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/v1'
  return createOpenAI({
    baseURL: endpoint,
    apiKey: 'ollama',
  })
}

type OllamaModelInfo = {
  name: string
  details?: {
    parameter_size?: string
  }
  size?: number
}

type RankedOllamaModel = {
  id: string
  parameterCount: number
}

const OLLAMA_MODEL_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let cachedOllamaModels: { models: RankedOllamaModel[]; createdAt: number } | null = null

function getOllamaApiBaseUrl() {
  const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/v1'
  return endpoint.replace(/\/v1\/?$/, '')
}

function parseParameterSize(parameterSize?: string): number {
  if (!parameterSize) {
    return 0
  }

  const match = parameterSize.trim().match(/^([\d.]+)\s*([kKmMgGtT]?)(?:[bB])?$/)
  if (!match) {
    return 0
  }

  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value)) {
    return 0
  }

  const unit = match[2]?.toLowerCase()
  const multiplierMap: Record<string, number> = {
    '': 1,
    k: 1_000,
    m: 1_000_000,
    g: 1_000_000_000,
    t: 1_000_000_000_000,
  }

  return value * (multiplierMap[unit ?? ''] ?? 1)
}

async function fetchOllamaModels(): Promise<RankedOllamaModel[]> {
  if (cachedOllamaModels && Date.now() - cachedOllamaModels.createdAt < OLLAMA_MODEL_CACHE_TTL) {
    return cachedOllamaModels.models
  }

  try {
    const response = await fetch(new URL('/api/tags', getOllamaApiBaseUrl()), {
      signal: AbortSignal.timeout(4000),
    })

    if (!response.ok) {
      return []
    }

    const payload = await response.json() as { models?: OllamaModelInfo[] }
    const models = Array.isArray(payload.models)
      ? payload.models
          .map((model) => ({
            id: model.name,
            parameterCount: parseParameterSize(model.details?.parameter_size),
          }))
          .filter((model) => Boolean(model.id))
          .sort((left, right) => right.parameterCount - left.parameterCount || left.id.localeCompare(right.id))
      : []

    cachedOllamaModels = {
      models,
      createdAt: Date.now(),
    }

    return models
  } catch (error) {
    console.warn('[v0] Unable to list Ollama models:', error instanceof Error ? error.message : error)
    return []
  }
}

// Cache successful model for the lifetime of this server instance
// to avoid re-probing on every request
let cachedWorkingModel: { id: string; createdAt: number } | null = null
const MODEL_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Probe a model with a minimal request to verify availability
async function probeModel(model: LanguageModel, timeoutMs = 5000): Promise<boolean> {
  try {
    await generateText({
      model,
      prompt: 'hi',
      abortSignal: AbortSignal.timeout(timeoutMs),
    })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const isTimeoutAbort = /aborted|timeout|timed out/i.test(message)

    if (isTimeoutAbort) {
      console.warn(`[v0] Model probe timed out after ${timeoutMs}ms:`, message)
    } else {
      console.error('[v0] Model probe failed:', message)
    }
    return false
  }
}

// Select the first working model from the fallback chain
async function selectWorkingModel(preferOllama: boolean): Promise<{ model: LanguageModel; id: string } | null> {
  // Check cache first
  if (cachedWorkingModel && Date.now() - cachedWorkingModel.createdAt < MODEL_CACHE_TTL) {
    const cachedId = cachedWorkingModel.id
    console.log('[v0] Using cached model:', cachedId)
    
    if (cachedId.startsWith('openrouter:') && process.env.OPENROUTER_API_KEY) {
      const modelId = cachedId.replace('openrouter:', '')
      return { model: createOpenRouterClient()(modelId), id: cachedId }
    }
    if (cachedId.startsWith('ollama:')) {
      const modelId = cachedId.replace('ollama:', '')
      return { model: createOllamaClient()(modelId), id: cachedId }
    }
    if (cachedId === 'gemini:flash') {
      return { model: google('gemini-2.0-flash'), id: cachedId }
    }
  }

  // Build attempt list based on priority: strongest Ollama models -> OpenRouter -> Gemini
  const attempts: Array<{ id: string; build: () => LanguageModel }> = []

  // 1. Local Models (Ollama), ordered by parameter count
  const ollamaModels = await fetchOllamaModels()
  for (const modelInfo of ollamaModels) {
    attempts.push({
      id: `ollama:${modelInfo.id}`,
      build: () => createOllamaClient()(modelInfo.id),
    })
  }
  
  // 2. OpenRouter models (First fallback cascade)
  if (process.env.OPENROUTER_API_KEY) {
    for (const modelId of OPENROUTER_FALLBACK_MODELS) {
      attempts.push({
        id: `openrouter:${modelId}`,
        build: () => createOpenRouterClient()(modelId),
      })
    }
  }
  
  // 3. Gemini (Second fallback)
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    attempts.push({
      id: 'gemini:flash',
      build: () => google('gemini-2.0-flash'),
    })
  }

  // Try each model with a probe
  for (const attempt of attempts) {
    try {
      const model = attempt.build()
      const timeoutMs = attempt.id.startsWith('ollama:') ? 10000 : 7000
      const works = await probeModel(model, timeoutMs)
      if (works) {
        console.log('[v0] Selected model:', attempt.id)
        cachedWorkingModel = { id: attempt.id, createdAt: Date.now() }
        return { model, id: attempt.id }
      }
    } catch (error) {
      console.error(`[v0] Failed to build ${attempt.id}:`, error instanceof Error ? error.message : error)
    }
  }

  return null
}

export const maxDuration = 30

export async function POST(req: Request) {
  const bodyText = await req.text()
  console.log('[v0] Chat API received body:', bodyText.substring(0, 200) + '...')
  const { messages, feedItems, useOllama } = JSON.parse(bodyText)

  // Build system prompt with feed context
  let systemPrompt = `Eres un asistente inteligente que ayuda a los usuarios a entender y resumir su feed de noticias y redes sociales.
  
Tu objetivo es:
- Resumir las publicaciones mas recientes de forma clara y concisa
- Identificar temas y tendencias comunes entre las publicaciones
- Responder preguntas sobre el contenido del feed
- Ayudar al usuario a encontrar informacion especifica

Responde siempre en español. Se conciso pero informativo.`

  if (feedItems && feedItems.length > 0) {
    const feedContext = feedItems.map((item, i) => 
      `[${i + 1}] ${item.source} - ${item.author}
Titulo: ${item.title}
Fecha: ${item.publishedAt}
Contenido: ${item.content.substring(0, 500)}${item.content.length > 500 ? '...' : ''}`
    ).join('\n\n---\n\n')
    
    systemPrompt += `\n\nAqui estan las ultimas ${feedItems.length} publicaciones del feed del usuario:\n\n${feedContext}`
  }

  // Automatically select first working model from the fallback chain
  // Order: strongest local Ollama models -> OpenRouter -> Gemini
  const selection = await selectWorkingModel(useOllama === true)
  
  if (!selection) {
    return new Response(
      JSON.stringify({ 
        error: 'No hay modelos disponibles',
        details: 'Todos los modelos del fallback fallaron. Configura OPENROUTER_API_KEY, instala Ollama, o configura GOOGLE_GENERATIVE_AI_API_KEY.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const result = streamText({
    model: selection.model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
    onError: ({ error }) => {
      const msg = error instanceof Error ? error.message : String(error)
      console.log(`[v0] Chat stream error with ${selection?.id}:`, msg, error)
      // Invalidate cache so next request will re-probe
      cachedWorkingModel = null
    },
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
