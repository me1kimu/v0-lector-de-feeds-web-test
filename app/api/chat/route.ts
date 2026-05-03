import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'

// Create Google Gemini provider
const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
})

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages, feedItems }: { messages: UIMessage[]; feedItems?: Array<{
    title: string
    author: string
    source: string
    content: string
    publishedAt: string
  }> } = await req.json()

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

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
