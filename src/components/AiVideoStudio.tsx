import { useEffect, useRef, useState } from 'react'
import {
  Send, Loader2, ChevronDown, AtSign,
  Plus, Video, Clapperboard, Zap, ArrowUp, Box,
} from 'lucide-react'
import { chatDirect, createVideo, fetchVideoModels, pollVideoTask, uploadMedia, type VideoChatMessage } from '../lib/api'
import {
  DURATION_OPTIONS, QUALITY_OPTIONS,
  findVideoModel, videoModelGroupsForTier, STUDIO_RATIO_PRESETS, type VideoModelId,
} from '../lib/videoModels'
import { DEFAULT_VIDEO_MODEL_BY_TIER, type StudioRenderTier } from '../lib/studioRenderTier'
import StudioRenderTierToggle from './studio/StudioRenderTierToggle'
import { VIDEO_TOOLS, type VideoTool } from '../lib/videoTools'
import {
  addStudioAsset, findStudioAsset, loadStudioAssets, mentionInsertText, removeStudioAsset,
  parseMentionIds, type StudioAsset,
} from '../lib/studioAssetLibrary'
import { StudioPlusMenu, StudioMentionMenu, StudioActiveToolBanner } from './studio/StudioAssetMenus'
import StudioRefSlots from './studio/StudioRefSlots'
import type { RefGalleryItem } from './studio/StudioRefSlots'
import { getVideoToolRefConfig, type StudioVideoProvider } from '../lib/studioRefTypes'
import { validateImageFileDimensions, validateVideoFileDimensions } from '../lib/mediaRefValidation'
import { generateId } from '../lib/uuid'
import { videoCostBreakdown, formatCreditsWithUsd, hasVideoPriceData } from '../lib/costEstimate'

type ScriptFlowMode = 'direct' | 'script'
type DirectorPhase = 'idea' | 'script'
const FALLBACK_STUDIO_PROVIDER: StudioVideoProvider = 'crazyrouter'

function normalizeStudioProvider(value: unknown): StudioVideoProvider {
  const provider = String(value || '').trim().toLowerCase()
  if (provider === 'replicate' || provider === 'novita' || provider === 'atlascloud' || provider === 'crazyrouter') return provider
  return FALLBACK_STUDIO_PROVIDER
}

type Props = {
  ratio: string
  duration: number
  onRatioChange: (r: string) => void
  onDurationChange: (d: number) => void
  initialToolId?: string
  /** Hub Studio AI — composer gọn, không chat / không nút Công cụ */
  compact?: boolean
  onGenerated: (res: {
    taskId?: string
    message?: string
    imageUrl?: string
    videoUrl?: string
    status?: string
  }) => void
}

const SCRIPT_FLOW_MODES: { id: ScriptFlowMode; label: string; desc: string; icon: typeof Zap }[] = [
  { id: 'direct', label: 'Prompt trực tiếp', desc: 'Gửi mô tả thẳng vào render video', icon: Zap },
  { id: 'script', label: 'Kịch bản AI', desc: 'AI viết phân cảnh trước khi render', icon: Clapperboard },
]

type RefImageItem = RefGalleryItem & { file?: File | null; assetId?: string }

export default function AiVideoStudio({
  ratio, duration, onRatioChange, onDurationChange, initialToolId, compact = false, onGenerated,
}: Props) {
  const [renderTier, setRenderTier] = useState<StudioRenderTier>('standard')
  const [modelId, setModelId] = useState<VideoModelId>(DEFAULT_VIDEO_MODEL_BY_TIER.standard)
  const [quality, setQuality] = useState<'480p' | '720p' | '1080p'>('720p')
  const [style, setStyle] = useState('cinematic')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [paramMenu, setParamMenu] = useState<'model' | 'ratio' | 'duration' | 'quality' | null>(null)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [scriptFlow, setScriptFlow] = useState<ScriptFlowMode>('direct')
  const [directorPhase, setDirectorPhase] = useState<DirectorPhase>('idea')
  const [activeTool, setActiveTool] = useState<VideoTool | null>(null)
  const [messages, setMessages] = useState<VideoChatMessage[]>(
    compact ? [] : [{
      role: 'assistant',
      content: 'Chọn **Đạo diễn** (model cao cấp) hoặc **Tiêu chuẩn** (model trung bình). Bật **Kịch bản AI** để viết phân cảnh trước.',
      time: '',
    }],
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const plusRef = useRef<HTMLDivElement>(null)
  const mentionRef = useRef<HTMLDivElement>(null)
  const composerBoxRef = useRef<HTMLDivElement>(null)
  const paramRef = useRef<HTMLDivElement>(null)
  const assistantRef = useRef<HTMLDivElement>(null)
  const [refImages, setRefImages] = useState<RefImageItem[]>([])
  const [activeRefImageId, setActiveRefImageId] = useState<string | null>(null)
  const [refVideo, setRefVideo] = useState<string | null>(null)
  const [refVideoAssetId, setRefVideoAssetId] = useState<string | null>(null)
  const [refError, setRefError] = useState<string | null>(null)
  const [refVideoFile, setRefVideoFile] = useState<File | null>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [renderingTaskId, setRenderingTaskId] = useState<string | null>(null)
  const [assets, setAssets] = useState<StudioAsset[]>(() => loadStudioAssets())
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState<number | null>(null)
  const pollAbortRef = useRef<AbortController | null>(null)
  const [studioProvider, setStudioProvider] = useState<StudioVideoProvider>(FALLBACK_STUDIO_PROVIDER)
  const [pendingRender, setPendingRender] = useState<{ prompt: string } | null>(null)

  const model = findVideoModel(modelId, renderTier)
  const flowMeta = SCRIPT_FLOW_MODES.find((m) => m.id === scriptFlow)!
  const isDirectorScript = scriptFlow === 'script' && directorPhase === 'script'
  const refConfig = getVideoToolRefConfig(activeTool, studioProvider)

  useEffect(() => {
    fetchVideoModels()
      .then((data) => {
        setStudioProvider(normalizeStudioProvider((data as { studio_provider?: string }).studio_provider))
      })
      .catch(() => { /* giữ fal mặc định */ })
  }, [])

  const syncTextareaHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }

  useEffect(() => { syncTextareaHeight() }, [input])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (paramMenu && composerBoxRef.current && !composerBoxRef.current.contains(t)) setParamMenu(null)
      if (assistantOpen && assistantRef.current && !assistantRef.current.contains(t)) setAssistantOpen(false)
      if (plusOpen && plusRef.current && !plusRef.current.contains(t)) setPlusOpen(false)
      if (mentionOpen && mentionRef.current && !mentionRef.current.contains(t)) setMentionOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [paramMenu, assistantOpen, plusOpen, mentionOpen])

  const scrollDown = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const activeRefImage = refImages.find((i) => i.id === activeRefImageId) ?? refImages[0] ?? null
  const refImage = activeRefImage?.url ?? null
  const refImageFile = activeRefImage?.file ?? null

  const appendRefImage = (item: RefImageItem) => {
    setRefImages((prev) => [...prev, item])
    setActiveRefImageId(item.id)
  }

  const uploadOneRefImage = async (f: File) => {
    if (activeTool?.needsVideo || activeTool?.optionalVideo) {
      const dimErr = await validateImageFileDimensions(f)
      if (dimErr) throw new Error(dimErr)
    }
    const id = generateId()
    const blob = URL.createObjectURL(f)
    appendRefImage({ id, url: blob, name: f.name, file: f })
    const uploaded = await uploadMedia(f, 'image')
    URL.revokeObjectURL(blob)
    const asset = addStudioAsset({ kind: 'image', name: f.name, url: uploaded.url, preview: uploaded.url })
    setRefImages((prev) => prev.map((item) => (
      item.id === id ? { ...item, url: uploaded.url, file: null, assetId: asset.id } : item
    )))
  }

  const handleImage = async (files: FileList | null) => {
    if (!files?.length) return
    setRefError(null)
    setUploading(true)
    try {
      for (const f of Array.from(files)) {
        await uploadOneRefImage(f)
      }
      setAssets(loadStudioAssets())
    } catch (e) {
      setRefError(e instanceof Error ? e.message : 'Upload ảnh thất bại — thử lại')
    } finally {
      setUploading(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  const handleVideo = async (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    if (activeTool?.needsVideo || activeTool?.optionalVideo) {
      const dimErr = await validateVideoFileDimensions(f)
      if (dimErr) {
        setRefError(dimErr)
        if (videoRef.current) videoRef.current.value = ''
        return
      }
    }
    setRefError(null)
    const blob = URL.createObjectURL(f)
    setRefVideoFile(f)
    setRefVideo(blob)
    setUploading(true)
    try {
      const uploaded = await uploadMedia(f, 'video')
      URL.revokeObjectURL(blob)
      setRefVideo(uploaded.url)
      setRefVideoFile(null)
      const asset = addStudioAsset({ kind: 'video', name: f.name, url: uploaded.url })
      setRefVideoAssetId(asset.id)
      setAssets(loadStudioAssets())
    } catch (e) {
      setRefError(e instanceof Error ? e.message : 'Upload video thất bại — thử lại')
    } finally {
      setUploading(false)
      if (videoRef.current) videoRef.current.value = ''
    }
  }

  const applyAssetRef = (asset: StudioAsset) => {
    if (!asset.url.startsWith('http')) return
    if (asset.kind === 'image') {
      setRefImages((prev) => {
        const existing = prev.find((i) => i.assetId === asset.id || i.url === asset.url)
        if (existing) {
          setActiveRefImageId(existing.id)
          return prev
        }
        const id = generateId()
        setActiveRefImageId(id)
        return [...prev, { id, url: asset.url, name: asset.name, file: null, assetId: asset.id }]
      })
    } else if (asset.kind === 'video') {
      setRefVideo(asset.url)
      setRefVideoFile(null)
      setRefVideoAssetId(asset.id)
    }
  }

  const removeAsset = (asset: StudioAsset) => {
    removeStudioAsset(asset.id)
    const nextAssets = loadStudioAssets()
    setAssets(nextAssets)
    setRefImages((prev) => {
      const next = prev.filter((i) => i.assetId !== asset.id && i.url !== asset.url)
      if (activeRefImageId && !next.some((i) => i.id === activeRefImageId)) {
        setActiveRefImageId(next[0]?.id ?? null)
      }
      return next
    })
    if (asset.kind === 'video' && (refVideoAssetId === asset.id || refVideo === asset.url)) {
      setRefVideo(null)
      setRefVideoFile(null)
      setRefVideoAssetId(null)
    }
  }

  const handleAddLink = () => {
    const url = window.prompt('Dán URL ảnh hoặc video (https://…)', '')?.trim()
    if (!url) return
    const kind = /\.(mp4|webm|mov)(\?|$)/i.test(url) ? 'video' : 'image'
    const asset = addStudioAsset({
      kind,
      name: decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Link'),
      url,
      preview: kind === 'image' ? url : undefined,
    })
    setAssets(loadStudioAssets())
    applyAssetRef(asset)
  }

  const insertMention = (asset: StudioAsset) => {
    const el = textareaRef.current
    const start = mentionStart ?? input.lastIndexOf('@')
    if (start < 0) return
    const end = el?.selectionStart ?? input.length
    const next = input.slice(0, start) + mentionInsertText(asset) + input.slice(end)
    setInput(next)
    setMentionOpen(false)
    setMentionQuery('')
    setMentionStart(null)
    applyAssetRef(asset)
    syncTextareaHeight()
  }

  const onInputChange = (value: string, cursor: number) => {
    setInput(value)
    const before = value.slice(0, cursor)
    const at = before.lastIndexOf('@')
    if (at >= 0 && (at === 0 || /\s/.test(before[at - 1]))) {
      const query = before.slice(at + 1)
      if (!query.includes('\n') && !/\s/.test(query)) {
        setPlusOpen(false)
        setParamMenu(null)
        setMentionOpen(true)
        setMentionQuery(query)
        setMentionStart(at)
        return
      }
    }
    setMentionOpen(false)
  }

  const openMentionMenu = () => {
    setPlusOpen(false)
    setParamMenu(null)
    setMentionOpen(true)
    setMentionQuery('')
    setMentionStart(input.length)
    setInput((v) => `${v}${v.endsWith(' ') || !v ? '' : ' '}@`)
    textareaRef.current?.focus()
  }

  const clearRefImage = () => {
    setRefImages([])
    setActiveRefImageId(null)
    setRefError(null)
  }

  const removeRefImage = (id: string) => {
    const target = refImages.find((item) => item.id === id)
    if (target?.assetId) {
      removeStudioAsset(target.assetId)
      setAssets(loadStudioAssets())
    } else if (target?.url) {
      const lib = loadStudioAssets().find((a) => a.kind === 'image' && a.url === target.url)
      if (lib) {
        removeStudioAsset(lib.id)
        setAssets(loadStudioAssets())
      }
    }
    setRefImages((prev) => {
      const next = prev.filter((item) => item.id !== id)
      if (activeRefImageId === id) {
        setActiveRefImageId(next[0]?.id ?? null)
      }
      return next
    })
  }

  const clearRefVideo = () => {
    setRefVideo(null)
    setRefVideoFile(null)
    setRefVideoAssetId(null)
    setRefError(null)
  }

  useEffect(() => () => { pollAbortRef.current?.abort() }, [])

  const startPoll = (taskId: string, modelLabel: string) => {
    pollAbortRef.current?.abort()
    const ac = new AbortController()
    pollAbortRef.current = ac
    setRenderingTaskId(taskId)
    onGenerated({ taskId, status: 'pending', message: `Đang render ${modelLabel}… (~3–8 phút)` })

    pollVideoTask(taskId, {
      signal: ac.signal,
      onUpdate: (st) => {
        if (st.state === 'generating' || st.state === 'waiting') {
          onGenerated({ taskId, status: 'pending', message: `Đang render ${modelLabel}… (${st.state})` })
        }
      },
    }).then((st) => {
      if (ac.signal.aborted) return
      setRenderingTaskId(null)
      const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      if (st.state === 'success' && st.videoUrl) {
        const msg = `✅ Video **${modelLabel}** đã xong — hiển thị ở preview bên phải.`
        setMessages((m) => [...m, { role: 'assistant', content: msg, time, taskId }])
        onGenerated({ taskId, videoUrl: st.videoUrl, status: 'ready', message: msg })
      } else if (st.state === 'fail') {
        const msg = `⚠️ Render thất bại: ${st.failMsg || 'unknown'}`
        setMessages((m) => [...m, { role: 'assistant', content: msg, time }])
        onGenerated({ taskId, status: 'error', message: msg })
      } else {
        const msg = '⏱ Hết thời gian chờ — thử tạo lại hoặc refresh trang.'
        setMessages((m) => [...m, { role: 'assistant', content: msg, time }])
        onGenerated({ taskId, status: 'timeout', message: msg })
      }
      scrollDown()
    }).catch((e) => {
      if (e?.name === 'AbortError') return
      setRenderingTaskId(null)
    })
  }

  const applyTool = (tool: VideoTool) => {
    setModelId(tool.modelId)
    onRatioChange(tool.ratio)
    onDurationChange(tool.duration)
    setQuality(tool.quality)
    setStyle(tool.style)
    setInput(tool.prompt)
    setActiveTool(tool)
    setDirectorPhase(tool.id === 'script-ref' ? 'script' : 'idea')
  }

  useEffect(() => {
    if (!initialToolId) return
    const tool = VIDEO_TOOLS.find((t) => t.id === initialToolId)
    if (tool) applyTool(tool)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialToolId])

  const refineDirectorScript = async (idea: string) => {
    const sys = `Bạn là đạo diễn AI video chuyên nghiệp. Biến ý tưởng thành kịch bản phân cảnh chi tiết cho AI text-to-video.
Thông số: tỷ lệ ${ratio}, thời lượng ${duration}s, model ${model.label}, phong cách ${style}.
Format bắt buộc:
🎬 TỔNG QUAN: (1 câu tóm tắt)
📋 PHÂN CẢNH:
Cảnh 1 (0-Xs): mô tả hình ảnh, góc máy, ánh sáng, chuyển động
Cảnh 2 ...
🎨 STYLE: màu sắc, mood, camera movement
Chỉ trả kịch bản tiếng Việt, không giải thích thêm.`
    const res = await chatDirect([
      { role: 'system', content: sys },
      { role: 'user', content: idea },
    ], 'novita')
    return res.content.trim()
  }

  const renderVideo = async (prompt: string, opts?: { mock?: boolean }) => {
    const needsImage = refConfig.image === 'required'
    const needsVideo = refConfig.video === 'required'

    let imageUrl: string | undefined
    if (refImageFile) {
      setUploading(true)
      const uploaded = await uploadMedia(refImageFile, 'image')
      imageUrl = uploaded.url
    } else if (refImage && !refImage.startsWith('blob:')) {
      imageUrl = refImage
    }

    let videoUrl: string | undefined
    if (refVideoFile) {
      setUploading(true)
      const uploaded = await uploadMedia(refVideoFile, 'video')
      videoUrl = uploaded.url
    } else if (refVideo && !refVideo.startsWith('blob:')) {
      videoUrl = refVideo
    }

    if (needsImage && !imageUrl) {
      throw new Error(`Cần ${refConfig.imageLabel || 'ảnh tham chiếu'} — tải ảnh ở ô phía trên`)
    }
    if (needsVideo && !videoUrl) {
      throw new Error(`Cần ${refConfig.videoLabel || 'video tham chiếu'} — tải video ở ô phía trên`)
    }

    for (const id of parseMentionIds(prompt)) {
      const asset = findStudioAsset(id)
      if (asset?.kind === 'image' && !imageUrl && !asset.url.startsWith('blob:')) imageUrl = asset.url
      if (asset?.kind === 'video' && !videoUrl && !asset.url.startsWith('blob:')) videoUrl = asset.url
    }

    const res = await createVideo({
      prompt,
      provider: opts?.mock ? 'mock' : model.provider,
      model: opts?.mock ? 'mock' : model.apiModel,
      aspect_ratio: ratio,
      duration,
      quality,
      style_preset: style,
      image_url: imageUrl,
      video_url: videoUrl,
      tool_id: activeTool?.id,
    })
    const modelLabel = opts?.mock ? `${model.label} (test miễn phí — mock)` : model.label
    const reply = res.taskId
      ? `✅ Đã gửi render **${modelLabel}** — Task \`${String(res.taskId).slice(0, 12)}…\`\n\nĐang chờ render, video sẽ hiện ở preview.`
      : (res.message || 'Đã gửi yêu cầu tạo video.')
    setMessages((m) => [
      ...m,
      { role: 'assistant', content: reply, time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), taskId: res.taskId },
    ])
    if (res.taskId) {
      startPoll(res.taskId, modelLabel)
    } else {
      onGenerated(res)
    }
    setActiveTool(null)
    if (scriptFlow === 'script') setDirectorPhase('idea')
  }

  const generate = async (text?: string) => {
    const prompt = (text ?? input).trim()
    if (!prompt || loading) return

    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

    if (scriptFlow === 'script' && directorPhase === 'idea') {
      setMessages((m) => [...m, { role: 'user', content: prompt, time }])
      setInput('')
      scrollDown()
      setLoading(true)
      try {
        const script = await refineDirectorScript(prompt)
        setInput(script)
        setDirectorPhase('script')
        setMessages((m) => [...m, {
          role: 'assistant',
          content: `🎬 **Kịch bản đạo diễn** — chỉnh sửa nếu cần, Enter lần nữa để render video.\n\n${script}`,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        }])
      } catch (e) {
        setMessages((m) => [...m, {
          role: 'assistant',
          content: `⚠️ ${e instanceof Error ? e.message : String(e)}`,
          time: '',
        }])
        setInput(prompt)
      } finally {
        setLoading(false)
        scrollDown()
      }
      return
    }

    setInput('')
    setMessages((m) => [...m, { role: 'user', content: prompt, time }])
    scrollDown()

    setPendingRender({ prompt })
    const cost = videoCostBreakdown(model.id, duration, quality, ratio)
    const costLine = hasVideoPriceData(model.id)
      ? `• Chi phí ước tính: **${formatCreditsWithUsd(cost.usd)}**\n`
      : `• Chi phí: chưa có bảng giá xác thực cho model này — kiểm tra giá thật trên trang provider trước khi chạy thật.\n`
    setMessages((m) => [...m, {
      role: 'assistant',
      content: `⚠️ **Xác nhận trước khi chạy provider trả phí**\n\n`
        + `• Model: ${model.label}\n• Tỷ lệ: ${ratio} · ${duration} giây · ${quality}\n`
        + costLine
        + `\nSố liệu trên là **ước tính** dựa theo bảng giá công khai — có thể lệch so với hoá đơn thật của provider. `
        + `Dùng "Test miễn phí" bên dưới để kiểm tra luồng UI (nút bấm → API → poll → hiển thị video) bằng dữ liệu mẫu trước, `
        + `hoặc "Chạy thật" để gửi job trả phí ngay.`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }])
    scrollDown()
  }

  const runPending = async (mock: boolean) => {
    if (!pendingRender) return
    const { prompt } = pendingRender
    setPendingRender(null)
    setLoading(true)
    try {
      await renderVideo(prompt, { mock })
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: `⚠️ ${e instanceof Error ? e.message : String(e)}`, time: '' },
      ])
    } finally {
      setLoading(false)
      setUploading(false)
      scrollDown()
    }
  }

  const cancelPending = () => {
    setPendingRender(null)
    setMessages((m) => [...m, { role: 'assistant', content: 'Đã huỷ — chưa gửi request nào tới provider.', time: '' }])
    scrollDown()
  }

  const setScriptFlowMode = (mode: ScriptFlowMode) => {
    setScriptFlow(mode)
    setDirectorPhase('idea')
    setAssistantOpen(false)
  }

  const pickRenderTier = (tier: StudioRenderTier) => {
    setRenderTier(tier)
    const current = findVideoModel(modelId, tier)
    if (current.studioTier !== tier) {
      const nextId = DEFAULT_VIDEO_MODEL_BY_TIER[tier]
      const m = findVideoModel(nextId, tier)
      setModelId(nextId)
      setQuality(m.defaultQuality)
    }
  }

  const loadingLabel = uploading
    ? 'Đang upload media ref...'
    : scriptFlow === 'script' && directorPhase === 'idea'
      ? 'AI đang viết kịch bản phân cảnh...'
      : `Đang gửi render ${model.label}...`

  const placeholder = compact
    ? 'Nhập ý tưởng video/hình ảnh. Dùng @ để nhắc nhân vật hoặc bối cảnh đã tải…'
    : scriptFlow === 'script' && directorPhase === 'idea'
      ? 'Nhập ý tưởng, phân cảnh hoặc kịch bản cho phim ngắn hoặc tác phẩm điện ảnh...'
      : isDirectorScript
        ? 'Chỉnh kịch bản phân cảnh — Enter để render video, Shift+Enter xuống dòng...'
        : `Tạo video bằng ${model.label}. Mô tả từng cảnh — Shift+Enter xuống dòng, Enter gửi...`

  const validDurations = DURATION_OPTIONS.filter((d) => d <= model.maxDuration)
  const ratioPresets = STUDIO_RATIO_PRESETS

  const pickModel = (id: VideoModelId) => {
    const m = findVideoModel(id)
    setModelId(id)
    setQuality(m.defaultQuality)
    if (!m.ratios.includes(ratio)) onRatioChange(m.ratios[0] ?? '9:16')
    setParamMenu(null)
  }

  const renderParamMenu = () => {
    if (!paramMenu) return null
    if (paramMenu === 'model') {
      return (
        <div className="vs-param-dropdown">
          {videoModelGroupsForTier(renderTier).map((g) => (
            <div key={g.brand} className="vs-param-group">
              <div className="vs-param-group-label">{g.brand}</div>
              {g.models.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`vs-param-opt${modelId === m.id ? ' active' : ''}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickModel(m.id)}
                >
                  <span>{m.label}</span>
                  <small>{m.desc}</small>
                </button>
              ))}
            </div>
          ))}
        </div>
      )
    }
    if (paramMenu === 'ratio') {
      return (
        <div className="vs-param-dropdown vs-param-dropdown-sm">
          {ratioPresets.map((p) => {
            const supported = model.ratios.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                disabled={!supported}
                className={`vs-param-opt${ratio === p.id ? ' active' : ''}${!supported ? ' disabled' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { if (supported) { onRatioChange(p.id); setParamMenu(null) } }}
              >
                <span>{p.label}</span>
                <small>{p.hint}{!supported ? ' · model không hỗ trợ' : ''}</small>
              </button>
            )
          })}
        </div>
      )
    }
    if (paramMenu === 'duration') {
      return (
        <div className="vs-param-dropdown vs-param-dropdown-sm">
          {validDurations.map((d) => (
            <button
              key={d}
              type="button"
              className={`vs-param-opt${duration === d ? ' active' : ''}`}
              onClick={() => { onDurationChange(d); setParamMenu(null) }}
            >
              {d} giây
            </button>
          ))}
        </div>
      )
    }
    return (
      <div className="vs-param-dropdown vs-param-dropdown-sm">
        {QUALITY_OPTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className={`vs-param-opt${quality === q ? ' active' : ''}`}
            onClick={() => { setQuality(q); setParamMenu(null) }}
          >
            {q}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className={`vs-studio vs-capcut${compact ? ' vs-compact' : ''}`}>
      {!compact && (
        <div className="vs-chat">
          {messages.map((msg, i) => (
            <div key={i} className={`vs-msg vs-msg-${msg.role}`}>
              {msg.time && <div className="vs-msg-meta">{msg.role === 'user' ? 'Sếp' : 'Studio'} · {msg.time}</div>}
              <div className="vs-msg-body">{msg.content}</div>
            </div>
          ))}
          {loading && (
            <div className="vs-msg vs-msg-assistant">
              <div className="vs-msg-body vs-loading">
                <Loader2 size={14} className="spin" />
                {loadingLabel}
              </div>
            </div>
          )}
          {renderingTaskId && !loading && (
            <div className="vs-msg vs-msg-assistant">
              <div className="vs-msg-body vs-loading">
                <Loader2 size={14} className="spin" /> Đang render… task {renderingTaskId.slice(0, 12)}…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {(refImages.length > 0 || refVideo) && !compact && (
        <div className="vs-ref-row">
          {refImages.map((img) => (
            <div
              key={img.id}
              className={`vs-ref-preview${img.id === activeRefImageId ? ' active' : ''}`}
              title={img.name || 'Ảnh ref'}
            >
              <img src={img.url} alt="Ảnh ref" />
              <button type="button" onClick={() => removeRefImage(img.id)}>×</button>
            </div>
          ))}
          {refVideo && (
            <div className="vs-ref-preview vs-ref-video" title="Video ref chuyển động">
              <video src={refVideo} muted playsInline />
              <button type="button" onClick={clearRefVideo}>×</button>
            </div>
          )}
        </div>
      )}

      {activeTool && compact && (
        <StudioActiveToolBanner
          label={activeTool.label}
          meta={`${activeTool.ratio} · ${activeTool.duration}s · ${activeTool.quality}`}
          onClear={() => { setActiveTool(null); setInput('') }}
        />
      )}

      <div className="vs-composer">
        {pendingRender && (
          <div className="vs-confirm-bar">
            <button type="button" className="vs-confirm-run" onClick={() => runPending(false)}>
              ✅ Chạy thật (tính phí)
            </button>
            <button type="button" className="vs-confirm-mock" onClick={() => runPending(true)}>
              🧪 Test miễn phí trước
            </button>
            <button type="button" onClick={cancelPending}>✖ Huỷ</button>
          </div>
        )}
        {refError && <div className="vs-image-error">{refError}</div>}
        <StudioRefSlots
          image={{
            mode: refConfig.image,
            label: refConfig.imageLabel || 'Ảnh tham chiếu',
            hint: refConfig.imageHint || 'Nhân vật, sản phẩm hoặc bối cảnh',
            preview: refImage,
            gallery: refImages,
            activeGalleryId: activeRefImageId,
            onGallerySelect: setActiveRefImageId,
            onGalleryRemove: removeRefImage,
            onPick: () => imageRef.current?.click(),
            onClear: clearRefImage,
          }}
          video={{
            mode: refConfig.video,
            label: refConfig.videoLabel || 'Video tham chiếu',
            hint: refConfig.videoHint || 'Chuyển động / motion reference',
            preview: refVideo,
            onPick: () => videoRef.current?.click(),
            onClear: clearRefVideo,
          }}
        />
        <div className="vs-composer-box" ref={composerBoxRef}>
          <StudioRenderTierToggle tier={renderTier} onChange={pickRenderTier} compact={compact} />
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setMentionOpen(false)
              if (e.key === 'Enter' && !e.shiftKey && !mentionOpen && !pendingRender) { e.preventDefault(); generate() }
            }}
            placeholder={placeholder}
            rows={compact ? 3 : 5}
          />
          {paramMenu && (
            <div className="vs-param-popover" role="listbox">
              {renderParamMenu()}
            </div>
          )}
          <div className="vs-composer-bar" ref={paramRef}>
            <input ref={imageRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleImage(e.target.files)} />
            <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => handleVideo(e.target.files)} />

            <div className="vs-bar-left">
              <div className="vs-plus-wrap" ref={plusRef}>
                <button
                  type="button"
                  className={`vs-bar-icon-btn${plusOpen ? ' open' : ''}`}
                  title="Thêm media / link"
                  onClick={() => {
                    setMentionOpen(false)
                    setParamMenu(null)
                    setPlusOpen((o) => !o)
                  }}
                >
                  <Plus size={16} />
                </button>
                <StudioPlusMenu
                  open={plusOpen}
                  onClose={() => setPlusOpen(false)}
                  onUploadImage={() => imageRef.current?.click()}
                  onUploadVideo={() => videoRef.current?.click()}
                  onAddLink={handleAddLink}
                  onPickAsset={applyAssetRef}
                  assets={assets}
                />
              </div>
              <div className="vs-mention-wrap" ref={mentionRef}>
                <button
                  type="button"
                  className={`vs-bar-icon-btn${mentionOpen ? ' open' : ''}`}
                  title="Nhắc @ nhân vật / bối cảnh"
                  onClick={openMentionMenu}
                >
                  <AtSign size={16} />
                </button>
                {mentionOpen && (
                  <StudioMentionMenu
                    open={mentionOpen}
                    query={mentionQuery}
                    assets={assets}
                    onPick={insertMention}
                    onUpload={() => { setMentionOpen(false); imageRef.current?.click() }}
                  />
                )}
              </div>
              <button
                type="button"
                className={`vs-bar-icon-btn vs-bar-model-btn${paramMenu === 'model' ? ' open' : ''}`}
                title={`Chọn mô hình — ${model.label}`}
                onClick={() => setParamMenu((m) => (m === 'model' ? null : 'model'))}
              >
                <Box size={16} />
              </button>
              {!compact && <span className="vs-bar-type"><Video size={14} /> Video</span>}
            </div>

            <div className="vs-bar-params">
              <div className="vs-param-wrap">
                <button
                  type="button"
                  className={`vs-param-chip${paramMenu === 'ratio' ? ' open' : ''}`}
                  onClick={() => setParamMenu((m) => (m === 'ratio' ? null : 'ratio'))}
                >
                  {ratio}
                  <ChevronDown size={12} />
                </button>
              </div>
              <div className="vs-param-wrap">
                <button
                  type="button"
                  className={`vs-param-chip${paramMenu === 'duration' ? ' open' : ''}`}
                  onClick={() => setParamMenu((m) => (m === 'duration' ? null : 'duration'))}
                >
                  {duration} giây
                  <ChevronDown size={12} />
                </button>
              </div>
              <div className="vs-param-wrap">
                <button
                  type="button"
                  className={`vs-param-chip${paramMenu === 'quality' ? ' open' : ''}`}
                  onClick={() => setParamMenu((m) => (m === 'quality' ? null : 'quality'))}
                >
                  {quality}
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>

            <div className="vs-bar-right">
              <div className="vs-assistant-wrap" ref={assistantRef}>
                <button
                  type="button"
                  className={`vs-bar-assistant${assistantOpen ? ' open' : ''}${scriptFlow === 'script' ? ' director' : ''}`}
                  onClick={() => setAssistantOpen((o) => !o)}
                  title="Luồng prompt"
                >
                  <flowMeta.icon size={14} />
                  <span>{flowMeta.label}</span>
                  <ChevronDown size={12} />
                </button>
                {assistantOpen && (
                  <div className="vs-assistant-panel">
                    <div className="vs-assistant-panel-head">Luồng tạo video</div>
                    {SCRIPT_FLOW_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`vs-assistant-opt${scriptFlow === m.id ? ' active' : ''}`}
                        onClick={() => setScriptFlowMode(m.id)}
                      >
                        <m.icon size={16} />
                        <span>
                          <strong>{m.label}</strong>
                          <small>{m.desc}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`vs-bar-send${isDirectorScript ? ' render' : ''}`}
                disabled={loading || !input.trim() || !!pendingRender}
                onClick={() => generate()}
                title={isDirectorScript ? 'Render video' : scriptFlow === 'script' ? 'Viết kịch bản' : 'Gửi render'}
              >
                {loading ? <Loader2 size={16} className="spin" /> : compact ? <ArrowUp size={18} /> : <Send size={16} />}
              </button>
            </div>
          </div>
        </div>

        {compact && (loading || renderingTaskId) && (
          <div className="vs-compact-status">
            <Loader2 size={14} className="spin" />
            {loading ? loadingLabel : `Đang render… ${renderingTaskId?.slice(0, 12)}…`}
          </div>
        )}
      </div>
    </div>
  )
}
