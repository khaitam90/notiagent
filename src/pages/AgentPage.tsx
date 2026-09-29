import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Paperclip, Plus, Send, Loader2, X } from 'lucide-react'
import { agentChat, chatDirect, fetchProviders, type Message } from '../lib/api'
import { ALL_MODELS, MODEL_GROUPS, findModel, isModelAvailable } from '../lib/models'
import { generateId } from '../lib/uuid'

const SUGGESTIONS = [
  'Tạo video phở Việt Nam cinematic 9:16',
  'Viết kịch bản TikTok 30 giây về du lịch',
  'Tóm tắt tin AI mới nhất hôm nay',
  'Tạo ảnh poster Dòng Máu Việt 4K',
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

export default function AgentPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelId, setModelId] = useState('agent')
  const [modelOpen, setModelOpen] = useState(false)
  const [providers, setProviders] = useState<Record<string, unknown> | null>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const chatId = useRef(`web-${Date.now()}`)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  const selected = findModel(modelId)
  const isChatMode = selected.kind === 'chat'

  const configured = (providers as { chat?: { configured?: Record<string, boolean> } } | null)?.chat?.configured

  useEffect(() => {
    fetchProviders().then(setProviders).catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) {
        setModelOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

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
    const m = findModel(id)
    if (!isModelAvailable(m, configured)) return
    setModelId(id)
    setModelOpen(false)
  }

  const send = async (text?: string) => {
    const raw = (text ?? input).trim()
    if ((!raw && !attachments.length) || loading) return
    const msg = buildMessageWithAttachments(raw, attachments)
    setInput('')
    setAttachments([])
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setMessages((m) => [...m, { role: 'user', content: msg, time }])
    setLoading(true)
    try {
      let reply: string
      if (selected.kind === 'agent') {
        const res = await agentChat(msg, chatId.current)
        reply = res.reply || res.message || res.text || JSON.stringify(res)
      } else {
        const hist = [...messages, { role: 'user', content: msg }].map((x) => ({
          role: x.role,
          content: x.content,
        }))
        const res = await chatDirect(hist, selected.provider!, selected.model)
        reply = res.content
      }
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: reply,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ Lỗi: ${e instanceof Error ? e.message : String(e)}`, time: '' },
      ])
    } finally {
      setLoading(false)
    }
  }

  const p = providers as {
    chat?: { configured?: Record<string, boolean> }
    video?: { configured?: Record<string, boolean> }
  } | null

  return (
    <main className="main">
      <header className="chat-header">
        <h1>🤖 Nô Tì Super Agent</h1>
        <div className="provider-badges">
          <span className={`badge${p?.chat?.configured?.novita ? ' ok' : ''}`}>Novita</span>
          <span className={`badge${p?.chat?.configured?.openrouter ? ' ok' : ''}`}>OpenRouter</span>
          <span className={`badge${p?.chat?.configured?.gemini ? ' ok' : ''}`}>Gemini</span>
          <span className={`badge${p?.video?.configured?.kie ? ' ok' : ''}`}>Video: Kie.ai</span>
        </div>
      </header>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <h2>Xin chào Sếp 👋</h2>
            <p>
              {isChatMode
                ? `Chat trực tiếp với ${selected.label} — chọn model khác bên cạnh nút +`
                : 'Em là Nô Tì — Agent tự chủ. Sếp giao việc, em tự gọi tools.'}
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg ${m.role === 'user' ? 'user' : 'bot'}`}>
              {m.time && (
                <div className="msg-meta">
                  {m.role === 'user' ? 'Sếp' : selected.label} · {m.time}
                </div>
              )}
              {m.content}
            </div>
          ))
        )}
        {loading && (
          <div className="msg bot" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Loader2 size={16} className="spin" />
            Đang xử lý...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="input-area">
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
        <div className="input-box">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept="image/*,.txt,.md,.json,.csv,.pdf,.doc,.docx"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            className="btn-attach"
            title="Tải tệp lên"
            onClick={() => fileRef.current?.click()}
          >
            <Plus size={18} />
          </button>

          {isChatMode && (
            <div className="model-select-wrap" ref={modelRef}>
              <button
                type="button"
                className="btn-model-select"
                onClick={() => setModelOpen((o) => !o)}
                title="Chọn model"
              >
                <span className="btn-model-label">{selected.label}</span>
                <ChevronDown size={14} className={`model-chevron${modelOpen ? ' open' : ''}`} />
              </button>
              {modelOpen && (
                <div className="model-dropdown">
                  {MODEL_GROUPS.map((group) => (
                    <div key={group.brand} className="model-dropdown-group">
                      <div className="model-dropdown-brand">{group.brand}</div>
                      {group.models.map((m) => {
                        const ok = isModelAvailable(m, configured)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`model-dropdown-item${modelId === m.id ? ' active' : ''}${!ok ? ' disabled' : ''}`}
                            onClick={() => pickModel(m.id)}
                            disabled={!ok}
                          >
                            <span className="model-dropdown-name">{m.label}</span>
                            {m.desc && <span className="model-dropdown-desc">{m.desc}</span>}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isChatMode && (
            <div className="model-select-wrap" ref={modelRef}>
              <button
                type="button"
                className="btn-model-select agent-mode"
                onClick={() => setModelOpen((o) => !o)}
                title="Chọn model hoặc Super Agent"
              >
                <span className="btn-model-label">Super Agent</span>
                <ChevronDown size={14} className={`model-chevron${modelOpen ? ' open' : ''}`} />
              </button>
              {modelOpen && (
                <div className="model-dropdown">
                  {MODEL_GROUPS.map((group) => (
                    <div key={group.brand} className="model-dropdown-group">
                      <div className="model-dropdown-brand">{group.brand}</div>
                      {group.models.map((m) => {
                        const ok = isModelAvailable(m, configured)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`model-dropdown-item${modelId === m.id ? ' active' : ''}${!ok ? ' disabled' : ''}`}
                            onClick={() => pickModel(m.id)}
                            disabled={!ok}
                          >
                            <span className="model-dropdown-name">{m.label}</span>
                            {m.desc && <span className="model-dropdown-desc">{m.desc}</span>}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={
              isChatMode
                ? `Chat với ${selected.label}... (Enter gửi)`
                : 'Giao việc cho Nô Tì... (Enter gửi, Shift+Enter xuống dòng)'
            }
            rows={2}
          />
          <button
            type="button"
            className="btn-send"
            disabled={loading || (!input.trim() && !attachments.length)}
            onClick={() => send()}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </main>
  )
}
