const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

function ttsMediaUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) return path
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`
}

export type TtsVoiceOption = { id: string; label: string; hint?: string }
export type TtsProviderOption = {
  id: string
  label: string
  hint?: string
  configured: boolean
  voices: TtsVoiceOption[]
  models?: TtsVoiceOption[]
  language_codes?: TtsVoiceOption[]
  default_model?: string
  default_voice?: string
  default_language_code?: string
}

export type TtsCatalog = { providers: TtsProviderOption[] }

export type TtsResult = {
  ok: boolean
  audio_url: string
  duration_sec: number
  voice: string
  provider: string
  model?: string
  language_code?: string
  stub: boolean
  text_preview: string
}

let catalogCache: TtsCatalog | null = null

export async function fetchTtsCatalog(refresh = false): Promise<TtsCatalog> {
  if (catalogCache && !refresh) return catalogCache
  const r = await fetch(`${API_BASE}/api/studio/tts/voices`)
  if (!r.ok) throw new Error(await r.text())
  catalogCache = (await r.json()) as TtsCatalog
  return catalogCache
}

export async function studioTts(
  text: string,
  opts: {
    voice?: string
    provider?: string
    model?: string
    language_code?: string
  } = {},
): Promise<TtsResult> {
  const r = await fetch(`${API_BASE}/api/studio/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: opts.voice,
      provider: opts.provider ?? 'edge',
      model: opts.model,
      language_code: opts.language_code,
    }),
  })
  if (!r.ok) throw new Error(await r.text())
  const data = (await r.json()) as TtsResult
  return { ...data, audio_url: ttsMediaUrl(data.audio_url) }
}
