import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowUp, BookOpen, ChevronDown, Clapperboard, Film, Layers, Loader2,
  Plus, Sparkles, Upload, Wand2,
} from 'lucide-react'
import {
  chatDirect, createImage, createVideo, pollVideoTask, uploadMedia, type Message,
} from '../../lib/api'
import { findVideoModel, type VideoModelId } from '../../lib/videoModels'
import { setStudioHandoff } from '../../lib/studioHandoff'
import SocialPublishBar from '../SocialPublishBar'
import {
  PRO_FLOWS, PRO_GLOBAL_SUGGESTIONS, PRO_MODES,
  buildCharacterImagePrompt, buildDirectorScriptPrompt, buildProSystemPrompt,
  findProFlow, shouldTriggerImage, shouldTriggerVideo,
  type ProFlowId, type ProMode, type ProPhase,
} from '../../lib/studioProFlows'

type PreviewState = {
  type: 'image' | 'video'
  url: string
  label: string
  taskId?: string
}

type Props = {
  onPreviewChange?: (preview: PreviewState | null) => void
}

export default function StudioProWorkspace({ onPreviewChange }: Props) {
  const navigate = useNavigate()
  const [activeFlow, setActiveFlow] = useState<ProFlowId | null>(null)
  const [mode, setMode] = useState<ProMode>('auto')
  const [modeOpen, setModeOpen] = useState(false)
  const [phase, setPhase] = useState<ProPhase>('pick')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [draftScript, setDraftScript] = useState('')
  const [ratio] = useState('9:16')
  const [duration] = useState(5)
  const [modelId] = useState<VideoModelId>('seedance-2.0-fast')
  const [plusOpen, setPlusOpen] = useState(false)
  const [refImageFile, setRefImageFile] = useState<File | null>(null)
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const modeRef = useRef<HTMLDivElement>(null)
  const plusRef = useRef<HTMLDivElement>(null)
  const pollAbortRef = useRef<AbortController | null>(null)

  const model = findVideoModel(modelId)
  const flowMeta = findProFlow(activeFlow)
  const modeMeta = PRO_MODES.find((m) => m.id === mode) ?? PRO_MODES[0]

  useEffect(() => () => { pollAbortRef.current?.abort() }, [])

  useEffect(() => {
    onPreviewChange?.(preview)
  }, [preview, onPreviewChange])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (modeOpen && modeRef.current && !modeRef.current.contains(t)) setModeOpen(false)
      if (plusOpen && plusRef.current && !plusRef.current.contains(t)) setPlusOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [modeOpen, plusOpen])

  const syncTextareaHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  useEffect(() => { syncTextareaHeight() }, [input])

  const appendMsg = useCallback((role: Message['role'], content: string) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setMessages((m) => [...m, { role, content, time }])
  }, [])

  const pickFlow = (id: ProFlowId) => {
    const flow = findProFlow(id)!
    setActiveFlow(id)
    setPhase('chat')
    setDraftScript('')
    setPreview(null)
    setMessages([{ role: 'assistant', content: flow.welcome, time: '' }])
    setInput('')
  }

  const openEditor = useCallback(() => {
    if (preview?.url) {
      setStudioHandoff({ type: preview.type, url: preview.url, name: preview.label })
    }
    navigate('/studio/editor')
  }, [navigate, preview])

  const renderImage = async (prompt: string) => {
    setPhase('rendering')
    setLoading(true)
    try {
      const res = await createImage(buildCharacterImagePrompt(prompt), {
        provider: 'novita',
        width: ratio === '9:16' ? 768 : 1024,
        height: ratio === '9:16' ? 1024 : 768,
      })
      const url = res.url || res.image_url || res.imageUrl
      if (!url) throw new Error('API không trả URL ảnh')
      const pv: PreviewState = { type: 'image', url, label: prompt.slice(0, 40) }
      setPreview(pv)
      setPhase('ready')
      appendMsg('assistant', `✅ **Ảnh nhân vật** đã xong — xem canvas bên trái. Bấm **Mở Timeline Editor** để dùng làm ref hoặc ghép video.`)
    } catch (e) {
      appendMsg('assistant', `⚠️ ${e instanceof Error ? e.message : String(e)}`)
      setPhase('chat')
    } finally {
      setLoading(false)
    }
  }

  const renderVideo = async (prompt: string) => {
    setPhase('rendering')
    setLoading(true)
    try {
      let imageUrl: string | undefined
      if (refImageFile) {
        const up = await uploadMedia(refImageFile, 'image')
        imageUrl = up.url
      } else if (refImageUrl && !refImageUrl.startsWith('blob:')) {
        imageUrl = refImageUrl
      }

      const res = await createVideo({
        prompt,
        provider: model.provider,
        model: model.apiModel,
        aspect_ratio: ratio,
        duration,
        quality: '720p',
        style_preset: 'cinematic',
        image_url: imageUrl,
        tool_id: activeFlow === 'short-film' ? 'short-film' : undefined,
      })

      if (!res.taskId) {
        throw new Error(res.message || 'Không nhận được taskId')
      }

      appendMsg('assistant', `⏳ Đã gửi render **${model.label}** — Task \`${String(res.taskId).slice(0, 12)}…\`\n\nThường 1–3 phút, video hiện trên canvas.`)

      pollAbortRef.current?.abort()
      const ac = new AbortController()
      pollAbortRef.current = ac

      const st = await pollVideoTask(res.taskId, { signal: ac.signal })
      if (ac.signal.aborted) return

      if (st.state === 'success' && st.videoUrl) {
        const pv: PreviewState = {
          type: 'video',
          url: st.videoUrl,
          label: prompt.slice(0, 40),
          taskId: res.taskId,
        }
        setPreview(pv)
        setPhase('ready')
        appendMsg('assistant', '✅ **Video** đã xong! Xem preview canvas → **Mở Timeline Editor** để cắt ghép sâu hoặc đăng MXH.')
      } else {
        appendMsg('assistant', `⚠️ Render thất bại: ${st.failMsg || st.state}`)
        setPhase('script-ready')
      }
    } catch (e) {
      appendMsg('assistant', `⚠️ ${e instanceof Error ? e.message : String(e)}`)
      setPhase(draftScript ? 'script-ready' : 'chat')
    } finally {
      setLoading(false)
    }
  }

  const writeScript = async (idea: string) => {
    const hist = buildDirectorScriptPrompt(idea, {
      ratio,
      duration,
      modelLabel: model.label,
    })
    const res = await chatDirect(hist, 'gemini')
    const script = res.content.trim()
    setDraftScript(script)
    setInput(script)
    setPhase('script-ready')
    appendMsg('assistant', `🎬 **Kịch bản đạo diễn** — chỉnh sửa nếu cần, rồi bấm **Render video** hoặc nhắn "render video".\n\n${script}`)
  }

  const chatReply = async (userText: string) => {
    const sys = buildProSystemPrompt(activeFlow, mode, {
      ratio,
      duration,
      modelLabel: model.label,
    })
    const hist = [
      { role: 'system', content: sys },
      ...messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: userText },
    ]
    const res = await chatDirect(hist, 'gemini')
    appendMsg('assistant', res.content.trim())
  }

  const send = async (text?: string) => {
    const raw = (text ?? input).trim()
    if (!raw || loading) return

    appendMsg('user', raw)
    setInput('')
    setLoading(true)

    try {
      if (!activeFlow) {
        await chatReply(raw)
        return
      }

      if (activeFlow === 'character') {
        if (shouldTriggerImage(raw) || phase === 'script-ready') {
          await renderImage(raw.replace(/tạo ảnh|render ảnh/gi, '').trim() || raw)
        } else {
          await chatReply(raw)
          if (raw.length > 40) {
            appendMsg('assistant', '💡 Khi ổn mô tả, bấm chip **Tạo ảnh nhân vật** bên dưới.')
          }
        }
        return
      }

      const isVideoFlow = activeFlow === 'script' || activeFlow === 'short-film'

      if (shouldTriggerVideo(raw) || (phase === 'script-ready' && mode === 'render')) {
        const prompt = draftScript || raw
        await renderVideo(prompt)
        return
      }

      if (isVideoFlow && (mode === 'director' || mode === 'auto') && phase !== 'script-ready') {
        await writeScript(raw)
        return
      }

      if (isVideoFlow && mode === 'render') {
        await renderVideo(raw)
        return
      }

      if (phase === 'script-ready') {
        setDraftScript(raw)
        await chatReply(`Sếp cập nhật kịch bản:\n${raw}\n\nXác nhận OK? Nhắn "render video" để gửi Kie.ai.`)
        return
      }

      await chatReply(raw)
    } catch (e) {
      appendMsg('assistant', `⚠️ ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    setRefImageFile(f)
    setRefImageUrl(URL.createObjectURL(f))
    setPlusOpen(false)
    appendMsg('assistant', `📎 Đã thêm ảnh ref **${f.name}** — dùng khi render video nhân vật.`)
    if (imageRef.current) imageRef.current.value = ''
  }

  const suggestions = () => {
    if (phase === 'ready' && preview) {
      return ['Mở Timeline Editor để chỉnh sâu', 'Tạo biến thể nhân vật khác', 'Viết kịch bản mới']
    }
    if (phase === 'script-ready') {
      return ['Render video', 'Rút gọn kịch bản còn 15 giây', 'Thêm cảnh hook 3 giây đầu']
    }
    if (activeFlow && flowMeta) return flowMeta.suggestions
    return PRO_GLOBAL_SUGGESTIONS
  }

  const placeholder = flowMeta?.placeholder
    ?? 'Nhập ý tưởng, phân cảnh hoặc kịch bản cho phim ngắn hoặc tác phẩm điện ảnh…'

  return (
    <div className="sh-pro-workspace">
      <input ref={fileRef} type="file" accept="video/*,audio/*,image/*" multiple hidden />
      <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => handleImageUpload(e.target.files)} />

      {/* Rail trái — CapCut floating toolbar */}
      <nav className="sh-pro-rail" aria-label="Công cụ nhanh">
        <button type="button" className="sh-pro-rail-btn" title="Upload" onClick={() => fileRef.current?.click()}>
          <Plus size={18} />
        </button>
        <button type="button" className="sh-pro-rail-btn" title="Ảnh ref" onClick={() => imageRef.current?.click()}>
          <Upload size={18} />
        </button>
        <button type="button" className="sh-pro-rail-btn" title="Timeline Editor" onClick={openEditor}>
          <Layers size={18} />
        </button>
        <button type="button" className="sh-pro-rail-btn" title="Hướng dẫn" onClick={() => send('So sánh Chat AI và Timeline Editor — ưu nhược từng cái')}>
          <BookOpen size={18} />
        </button>
      </nav>

      {/* Canvas giữa */}
      <div
        className="sh-pro-canvas"
        onDoubleClick={openEditor}
        role="region"
        aria-label="Khung làm việc Studio Pro"
      >
        {preview ? (
          <div className="sh-pro-preview-wrap">
            {preview.type === 'video' ? (
              <video src={preview.url} controls playsInline className="sh-pro-preview-media" />
            ) : (
              <img src={preview.url} alt={preview.label} className="sh-pro-preview-media" />
            )}
            <div className="sh-pro-preview-actions">
              <button type="button" className="sh-pro-editor-cta" onClick={openEditor}>
                Mở Timeline Editor →
              </button>
            </div>
            {preview.type === 'video' && (
              <SocialPublishBar
                videoUrl={preview.url}
                defaultTitle={preview.label}
                defaultCaption={draftScript.slice(0, 200) || preview.label}
              />
            )}
          </div>
        ) : (
          <div className="sh-pro-entry">
            {PRO_FLOWS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`sh-pro-entry-card${activeFlow === f.id ? ' active' : ''}`}
                onClick={() => pickFlow(f.id)}
              >
                <span className="sh-pro-entry-icon">
                  <f.icon size={22} strokeWidth={1.5} />
                </span>
                <span className="sh-pro-entry-text">
                  {f.title} <strong>{f.titleHighlight}</strong>
                  {activeFlow === f.id && <span className="sh-pro-entry-arrow">→</span>}
                </span>
              </button>
            ))}
            <div className="sh-pro-or">HOẶC</div>
            <p className="sh-pro-dblclick">
              <Sparkles size={14} /> Nhấp đúp khung làm việc — mở <strong>Timeline Editor</strong>
            </p>
          </div>
        )}

        {loading && phase === 'rendering' && (
          <div className="sh-pro-canvas-overlay">
            <Loader2 size={28} className="spin" />
            <span>Đang render AI…</span>
          </div>
        )}
      </div>

      {/* Chat phải — Cuộc trò chuyện */}
      <aside className="sh-pro-chat">
        <header className="sh-pro-chat-head">
          <Wand2 size={16} />
          <span>Cuộc trò chuyện</span>
        </header>

        <div className="sh-pro-messages">
          {messages.length === 0 && (
            <div className="sh-pro-chat-empty">
              <Clapperboard size={32} strokeWidth={1.25} />
              <p>Chọn flow bên trái hoặc chat trực tiếp — AI sẽ lên kế hoạch, viết kịch bản và tạo tài nguyên.</p>
              <small>Giống CapCut: Chat tạo thô → Timeline Editor tinh chỉnh.</small>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`sh-pro-msg sh-pro-msg-${m.role}`}>
              {m.time && (
                <div className="sh-pro-msg-meta">
                  {m.role === 'user' ? 'Sếp' : 'Studio Pro'} · {m.time}
                </div>
              )}
              <div className="sh-pro-msg-body">{m.content}</div>
            </div>
          ))}
          {loading && phase !== 'rendering' && (
            <div className="sh-pro-msg sh-pro-msg-assistant">
              <div className="sh-pro-msg-body sh-pro-loading">
                <Loader2 size={14} className="spin" />
                AI đang suy nghĩ…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="sh-pro-chips">
          {activeFlow === 'character' && phase !== 'rendering' && (
            <button type="button" className="sh-pro-chip primary" onClick={() => send('tạo ảnh nhân vật')}>
              Tạo ảnh nhân vật
            </button>
          )}
          {(activeFlow === 'script' || activeFlow === 'short-film') && phase === 'script-ready' && (
            <button type="button" className="sh-pro-chip primary" onClick={() => send('render video')}>
              Render video
            </button>
          )}
          {suggestions().map((s) => (
            <button key={s} type="button" className="sh-pro-chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>

        {(refImageUrl) && (
          <div className="sh-pro-ref">
            <img src={refImageUrl} alt="Ref" />
            <button type="button" onClick={() => { setRefImageUrl(null); setRefImageFile(null) }}>×</button>
          </div>
        )}

        <div className="sh-pro-composer">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={placeholder}
            rows={2}
          />
          <div className="sh-pro-composer-bar">
            <div className="sh-pro-bar-left" ref={plusRef}>
              <button
                type="button"
                className={`sh-pro-bar-btn${plusOpen ? ' open' : ''}`}
                onClick={() => setPlusOpen((o) => !o)}
                aria-label="Thêm"
              >
                <Plus size={16} />
              </button>
              {plusOpen && (
                <div className="sh-pro-plus-menu">
                  <button type="button" onClick={() => { imageRef.current?.click(); setPlusOpen(false) }}>Ảnh ref</button>
                  <button type="button" onClick={() => { fileRef.current?.click(); setPlusOpen(false) }}>Upload media</button>
                </div>
              )}
              <div className="sh-pro-mode-wrap" ref={modeRef}>
                <button
                  type="button"
                  className={`sh-pro-mode-btn${modeOpen ? ' open' : ''}`}
                  onClick={() => setModeOpen((o) => !o)}
                >
                  <Film size={14} />
                  <span>{modeMeta.label}</span>
                  <ChevronDown size={12} />
                </button>
                {modeOpen && (
                  <div className="sh-pro-mode-menu">
                    {PRO_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`sh-pro-mode-opt${mode === m.id ? ' active' : ''}`}
                        onClick={() => { setMode(m.id); setModeOpen(false) }}
                      >
                        <strong>{m.label}</strong>
                        <small>{m.hint}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="sh-pro-send"
              disabled={loading || !input.trim()}
              onClick={() => send()}
              aria-label="Gửi"
            >
              {loading ? <Loader2 size={16} className="spin" /> : <ArrowUp size={18} />}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
