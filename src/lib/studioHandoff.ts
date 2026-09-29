import { buildHandoffStdraft, type STDraft } from './stdraft'

export type StudioHandoff = {
  type: 'video' | 'image'
  url: string
  name?: string
  ratio?: string
  durationSec?: number
  stdraft?: STDraft
}

const HANDOFF_KEY = 'noti-studio-handoff'

export function setStudioHandoff(data: StudioHandoff) {
  const stdraft =
    data.stdraft ??
    buildHandoffStdraft({
      type: data.type,
      url: data.url,
      name: data.name,
      ratio: data.ratio,
      durationSec: data.durationSec,
    })
  sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...data, stdraft }))
}

export function consumeStudioHandoff(): StudioHandoff | null {
  const raw = sessionStorage.getItem(HANDOFF_KEY)
  if (!raw) return null
  sessionStorage.removeItem(HANDOFF_KEY)
  try {
    return JSON.parse(raw) as StudioHandoff
  } catch {
    return null
  }
}
