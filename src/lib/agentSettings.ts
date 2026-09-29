const SETTINGS_KEY = 'noti-agent-settings-v1'

export type AgentSettings = {
  skillId: string
  enabledConnections: string[]
  enabledSkills: string[]
}

const DEFAULTS: AgentSettings = {
  skillId: 'general',
  enabledConnections: [],
  enabledSkills: ['general', 'research', 'writer', 'studio', 'social', 'code', 'analyst'],
}

export function loadAgentSettings(): AgentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AgentSettings>
    return {
      skillId: parsed.skillId || DEFAULTS.skillId,
      enabledConnections: Array.isArray(parsed.enabledConnections) ? parsed.enabledConnections : [],
      enabledSkills: Array.isArray(parsed.enabledSkills) ? parsed.enabledSkills : DEFAULTS.enabledSkills,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAgentSettings(settings: AgentSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  window.dispatchEvent(new Event('noti-agent-settings-changed'))
}

export function subscribeAgentSettings(cb: () => void) {
  const handler = () => cb()
  window.addEventListener('noti-agent-settings-changed', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('noti-agent-settings-changed', handler)
    window.removeEventListener('storage', handler)
  }
}

export function toggleConnection(id: string, on?: boolean) {
  const s = loadAgentSettings()
  const set = new Set(s.enabledConnections)
  const next = on ?? !set.has(id)
  if (next) set.add(id)
  else set.delete(id)
  saveAgentSettings({ ...s, enabledConnections: [...set] })
}

export function toggleSkill(id: string, on?: boolean) {
  const s = loadAgentSettings()
  const set = new Set(s.enabledSkills)
  const next = on ?? !set.has(id)
  if (next) set.add(id)
  else set.delete(id)
  saveAgentSettings({ ...s, enabledSkills: [...set] })
}

export function setActiveSkill(skillId: string) {
  const s = loadAgentSettings()
  saveAgentSettings({ ...s, skillId })
}

/** Bật mặc định các kết nối đã configured lần đầu */
export function ensureDefaultConnections(configuredIds: string[]) {
  const s = loadAgentSettings()
  if (s.enabledConnections.length) return s
  saveAgentSettings({ ...s, enabledConnections: configuredIds })
  return loadAgentSettings()
}
