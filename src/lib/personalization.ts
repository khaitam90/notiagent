import { generateId } from './uuid'
const KEY = 'noti-personalization-v2'

export type KnowledgeItem = {
  id: string
  title: string
  description: string
}

export type PersonalizationProfile = {
  name: string
  role: string
  background: string
  interests: string
}

export type Personalization = {
  profile: PersonalizationProfile
  knowledge: KnowledgeItem[]
  tone: 'formal' | 'casual' | 'concise'
}

const DEFAULT_PROFILE: PersonalizationProfile = {
  name: 'MÃ TỔNG',
  role: 'Marketing, sáng tạo nội dung, quảng cáo ads, studio',
  background: 'Mã Tổng, Sếp Mã, Anh Mã',
  interests: 'Công nghệ AI, công nghệ thông tin, bảo mật mạng, lập trình',
}

const DEFAULTS: Personalization = {
  profile: { ...DEFAULT_PROFILE },
  knowledge: [
    { id: '1', title: 'Marketing Strategy', description: 'Chiến lược marketing online' },
    { id: '2', title: 'AI Tools', description: 'Công cụ AI hiện đại' },
  ],
  tone: 'casual',
}

function normalize(partial: Partial<Personalization>): Personalization {
  return {
    profile: {
      name: partial.profile?.name?.trim() || DEFAULTS.profile.name,
      role: partial.profile?.role?.trim() || DEFAULTS.profile.role,
      background: partial.profile?.background?.trim() || DEFAULTS.profile.background,
      interests: partial.profile?.interests?.trim() || DEFAULTS.profile.interests,
    },
    knowledge: Array.isArray(partial.knowledge)
      ? partial.knowledge.map((k) => ({
          id: String(k.id || generateId()),
          title: k.title?.trim() || '',
          description: k.description?.trim() || '',
        })).filter((k) => k.title)
      : [...DEFAULTS.knowledge],
    tone: partial.tone || DEFAULTS.tone,
  }
}

function migrateLegacy(raw: Record<string, unknown>): Personalization {
  return normalize({
    profile: {
      ...DEFAULT_PROFILE,
      name: String(raw.displayName || DEFAULT_PROFILE.name),
    },
    knowledge: DEFAULTS.knowledge,
    tone: (raw.tone as Personalization['tone']) || DEFAULTS.tone,
  })
}

export function loadPersonalization(): Personalization {
  try {
    const rawV2 = localStorage.getItem(KEY)
    if (rawV2) return normalize(JSON.parse(rawV2) as Partial<Personalization>)

    const rawV1 = localStorage.getItem('noti-personalization-v1')
    if (rawV1) return migrateLegacy(JSON.parse(rawV1) as Record<string, unknown>)

    return { ...DEFAULTS, profile: { ...DEFAULTS.profile }, knowledge: [...DEFAULTS.knowledge] }
  } catch {
    return { ...DEFAULTS, profile: { ...DEFAULTS.profile }, knowledge: [...DEFAULTS.knowledge] }
  }
}

export function savePersonalization(data: Personalization) {
  localStorage.setItem(KEY, JSON.stringify(normalize(data)))
  window.dispatchEvent(new Event('noti-personalization-changed'))
}

export function getDisplayName(data = loadPersonalization()) {
  return data.profile.name.trim() || 'Sếp'
}

export function subscribePersonalization(cb: () => void) {
  const handler = () => cb()
  window.addEventListener('noti-personalization-changed', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('noti-personalization-changed', handler)
    window.removeEventListener('storage', handler)
  }
}

/** Gói hồ sơ + kiến thức cho Super Agent (system context) */
export function buildPersonalizationContext(data = loadPersonalization()): string {
  const { profile, knowledge } = data
  const lines = [
    `Người dùng: ${profile.name}`,
    profile.role && `Nghề nghiệp: ${profile.role}`,
    profile.background && `Background: ${profile.background}`,
    profile.interests && `Quan tâm: ${profile.interests}`,
  ].filter(Boolean)

  if (knowledge.length) {
    lines.push('Kiến thức cá nhân:')
    knowledge.forEach((k) => lines.push(`- ${k.title}: ${k.description}`))
  }
  return lines.join('\n')
}
