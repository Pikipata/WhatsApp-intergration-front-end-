export type Conversation = {
  id: string
  lms_user_id: string | null
  phone: string
  display_name: string | null
  opted_out: boolean
  last_inbound_at: string | null
  created_at: string
}

export type Message = {
  id: string
  direction: 'inbound' | 'outbound'
  kind: 'welcome' | 'text' | 'unsupported'
  body: string | null
  status: string
  created_at: string
}

export type InquiryNote = { content: string; updated_at: string | null }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers }, credentials: 'same-origin' })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json() as { detail?: string; error?: string }
      message = body.detail || body.error || message
    } catch { /* Keep the HTTP status as the fallback. */ }
    if (response.status === 401) message = 'Staff API access is not configured. Set API_STAFF_KEY in the Vite server .env.local file.'
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const getHealth = () => request<{ ok: boolean }>('/health')
export const getConversations = () => request<Conversation[]>('/api/conversations')
export const createRider = (name: string, phone: string) => request<Conversation>('/api/conversations', { method: 'POST', body: JSON.stringify({ name, phone }) })
export const getMessages = (id: string) => request<Message[]>(`/api/conversations/${encodeURIComponent(id)}/messages`)
export const getNote = (id: string) => request<InquiryNote>(`/api/conversations/${encodeURIComponent(id)}/note`)
export const saveNote = (id: string, content: string) => request<InquiryNote>(`/api/conversations/${encodeURIComponent(id)}/note`, { method: 'PUT', body: JSON.stringify({ content }) })
export const sendMessage = (id: string, text: string) => request<{ messageId: string; providerId: string }>(`/api/conversations/${encodeURIComponent(id)}/messages`, { method: 'POST', body: JSON.stringify({ text }) })