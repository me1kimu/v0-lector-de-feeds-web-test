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

  // Determine which model to use
  const isOllamaEnabled = useOllama && process.env.OLLAMA_ENDPOINT
  
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

  // Select model based on preference
  let model
  if (isOllamaEnabled) {
    const ollama = createOllamaClient()
    // Use Mistral model (recommended: efficient, multilingual, 7B)
    // Other options: llama2, neural-chat, dolphin-mixtral
    model = ollama('mistral')
  } else {
    // Default to Gemini Flash
    model = google('gemini-2.0-flash')
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
