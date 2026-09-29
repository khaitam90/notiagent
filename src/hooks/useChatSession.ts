import { useCallback, useEffect, useState } from 'react'
import type { Message } from '../lib/api'
import {
  createChatSession,
  findChatSession,
  getActiveSessionId,
  setActiveSessionId,
  subscribeChatSessions,
  titleFromMessage,
  upsertChatSession,
  loadChatSessions,
  type ChatSession,
} from '../lib/chatSessions'
import { AGENT_MODEL_ID, isAgentModelId, loadLastModelId } from '../lib/models'

export function useChatSession(defaultModelId = AGENT_MODEL_ID) {
  const [session, setSession] = useState<ChatSession | null>(null)

  const ensureSession = useCallback((): ChatSession => {
    let id = getActiveSessionId()
    if (id) {
      const found = findChatSession(id)
      if (found) return found
    }
    const matching = loadChatSessions()
    if (matching.length) {
      setActiveSessionId(matching[0].id)
      return matching[0]
    }
    const model = loadLastModelId() || defaultModelId
    const created = createChatSession(model, isAgentModelId(model) ? 'agent' : 'chat')
    upsertChatSession(created)
    setActiveSessionId(created.id)
    return created
  }, [defaultModelId])

  const reload = useCallback(() => {
    setSession(ensureSession())
  }, [ensureSession])

  useEffect(() => {
    reload()
    return subscribeChatSessions(reload)
  }, [reload])

  const persist = useCallback(
    (patch: Partial<ChatSession> & { messages?: Message[] }) => {
      const base = session || ensureSession()
      const next: ChatSession = {
        ...base,
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      if (patch.messages?.length) {
        const firstUser = patch.messages.find((m) => m.role === 'user')
        if (firstUser && (base.title === 'Cuộc trò chuyện mới' || base.title === 'Giao việc mới' || !base.title)) {
          next.title = titleFromMessage(firstUser.content)
        }
      }
      if (patch.modelId) {
        next.kind = isAgentModelId(patch.modelId) ? 'agent' : 'chat'
      }
      upsertChatSession(next)
      setSession(next)
      return next
    },
    [session, ensureSession],
  )

  const startNew = useCallback(
    (modelId?: string) => {
      const mid = modelId || loadLastModelId() || session?.modelId || defaultModelId
      const created = createChatSession(mid, isAgentModelId(mid) ? 'agent' : 'chat')
      upsertChatSession(created)
      setActiveSessionId(created.id)
      setSession(created)
      return created
    },
    [session, defaultModelId],
  )

  const switchSession = useCallback((id: string) => {
    const found = findChatSession(id)
    if (!found) return
    setActiveSessionId(id)
    setSession(found)
  }, [])

  return { session, persist, startNew, switchSession, reload }
}
