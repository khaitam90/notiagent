const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

function mediaUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

export type HeyGenCapabilities = {
  ok: boolean
  fal_heygen_avatar: boolean
  novita_heygen_translate: boolean
  heygen_direct: boolean
  novita_translate_price_hint?: string
  languages: { id: string; label: string }[]
}

export type HeyGenJob = {
  job_id: string
  status: 'processing' | 'success' | 'failed'
  progress: number
  message?: string
  error?: string
  output_url?: string
}

export async function fetchHeyGenCapabilities(): Promise<HeyGenCapabilities> {
  const r = await fetch(`${API_BASE}/api/studio/heygen/capabilities`)
  if (!r.ok) throw new Error(await r.text())
  return (await r.json()) as HeyGenCapabilities
}

export async function translateVideoLipsync(
  videoUrl: string,
  outputLanguage = 'vi',
): Promise<HeyGenJob> {
  const r = await fetch(`${API_BASE}/api/studio/heygen/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl, output_language: outputLanguage }),
  })
  if (!r.ok) throw new Error(await r.text())
  return (await r.json()) as HeyGenJob
}

export async function getHeyGenJob(jobId: string): Promise<HeyGenJob> {
  const r = await fetch(`${API_BASE}/api/studio/heygen/jobs/${jobId}`)
  if (!r.ok) throw new Error(await r.text())
  const data = (await r.json()) as HeyGenJob
  if (data.output_url) data.output_url = mediaUrl(data.output_url)
  return data
}

export async function pollHeyGenJob(
  jobId: string,
  onProgress?: (job: HeyGenJob) => void,
  intervalMs = 5000,
  maxWaitMs = 40 * 60 * 1000,
): Promise<HeyGenJob> {
  const start = Date.now()
  for (;;) {
    const job = await getHeyGenJob(jobId)
    onProgress?.(job)
    if (job.status === 'success' || job.status === 'failed') return job
    if (Date.now() - start > maxWaitMs) throw new Error('Hết thời gian chờ nhép miệng')
    await new Promise((res) => setTimeout(res, intervalMs))
  }
}
