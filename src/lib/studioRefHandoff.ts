export type StudioRefHandoff = {
  url: string
  kind: 'image' | 'video'
  name?: string
}

const KEY = 'noti-studio-ref-handoff'

export function setStudioRefHandoff(data: StudioRefHandoff) {
  sessionStorage.setItem(KEY, JSON.stringify(data))
}

export function consumeStudioRefHandoff(): StudioRefHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StudioRefHandoff
    if (!parsed?.url?.startsWith('http')) return null
    return parsed
  } catch {
    return null
  }
}
