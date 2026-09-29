import type { STDraft } from './stdraft'

const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

export type AsrResult = {
  ok: boolean
  text: string
  provider: string
  stub: boolean
  confidence: number
  audio_url: string
}

export type RenderJob = {
  job_id: string
  status: 'queued' | 'processing' | 'success' | 'failed' | string
  progress: number
  message: string
  output_url?: string
  output_size?: number
  error?: string
}

export function studioMediaUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

export async function studioAsr(audioUrl: string): Promise<AsrResult> {
  const r = await fetch(`${API_BASE}/api/studio/asr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_url: audioUrl }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function submitCloudRender(draft: STDraft, projectName = ''): Promise<RenderJob> {
  const r = await fetch(`${API_BASE}/api/studio/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft, project_name: projectName }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function fetchRenderJob(jobId: string): Promise<RenderJob> {
  const r = await fetch(`${API_BASE}/api/studio/render/${encodeURIComponent(jobId)}`)
  if (!r.ok) throw new Error(await r.text())
  const job = (await r.json()) as RenderJob
  if (job.output_url) {
    return { ...job, output_url: studioMediaUrl(job.output_url) }
  }
  return job
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function pollRenderJob(
  jobId: string,
  opts?: { intervalMs?: number; maxAttempts?: number; onUpdate?: (j: RenderJob) => void },
): Promise<RenderJob> {
  const intervalMs = opts?.intervalMs ?? 2000
  const maxAttempts = opts?.maxAttempts ?? 120
  for (let i = 0; i < maxAttempts; i++) {
    const job = await fetchRenderJob(jobId)
    opts?.onUpdate?.(job)
    if (job.status === 'success' || job.status === 'failed') return job
    if (i < maxAttempts - 1) await sleep(intervalMs)
  }
  return { job_id: jobId, status: 'timeout', progress: 0, message: 'Hết thời gian chờ render' }
}

export type { TtsCatalog, TtsProviderOption, TtsResult, TtsVoiceOption } from './studioTts'
export { fetchTtsCatalog, studioTts } from './studioTts'
