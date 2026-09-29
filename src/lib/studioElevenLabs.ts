const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

function mediaUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

export type ElevenLabsLang = { id: string; label: string }

export type ElevenLabsCapabilities = {
  ok: boolean
  elevenlabs_direct: boolean
  fal_tts: boolean
  dubbing: boolean
  voice_clone: boolean
  replicate_lipsync?: boolean
  dubbing_v2_note?: string
  languages: ElevenLabsLang[]
}

export type DubbingJob = {
  job_id: string
  status: 'processing' | 'success' | 'failed'
  progress: number
  message?: string
  error?: string
  output_url?: string
  duration_sec?: number
  media_type?: string
  eleven_status?: string
}

export type VoiceCloneResult = {
  ok: boolean
  voice_id: string
  name: string
  requires_verification?: boolean
}

let capsCache: ElevenLabsCapabilities | null = null

export async function fetchElevenLabsCapabilities(refresh = false): Promise<ElevenLabsCapabilities> {
  if (capsCache && !refresh) return capsCache
  const r = await fetch(`${API_BASE}/api/studio/elevenlabs/capabilities`)
  if (!r.ok) throw new Error(await r.text())
  capsCache = (await r.json()) as ElevenLabsCapabilities
  return capsCache
}

export async function createDubbingJob(
  file: File,
  opts: {
    targetLang?: string
    sourceLang?: string
    name?: string
    audioFile?: File | null
    audioUrl?: string
    provider?: string
  } = {},
): Promise<DubbingJob> {
  const fd = new FormData()
  fd.append('file', file, file.name)
  fd.append('target_lang', opts.targetLang ?? 'vi')
  fd.append('source_lang', opts.sourceLang ?? 'auto')
  if (opts.name) fd.append('name', opts.name)
  if (opts.audioFile) fd.append('audio_file', opts.audioFile, opts.audioFile.name)
  if (opts.audioUrl) fd.append('audio_url', opts.audioUrl)
  if (opts.provider) fd.append('provider', opts.provider)
  const r = await fetch(`${API_BASE}/api/studio/elevenlabs/dubbing`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  return (await r.json()) as DubbingJob
}

export async function getDubbingJob(jobId: string): Promise<DubbingJob> {
  const r = await fetch(`${API_BASE}/api/studio/elevenlabs/dubbing/${jobId}`)
  if (!r.ok) throw new Error(await r.text())
  const data = (await r.json()) as DubbingJob
  if (data.output_url) data.output_url = mediaUrl(data.output_url)
  return data
}

export async function pollDubbingJob(
  jobId: string,
  onProgress?: (job: DubbingJob) => void,
  intervalMs = 4000,
  maxWaitMs = 30 * 60 * 1000,
): Promise<DubbingJob> {
  const start = Date.now()
  for (;;) {
    const job = await getDubbingJob(jobId)
    onProgress?.(job)
    if (job.status === 'success' || job.status === 'failed') return job
    if (Date.now() - start > maxWaitMs) {
      throw new Error('Hết thời gian chờ dubbing')
    }
    await new Promise((res) => setTimeout(res, intervalMs))
  }
}

export async function cloneVoice(
  name: string,
  files: File[],
  description = '',
): Promise<VoiceCloneResult> {
  const fd = new FormData()
  fd.append('name', name)
  fd.append('description', description)
  for (const f of files) fd.append('files', f, f.name)
  const r = await fetch(`${API_BASE}/api/studio/elevenlabs/voice-clone`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await r.text())
  const data = (await r.json()) as VoiceCloneResult
  capsCache = null
  return data
}

export async function refreshElevenLabsVoices(): Promise<{ ok: boolean; voices: { id: string; label: string }[] }> {
  const r = await fetch(`${API_BASE}/api/studio/elevenlabs/voices`)
  if (!r.ok) throw new Error(await r.text())
  return (await r.json()) as { ok: boolean; voices: { id: string; label: string }[] }
}
