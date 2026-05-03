import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

// Create OpenRouter provider for Gemma (free model)
// Uses chat completions endpoint for OpenAI compatibility
const createOpenRouterClient = () => {
  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    compatibility: 'compatible', // Use chat completions instead of responses API
    headers: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://feedreader.app',
      'X-Title': 'FeedReader',
    },
  })
}

// Create Google Gemini provider - automatically uses GOOGLE_GENERATIVE_AI_API_KEY env var
const google = createGoogleGenerativeAI()

// Create Ollama provider for local models
// Ollama runs on http://localhost:11434 by default
const createOllamaClient = () => {
  const endpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/v1'
  return createOpenAI({
    baseURL: endpoint,
    apiKey: 'ollama', // Ollama doesn't require authentication
  })
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

  // Default to OpenRouter Gemma 4 (free model with no quota limits)
  // Fallback: Ollama -> Gemini
  let model
  
  try {
    // Try OpenRouter first (primary)
    if (process.env.OPENROUTER_API_KEY) {
      const openrouter = createOpenRouterClient()
      // Using Gemma 3 27B (latest free Gemma model on OpenRouter)
      model = openrouter('google/gemma-3-27b-it:free')
    } else {
      throw new Error('OPENROUTER_API_KEY not configured')
    }
  } catch (error) {
    console.error('[v0] OpenRouter unavailable, trying Ollama:', error)
    try {
      // Fallback to Ollama
      const ollama = createOllamaClient()
      model = ollama('mistral')
    } catch (ollamaError) {
      console.error('[v0] Ollama unavailable, falling back to Gemini:', ollamaError)
      try {
        // Final fallback to Gemini
        model = google('gemini-2.0-flash')
      } catch (geminiError) {
        console.error('[v0] All models failed:', geminiError)
        return new Response(
          JSON.stringify({ 
            error: 'No hay modelos disponibles. Por favor configura OPENROUTER_API_KEY, instala Ollama o asegúrate de que Gemini tiene cuota disponible.',
            details: geminiError instanceof Error ? geminiError.message : 'Error desconocido'
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }
  }

  const result = streamText({
    model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
