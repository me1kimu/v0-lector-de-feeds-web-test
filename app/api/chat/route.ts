import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

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

  // Default to Ollama (local, no quota limits)
  // Fallback to Gemini if Ollama is not available and explicitly requested
  let model
  
  try {
    const ollama = createOllamaClient()
    // Use Mistral model (recommended: efficient, multilingual, 7B)
    model = ollama('mistral')
  } catch (error) {
    console.error('[v0] Ollama unavailable, falling back to Gemini:', error)
    // Fallback to Gemini if Ollama fails
    try {
      model = google('gemini-2.0-flash')
    } catch (geminiError) {
      console.error('[v0] Both Ollama and Gemini failed:', geminiError)
      // Return error response
      return new Response(
        JSON.stringify({ 
          error: 'No hay modelos disponibles. Por favor instala Ollama o asegúrate de que Gemini tiene cuota disponible.',
          details: geminiError instanceof Error ? geminiError.message : 'Error desconocido'
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
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
