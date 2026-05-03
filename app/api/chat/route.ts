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
    console.error('[v0] Model probe failed:', error instanceof Error ? error.message : error)
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
    if (cachedId === 'ollama:mistral') {
      return { model: createOllamaClient()('mistral'), id: cachedId }
    }
    if (cachedId === 'gemini:flash') {
      return { model: google('gemini-2.0-flash'), id: cachedId }
    }
  }

  // Build attempt list based on preference
  const attempts: Array<{ id: string; build: () => LanguageModel }> = []
  
  // If user prefers Ollama, try it first
  if (preferOllama) {
    attempts.push({
      id: 'ollama:mistral',
      build: () => createOllamaClient()('mistral'),
    })
  }
  
  // OpenRouter models (primary cascade)
  if (process.env.OPENROUTER_API_KEY) {
    for (const modelId of OPENROUTER_FALLBACK_MODELS) {
      attempts.push({
        id: `openrouter:${modelId}`,
        build: () => createOpenRouterClient()(modelId),
      })
    }
  }
  
  // Ollama fallback (if not preferred)
  if (!preferOllama) {
    attempts.push({
      id: 'ollama:mistral',
      build: () => createOllamaClient()('mistral'),
    })
  }
  
  // Gemini as last resort
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
      const works = await probeModel(model, attempt.id.startsWith('ollama:') ? 2000 : 5000)
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
  const { messages, feedItems, useOllama }: { messages: UIMessage[]; feedItems?: Array<{
    title: string
    author: string
    source: string
    content: string
    publishedAt: string
  }>; useOllama?: boolean } = await req.json()

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
  // Order: [Ollama if preferred] -> OpenRouter (4 models) -> Ollama -> Gemini
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
      console.error(`[v0] Stream error with ${selection.id}:`, error instanceof Error ? error.message : error)
      // Invalidate cache so next request will re-probe
      cachedWorkingModel = null
    },
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
