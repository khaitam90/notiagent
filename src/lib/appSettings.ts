const KEY = 'noti-app-settings-v1'

export type AppSettings = {
  email: string
  emailNotifications: boolean
  darkMode: boolean
  autoSave: boolean
  language: 'vi' | 'en' | 'zh'
  languageExplicitlySelected?: boolean
  plan: string
  billingCycle: 'monthly' | 'yearly'
  theme: 'dark' | 'light' | 'auto'
}

const DEFAULTS: AppSettings = {
  email: 'matong@example.com',
  emailNotifications: true,
  darkMode: true,
  autoSave: true,
  language: 'vi',
  languageExplicitlySelected: false,
  plan: 'Pro',
  billingCycle: 'monthly',
  theme: 'dark',
}

function normalizeLanguage(value: unknown): AppSettings['language'] {
  return value === 'en' || value === 'zh' || value === 'vi' ? value : DEFAULTS.language
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return {
      email: parsed.email?.trim() || DEFAULTS.email,
      emailNotifications: parsed.emailNotifications ?? DEFAULTS.emailNotifications,
      darkMode: parsed.darkMode ?? DEFAULTS.darkMode,
      autoSave: parsed.autoSave ?? DEFAULTS.autoSave,
      language: parsed.languageExplicitlySelected ? normalizeLanguage(parsed.language) : DEFAULTS.language,
      languageExplicitlySelected: Boolean(parsed.languageExplicitlySelected),
      plan: parsed.plan || DEFAULTS.plan,
      billingCycle: parsed.billingCycle || DEFAULTS.billingCycle,
      theme: parsed.theme || DEFAULTS.theme,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAppSettings(data: AppSettings) {
  localStorage.setItem(KEY, JSON.stringify(data))
  window.dispatchEvent(new Event('noti-app-settings-changed'))
}
