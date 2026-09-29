import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Bot, ChevronDown, Link2, Loader2, MessageSquare, MoreVertical, Paperclip, Plus, Puzzle, Send, Sparkles, User, X, Zap } from 'lucide-react'
import { fetchAgentStatus, fetchProviders, unifiedChat, type AgentStatus, type Message } from '../../lib/api'
import AgentCapabilitiesPanel from '../agent/AgentCapabilitiesPanel'
import { useAgentCapabilities } from '../../hooks/useAgentCapabilities'
import { useChatSession } from '../../hooks/useChatSession'
import {
  CHAT_MODEL_GROUPS,
  DEFAULT_CHAT_MODEL_ID,
  findChatModel,
  isModelAvailable,
  loadLastModelId,
  saveLastModelId,
} from '../../lib/models'
import { buildPersonalizationContext, getDisplayName, subscribePersonalization } from '../../lib/personalization'
import { generateId } from '../../lib/uuid'

const CURSOR_SUGGESTIONS = [
  { icon: '⚡', text: 'Tạo workflow n8n mới để nhận webhook Telegram' },
  { icon: '🌐', text: 'Truy cập Facebook tìm thông tin về xu hướng AI tuần này' },
  { icon: '🎨', text: 'Thiết kế giao diện trang chủ ứng dụng Nô Tì Agent' },
  { icon: '💬', text: 'Giải thích RAG và vector database bằng ngôn ngữ đơn giản' },
]

type AttachedFile = { id: string; name: string; size: number; preview?: string; content?: string }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function buildMessageWithAttachments(text: string, files: AttachedFile[]) {
  if (!files.length) return text
  const parts = files.map((f) => {
    if (f.content) return `[Tệp: ${f.name}]\n${f.content.slice(0, 8000)}`
    return `[Đính kèm: ${f.name} (${formatSize(f.size)})]`
  })
  return `${parts.join('\n\n')}\n\n${text}`
}

export default function ChatWorkspace() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelId, setModelId] = useState(() => loadLastModelId())
  const [modelOpen, setModelOpen] = useState(false)
  const [forceAgent, setForceAgent] = useState(false)
  const [providers, setProviders] = useState<Record<string, unknown> | null>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [capOpen, setCapOpen] = useState(false)
  const [capTab, setCapTab] = useState<'connections' | 'skills'>('connections')
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [modelMenuStyle, setModelMenuStyle] = useState<CSSProperties>({})
  const [displayName, setDisplayName] = useState(() => getDisplayName())
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)

  const { session, persist } = useChatSession(DEFAULT_CHAT_MODEL_ID)
  const messages = session?.messages ?? []
  const agentCaps = useAgentCapabilities()
  const selected = findChatModel(modelId)
  const configured = (providers as { chat?: { configured?: Record<string, boolean> } } | null)?.chat?.configured

  useEffect(() => {
    if (!session?.modelId || session.modelId === 'agent') return
    if (session.modelId !== modelId) setModelId(session.modelId)
  }, [session?.id, session?.modelId])

  useEffect(() => {
    fetchProviders().then(setProviders).catch(() => {})
    fetchAgentStatus().then(setAgentStatus).catch(() => setAgentStatus(null))
  }, [])

  useEffect(() => subscribePersonalization(() => setDisplayName(getDisplayName())), [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const max = window.matchMedia('(max-width: 900px)').matches ? 200 : 260
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const onResize = () => setIsMobile(mq.matches)
    onResize()
    mq.addEventListener('change', onResize)
    return () => mq.removeEventListener('change', onResize)
  }, [])

  useEffect(() => {
    syncTextareaHeight()
  }, [input, syncTextareaHeight])

  const openModelMenu = () => {
    if (modelRef.current && !isMobile) {
      const r = modelRef.current.getBoundingClientRect()
      const width = Math.max(300, Math.min(360, r.width))
      const left = Math.min(Math.max(12, r.left), window.innerWidth - width - 12)
      setModelMenuStyle({
        left,
        bottom: window.innerHeight - r.top + 8,
        width,
        maxHeight: Math.min(480, Math.max(200, r.top - 20)),
      })
    }
    setModelOpen(true)
  }

  const toggleModelMenu = () => {
    if (modelOpen) setModelOpen(false)
    else openModelMenu()
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const next: AttachedFile[] = []
    for (const file of Array.from(files)) {
      const id = generateId()
      const isText =
        file.type.startsWith('text/') ||
        /\.(txt|md|json|csv|js|ts|tsx|py|yaml|yml|xml|html|css)$/i.test(file.name)
      if (file.type.startsWith('image/')) {
        next.push({ id, name: file.name, size: file.size, preview: URL.createObjectURL(file) })
      } else if (isText) {
        const content = await file.text()
        next.push({ id, name: file.name, size: file.size, content })
      } else {
        next.push({ id, name: file.name, size: file.size })
      }
    }
    setAttachments((a) => [...a, ...next])
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeAttachment = (id: string) => {
    setAttachments((a) => {
      const item = a.find((x) => x.id === id)
      if (item?.preview) URL.revokeObjectURL(item.preview)
      return a.filter((x) => x.id !== id)
    })
  }

  const pickModel = (id: string) => {
    const m = findChatModel(id)
    if (!isModelAvailable(m, configured)) return
    saveLastModelId(id)
    setModelId(id)
    setModelOpen(false)
    if (session) persist({ modelId: id, kind: 'chat' })
  }

  const send = async (text?: string) => {
    const raw = (text ?? input).trim()
    if ((!raw && !attachments.length) || loading || !session) return
    const msg = buildMessageWithAttachments(raw, attachments)
    const fullMsg = `[Hồ sơ người dùng]\n${buildPersonalizationContext()}\n\n[Yêu cầu]\n${msg}`
    setInput('')
    setAttachments([])
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    const userMsg: Message = { role: 'user', content: msg, time }
    const nextMessages = [...messages, userMsg]
    persist({ messages: nextMessages, modelId, kind: 'chat' })
    setLoading(true)
    try {
      const hist = nextMessages.slice(0, -1).map((x) => ({ role: x.role, content: x.content }))
      const res = await unifiedChat(fullMsg, session.agentChatId, {
        messages: hist,
        provider: selected.provider,
        model: selected.model,
        skill: agentCaps.settings.skillId,
        connections: agentCaps.settings.enabledConnections,
        enabledSkills: agentCaps.settings.enabledSkills,
        forceAgent,
      })
      let reply = res.reply || ''
      if (res.mode === 'agent' && res.fallback) {
        reply = `⚠️ Agent fallback (tools không khả dụng) — ${res.provider}\n\n${reply}`
      }
      if (res.mode === 'agent') {
        fetchAgentStatus().then(setAgentStatus).catch(() => {})
      }
      persist({
        messages: [
          ...nextMessages,
          {
            role: 'assistant',
            content: reply,
            time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            mode: res.mode,
            modelLabel: res.mode === 'agent' ? 'Super Agent' : selected.label,
          },
        ],
        modelId,
        kind: res.mode === 'agent' ? 'agent' : 'chat',
      })
    } catch (e) {
      persist({
        messages: [
          ...nextMessages,
          { role: 'assistant', content: `⚠️ Lỗi: ${e instanceof Error ? e.message : String(e)}`, time: '' },
        ],
        modelId,
        kind: 'chat',
      })
    } finally {
      setLoading(false)
    }
  }

  const apiOk = agentStatus?.webhook_ok || configured?.novita || configured?.gemini

  const modelMenu =
    modelOpen &&
    createPortal(
      <>
        <button type="button" className="chat-v2-model-backdrop" aria-label="Đóng" onClick={() => setModelOpen(false)} />
        <div
          className={`chat-v2-model-menu${isMobile ? ' is-mobile' : ''}`}
          style={isMobile ? undefined : modelMenuStyle}
          role="listbox"
          aria-label="Chọn model AI"
        >
          <div className="model-dropdown-head">
            <span>Model AI (bộ não)</span>
            <button type="button" onClick={() => setModelOpen(false)} aria-label="Đóng">
              <X size={16} />
            </button>
          </div>
          <p className="model-dropdown-hint">
            Câu hỏi thường → model này. Yêu cầu làm việc → tự chuyển Super Agent + tools n8n.
          </p>
          {CHAT_MODEL_GROUPS.map((group) => (
            <div key={group.brand} className="model-dropdown-group">
              <div className="model-dropdown-brand">{group.brand}</div>
              {group.models.map((m) => {
                const ok = isModelAvailable(m, configured)
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={modelId === m.id}
                    className={`model-dropdown-item${modelId === m.id ? ' active' : ''}${!ok ? ' disabled' : ''}`}
                    onClick={() => pickModel(m.id)}
                    disabled={!ok}
                  >
                    <span className="model-dropdown-name">
                      {m.label}
                      {m.tier && <span className="model-tier">{m.tier}</span>}
                    </span>
                    {m.desc && <span className="model-dropdown-desc">{m.desc}</span>}
                    {!ok && <span className="model-dropdown-desc">Chưa cấu hình API key</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </>,
      document.body,
    )

  return (
    <main className="chat-v2 chat-v2-cursor">
      <header className="chat-v2-header">
        <div className="chat-v2-header-left">
          <div className="chat-v2-avatar-main agent">
            <Sparkles size={20} />
          </div>
          <div>
            <h1>{session?.title || 'Nô Tì'}</h1>
            <p className="chat-v2-sub">
              Auto · Chat + Agent
              {agentStatus && (
                <span
                  className={`chat-v2-dot${agentStatus.webhook_ok ? '' : ' warn'}`}
                  title={agentStatus.webhook_ok ? 'Tools n8n sẵn sàng' : `Agent: ${agentStatus.detail}`}
                />
              )}
              {apiOk && !agentStatus && <span className="chat-v2-dot" title="API sẵn sàng" />}
            </p>
          </div>
        </div>
        <div className="chat-v2-header-right">
          <button
            type="button"
            className="chat-v2-cap-btn"
            onClick={() => { setCapTab('connections'); setCapOpen(true) }}
            title="Kết nối tools"
          >
            <Link2 size={14} />
            <span>{agentCaps.settings.enabledConnections.length}</span>
          </button>
          <button
            type="button"
            className="chat-v2-cap-btn"
            onClick={() => { setCapTab('skills'); setCapOpen(true) }}
            title="Kỹ năng Agent"
          >
            <Puzzle size={14} />
            <span>{agentCaps.activeSkill?.name?.split(' ')[0] || 'Skill'}</span>
          </button>
          <span className="chat-v2-pill agent">
            <Sparkles size={12} />
            {selected.label}
          </span>
          <button type="button" className="chat-v2-more" aria-label="Tùy chọn" title="Sắp ra mắt" disabled>
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      <div className="chat-v2-scroll">
        <div className="chat-v2-thread">
          {messages.length === 0 ? (
            <div className="chat-v2-welcome">
              <div className="chat-v2-welcome-icon">
                <Sparkles size={28} strokeWidth={1.5} />
              </div>
              <h2>Xin chào {displayName}</h2>
              <p>
                Một khung chat như Cursor — hỏi bình thường em trả lời ngay; giao việc (n8n, VPS, Facebook, thiết kế UI…)
                em tự chuyển Super Agent và thực hiện.
              </p>
              <div className="chat-v2-suggestions">
                {CURSOR_SUGGESTIONS.map((s) => (
                  <button key={s.text} type="button" className="chat-v2-suggestion" onClick={() => send(s.text)}>
                    <span className="chat-v2-suggestion-icon">{s.icon}</span>
                    <span>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`chat-v2-row chat-v2-row-${m.role}`}>
                <div className={`chat-v2-avatar chat-v2-avatar-${m.role}`}>
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="chat-v2-bubble-wrap">
                  <div className="chat-v2-bubble-meta">
                    <span>
                      {m.role === 'user' ? displayName : m.modelLabel || 'Nô Tì'}
                      {m.role === 'assistant' && m.mode && (
                        <span className={`chat-v2-mode-tag ${m.mode}`}>
                          {m.mode === 'agent' ? '⚡ Agent' : '💬 Chat'}
                        </span>
                      )}
                    </span>
                    {m.time && <span>{m.time}</span>}
                  </div>
                  <div className={`chat-v2-bubble chat-v2-bubble-${m.role}`}>{m.content}</div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="chat-v2-row chat-v2-row-assistant">
              <div className="chat-v2-avatar chat-v2-avatar-assistant">
                <Bot size={16} />
              </div>
              <div className="chat-v2-bubble-wrap">
                <div className="chat-v2-bubble chat-v2-bubble-assistant chat-v2-typing">
                  <Loader2 size={14} className="spin" />
                  {forceAgent ? 'Agent đang thực hiện…' : 'Đang xử lý…'}
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="chat-v2-composer-wrap">
        <div className="chat-v2-composer">
          {attachments.length > 0 && (
            <div className="attachments-row">
              {attachments.map((f) => (
                <div key={f.id} className="attachment-chip">
                  {f.preview ? (
                    <img src={f.preview} alt="" className="attachment-thumb" />
                  ) : (
                    <Paperclip size={14} />
                  )}
                  <span className="attachment-name">{f.name}</span>
                  <button type="button" className="attachment-remove" onClick={() => removeAttachment(f.id)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="chat-v2-composer-inner">
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="image/*,.txt,.md,.json,.csv,.pdf,.doc,.docx"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <textarea
              ref={textareaRef}
              className="chat-v2-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Hỏi bất cứ điều gì, hoặc giao việc cần làm… (Enter gửi)"
              rows={3}
            />
            <div className="chat-v2-composer-toolbar">
              <div className="chat-v2-composer-tools">
                <button
                  type="button"
                  className="chat-v2-btn-icon"
                  title="Tải tệp lên"
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus size={18} />
                </button>
                <button
                  type="button"
                  className={`chat-v2-force-agent${forceAgent ? ' on' : ''}`}
                  title="Luôn dùng Super Agent + tools (bỏ qua auto-routing)"
                  onClick={() => setForceAgent((v) => !v)}
                >
                  <Zap size={15} />
                  <span>Agent</span>
                </button>
                <div className="model-select-wrap chat-v2-model-pick" ref={modelRef}>
                  <button
                    type="button"
                    className="chat-v2-mode-btn chat active"
                    onClick={toggleModelMenu}
                    aria-expanded={modelOpen}
                    aria-haspopup="listbox"
                    title="Chọn model AI (bộ não cho chat thuần)"
                  >
                    <MessageSquare size={15} />
                    <span className="btn-model-label">{selected.label}</span>
                    <ChevronDown size={14} className={`model-chevron${modelOpen ? ' open' : ''}`} />
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="chat-v2-send"
                disabled={loading || (!input.trim() && !attachments.length)}
                onClick={() => send()}
                aria-label="Gửi tin nhắn"
              >
                <Send size={18} />
                <span className="chat-v2-send-label">Gửi</span>
              </button>
            </div>
          </div>
          <p className="chat-v2-hint">
            Auto-routing giống Cursor · Model: {selected.label} · Tools: n8n, VPS, Browser, Search, Studio
          </p>
        </div>
      </div>

      <AgentCapabilitiesPanel
        open={capOpen}
        tab={capTab}
        onTab={setCapTab}
        onClose={() => setCapOpen(false)}
        caps={agentCaps.caps}
        settings={agentCaps.settings}
        isConnectionOn={agentCaps.isConnectionOn}
        isSkillOn={agentCaps.isSkillOn}
        onToggleConnection={agentCaps.flipConnection}
        onToggleSkill={agentCaps.flipSkill}
        onPickSkill={agentCaps.pickSkill}
      />
      {modelMenu}
    </main>
  )
}
