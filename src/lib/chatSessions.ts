import type { Message } from './api'
import { generateId } from './uuid'

export type ChatSession = {
  id: string
  title: string
  messages: Message[]
  modelId: string
  kind: 'agent' | 'chat'
  agentChatId: string
  createdAt: string
  updatedAt: string
}

const LIST_KEY = 'noti-chat-sessions-v1'
const ACTIVE_KEY = 'noti-chat-active-id'
const MAX_SESSIONS = 50
const SESSION_EVENT = 'noti-chat-sessions-changed'

export function loadChatSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatSession[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((session) => ({
      ...session,
      kind: session.kind === 'agent' || session.kind === 'chat'
        ? session.kind
        : session.modelId === 'agent' ? 'agent' : 'chat',
    }))
  } catch {
    return []
  }
}

function saveChatSessions(list: ChatSession[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list.slice(0, MAX_SESSIONS)))
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function getActiveSessionId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveSessionId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function findChatSession(id: string): ChatSession | undefined {
  return loadChatSessions().find((s) => s.id === id)
}

export function upsertChatSession(data: ChatSession) {
  const list = loadChatSessions()
  const idx = list.findIndex((s) => s.id === data.id)
  const next = [...list]
  if (idx >= 0) next[idx] = data
  else next.unshift(data)
  next.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  saveChatSessions(next)
  return data
}

export function deleteChatSession(id: string) {
  saveChatSessions(loadChatSessions().filter((s) => s.id !== id))
  if (getActiveSessionId() === id) setActiveSessionId(null)
}

export function clearAllChatSessions() {
  localStorage.removeItem(LIST_KEY)
  localStorage.removeItem(ACTIVE_KEY)
  window.dispatchEvent(new Event(SESSION_EVENT))
}

export function createChatSession(
  modelId = 'agent',
  kind: ChatSession['kind'] = modelId === 'agent' ? 'agent' : 'chat',
): ChatSession {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    title: 'Cuộc trò chuyện mới',
    messages: [],
    modelId,
    kind,
    agentChatId: `web-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  }
}

export function titleFromMessage(text: string): string {
  const clean = text.replace(/\[Tệp:[^\]]+\]/g, '').replace(/\[Đính kèm:[^\]]+\]/g, '').trim()
  const line = clean.split('\n').find((l) => l.trim()) || clean
  return (line.slice(0, 48) || 'Cuộc trò chuyện mới').trim()
}

export function formatSessionTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

export function subscribeChatSessions(cb: () => void) {
  const handler = () => cb()
  window.addEventListener(SESSION_EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(SESSION_EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}
