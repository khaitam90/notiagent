import { registerStudioUpload } from './studioAssetLibrary'

const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

export type Message = {
  role: 'user' | 'assistant'
  content: string
  time?: string
  mode?: 'agent' | 'chat'
  modelLabel?: string
}

export async function unifiedChat(
  message: string,
  chatId: string,
  opts: {
    messages?: { role: string; content: string }[]
    provider?: string
    model?: string
    skill?: string
    connections?: string[]
    enabledSkills?: string[]
    forceAgent?: boolean
    autoModel?: boolean
  },
) {
  const r = await fetch(`${API_BASE}/api/chat/unified`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      chat_id: chatId,
      messages: opts.messages ?? [],
      provider: opts.autoModel ? undefined : opts.provider,
      model: opts.autoModel ? undefined : opts.model,
      skill: opts.skill ?? 'general',
      connections: opts.connections ?? [],
      enabled_skills: opts.enabledSkills ?? [],
      force_agent: opts.forceAgent ?? false,
      auto_model: opts.autoModel ?? false,
    }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json() as Promise<{
    reply: string
    mode: 'agent' | 'chat'
    tools: boolean
    fallback?: boolean
    provider: string
    model: string
    resolved_label?: string
    agent_backend?: string
    auto?: boolean
    auto_reason?: string
  }>
}

export async function fetchProviders() {
  const r = await fetch(`${API_BASE}/api/providers`)
  if (!r.ok) throw new Error('Không tải được providers')
  return r.json()
}

export type ChatModelsCatalogResponse = {
  groups: { brand: string; purpose?: string; models: import('./models').ModelOption[] }[]
  models: import('./models').ModelOption[]
  default_model_id: string
  fetched_at?: number
  sources?: Record<string, boolean>
  errors?: Record<string, string>
}

export async function fetchChatModels(refresh = false): Promise<ChatModelsCatalogResponse> {
  const q = refresh ? '?refresh=true' : ''
  const r = await fetch(`${API_BASE}/api/chat/models${q}`)
  if (!r.ok) throw new Error('Không tải được danh sách model')
  return r.json()
}

export async function chatDirect(
  messages: { role: string; content: string }[],
  provider = 'novita',
  model?: string,
) {
  const r = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, provider, model }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function agentChat(
  message: string,
  chatId: string,
  opts?: { skill?: string; connections?: string[]; enabledSkills?: string[] },
) {
  const r = await fetch(`${API_BASE}/api/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      chat_id: chatId,
      skill: opts?.skill ?? 'general',
      connections: opts?.connections ?? [],
      enabled_skills: opts?.enabledSkills ?? [],
    }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export type AgentConnection = {
  id: string
  name: string
  desc: string
  category: string
  configured: boolean
}

export type AgentSkill = {
  id: string
  name: string
  desc: string
  default?: boolean
}

export type AgentCapabilities = {
  connections: AgentConnection[]
  skills: AgentSkill[]
}

export async function fetchAgentCapabilities(): Promise<AgentCapabilities> {
  const r = await fetch(`${API_BASE}/api/agent/capabilities`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export type AgentStatus = {
  webhook_url: string
  webhook_ok: boolean
  detail: string
  connections_configured: number
  connections_total: number
  skills: number
  video_studio: boolean
}

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const r = await fetch(`${API_BASE}/api/agent/status`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export type VideoChatMessage = {
  role: 'user' | 'assistant'
  content: string
  time?: string
  taskId?: string
}

export async function createVideo(body: {
  prompt: string
  provider?: string
  model?: string
  aspect_ratio?: string
  duration?: number
  quality?: string
  style_preset?: string
  image_url?: string
  video_url?: string
  tool_id?: string
  generate_audio?: boolean
}) {
  const r = await fetch(`${API_BASE}/api/video`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export type VideoModelDefaultsResponse = {
  studio_provider?: string
  defaults?: {
    image_generation?: { provider: string; model: string }
    video_budget?: { provider: string; model: string }
    video_quality?: { provider: string; model: string }
    video_fallback?: { provider: string; model: string }
    lipsync?: { provider: string; model: string }
  }
}

export async function fetchVideoModels(): Promise<VideoModelDefaultsResponse> {
  const r = await fetch(`${API_BASE}/api/video/models`)
  if (!r.ok) throw new Error('Không tải được video models')
  return r.json()
}

export async function fetchVideoTaskStatus(taskId: string) {
  const r = await fetch(`${API_BASE}/api/video/status?taskId=${encodeURIComponent(taskId)}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export type VideoTaskStatus = {
  taskId: string
  state: string
  videoUrl?: string
  failMsg?: string
}

export function parseVideoTaskResponse(data: unknown): VideoTaskStatus {
  const root = data as { data?: Record<string, unknown> }
  const d = root.data ?? {}
  const taskId = String(d.taskId ?? '')
  const state = String(d.state ?? '')
  let videoUrl = ''
  const resultJson = d.resultJson
  if (resultJson) {
    try {
      const result = JSON.parse(String(resultJson)) as { resultUrls?: string[]; videoUrl?: string }
      videoUrl = result.resultUrls?.[0] ?? result.videoUrl ?? ''
    } catch { /* ignore */ }
  }
  return {
    taskId,
    state,
    videoUrl: videoUrl || undefined,
    failMsg: d.failMsg ? String(d.failMsg) : undefined,
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Poll Kie task until success/fail hoặc hết số lần thử. */
export async function pollVideoTask(
  taskId: string,
  opts?: { intervalMs?: number; maxAttempts?: number; onUpdate?: (s: VideoTaskStatus) => void; signal?: AbortSignal },
): Promise<VideoTaskStatus> {
  const intervalMs = opts?.intervalMs ?? 15000
  const maxAttempts = opts?.maxAttempts ?? 40
  for (let i = 0; i < maxAttempts; i++) {
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const raw = await fetchVideoTaskStatus(taskId)
    const status = parseVideoTaskResponse(raw)
    opts?.onUpdate?.(status)
    if (status.state === 'success' && status.videoUrl) return status
    if (status.state === 'fail') return status
    if (i < maxAttempts - 1) await sleep(intervalMs)
  }
  return { taskId, state: 'timeout' }
}

export async function uploadMedia(file: File, kind: 'image' | 'video' = 'image') {
  const form = new FormData()
  form.append('file', file)
  form.append('kind', kind)
  const r = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(await r.text())
  return r.json() as Promise<{ url: string; kind: string; fileName: string }>
}

export type MediaLibraryItem = {
  url: string
  fileName: string
  kind: 'image' | 'video'
  mtime?: number
  workflowName?: string
  createdAt?: string
}

export async function fetchMediaLibrary(): Promise<{ uploads: MediaLibraryItem[]; generated: MediaLibraryItem[] }> {
  const r = await fetch(`${API_BASE}/api/media/library`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function createImage(
  prompt: string,
	  opts?: {
	    provider?: string
	    model?: string
	    generation_mode?: 'standard' | 'face_id'
	    width?: number
	    height?: number
	    resolution?: string
	    image_url?: string
	    image_urls?: string[]
	    num_images?: number
	    face_id?: {
	      api_model?: string
	      id_weight?: number
	    }
	  },
) {
  const r = await fetch(`${API_BASE}/api/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
	      prompt,
	      provider: opts?.provider ?? 'novita',
	      model: opts?.model,
	      generation_mode: opts?.generation_mode,
	      width: opts?.width ?? 1024,
	      height: opts?.height ?? 1024,
	      resolution: opts?.resolution,
	      image_url: opts?.image_url,
	      image_urls: opts?.image_urls?.length ? opts.image_urls : undefined,
	      num_images: opts?.num_images ?? 1,
	      face_id: opts?.face_id,
	    }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export type SocialPlatform = 'tiktok' | 'youtube'

export type SocialAccountsConfig = {
  ok: boolean
  configured: { tiktok: boolean; youtube: boolean }
  accounts: { id: string; platform: string; name: string | null; status?: string }[]
}

export async function fetchSocialAccounts(): Promise<SocialAccountsConfig> {
  const r = await fetch(`${API_BASE}/api/social/accounts`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export type SocialUploadResult = {
  ok: boolean
  platform: string
  post_id?: string
  status?: string
  video_url?: string
  message?: string
}

export async function publishSocialVideo(body: {
  video_url: string
  platform: SocialPlatform
  title: string
  caption: string
}): Promise<SocialUploadResult> {
  const r = await fetch(`${API_BASE}/api/social/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data)
    throw new Error(detail || `HTTP ${r.status}`)
  }
  return data
}

/** URL proxy tải media CDN (same-origin) — tránh CORS khi dùng a.download cross-origin */
export function studioMediaDownloadUrl(url: string, filename: string): string {
  const params = new URLSearchParams({ url, filename })
  return `${API_BASE}/api/download?${params.toString()}`
}

export async function downloadStudioMedia(url: string, filename: string, _opts?: { kind?: "image" | "video" }): Promise<void> {
  const safe = filename.replace(/[^\w\s.-]/g, '').slice(0, 48) || 'studio-ai.png'
  const href = studioMediaDownloadUrl(url, safe)
  const a = document.createElement('a')
  a.href = href
  a.download = safe
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Thumbnail video qua backend (ffmpeg frame) — dùng cho preview trong thư viện/feed. */
export function studioThumbnailUrl(url: string, width = 420): string {
  if (!url) return url
  if (url.startsWith('blob:') || url.startsWith('data:')) return url
  const params = new URLSearchParams({ url, w: String(width) })
  return `${API_BASE}/api/thumbnail?${params.toString()}`
}

/** Tên file gợi ý khi tải xuống — dựa trên title, loại (image/video) và phần mở rộng từ URL gốc. */
export function studioDownloadFilename(title: string | undefined, kind: 'image' | 'video', url: string): string {
  const extMatch = url.split('?')[0].match(/\.([a-zA-Z0-9]{2,4})$/)
  const ext = extMatch ? extMatch[1] : (kind === 'video' ? 'mp4' : 'png')
  const base = (title || (kind === 'video' ? 'video-ai' : 'anh-ai'))
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()
    .slice(0, 48) || (kind === 'video' ? 'video-ai' : 'anh-ai')
  return `${base}.${ext}`
}

/** Nhập ảnh/video từ URL công khai (Google Drive, CDN…) rồi đăng ký vào thư viện「Đã tải lên」. */
export async function importMediaUrl(
  url: string,
  opts?: { projectId?: string | null },
): Promise<{ url: string; kind: string; fileName: string }> {
  const r = await fetch(`${API_BASE}/api/import-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data)
    throw new Error(detail || `HTTP ${r.status}`)
  }
  registerStudioUpload({
    kind: data.kind === 'video' ? 'video' : 'image',
    name: data.fileName || 'import',
    url: data.url,
    projectId: opts?.projectId ?? null,
  })
  return data
}
