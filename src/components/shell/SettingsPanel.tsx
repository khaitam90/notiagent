import { useEffect, useState } from 'react'
import { Bell, ChevronRight, CreditCard, Lock, Palette, X } from 'lucide-react'
import { loadAppSettings, saveAppSettings, type AppSettings } from '../../lib/appSettings'
import { fetchProviders, fetchVideoModels } from '../../lib/api'
import { clearAllChatSessions } from '../../lib/chatSessions'
import { loadPersonalization, savePersonalization } from '../../lib/personalization'
import { useI18n } from '../../lib/i18n'

type Props = {
  isOpen: boolean
  onClose: () => void
}

type Section = 'account' | 'general' | 'billing' | 'personalization'

const SECTIONS: { id: Section; label: string; icon: typeof Lock }[] = [
  { id: 'account', label: 'settings.section.account', icon: Lock },
  { id: 'general', label: 'settings.section.general', icon: Bell },
  { id: 'billing', label: 'settings.section.billing', icon: CreditCard },
  { id: 'personalization', label: 'settings.section.personalization', icon: Palette },
]

const PROVIDER_LABELS: Record<string, string> = {
  novita: 'Novita / OpenRouter',
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  perplexity: 'Perplexity',
  replicate: 'Replicate',
}

export function SettingsPanel({ isOpen, onClose }: Props) {
  const { t } = useI18n()
  const [activeSection, setActiveSection] = useState<Section>('account')
  const [settings, setSettings] = useState<AppSettings>(loadAppSettings)
  const [profileName, setProfileName] = useState('')
  const [profileRole, setProfileRole] = useState('')
  const [configured, setConfigured] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!isOpen) return
    setSettings(loadAppSettings())
    const p = loadPersonalization()
    setProfileName(p.profile.name)
    setProfileRole(p.profile.role)
    setActiveSection('account')
    Promise.allSettled([fetchProviders(), fetchVideoModels()])
      .then(([providersResult, videoModelsResult]) => {
        const cfg = providersResult.status === 'fulfilled'
          ? ((providersResult.value as { chat?: { configured?: Record<string, boolean> } })?.chat?.configured ?? {})
          : {}
        const next = { ...cfg }
        if (videoModelsResult.status === 'fulfilled') {
          const provider = String((videoModelsResult.value as { studio_provider?: string })?.studio_provider || '')
          if (provider === 'replicate' || provider === 'novita') next[provider] = true
          else next.novita = true
        }
        setConfigured(next)
      })
      .catch(() => setConfigured({}))
  }, [isOpen])

  const saveAll = () => {
    saveAppSettings(settings)
    const pers = loadPersonalization()
    savePersonalization({
      ...pers,
      profile: { ...pers.profile, name: profileName, role: profileRole },
    })
    onClose()
  }

  const onClearHistory = () => {
    if (!window.confirm(t('settings.clearHistoryConfirm'))) return
    clearAllChatSessions()
    window.location.reload()
  }

  if (!isOpen) return null

  return (
    <div className="settings-root" role="dialog" aria-modal="true" aria-label={t('settings.title')}>
      <button type="button" className="settings-backdrop" aria-label={t('settings.close')} onClick={onClose} />
      <div className="settings-shell">
        <aside className="settings-nav">
          <div className="settings-nav-inner">
            <h2>{t('settings.title')}</h2>
            <nav>
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`settings-nav-item${activeSection === id ? ' active' : ''}`}
                  onClick={() => setActiveSection(id)}
                >
                  <span className="settings-nav-item-main">
                    <Icon size={18} />
                    {t(label)}
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="settings-main">
          <button type="button" className="settings-main-close" onClick={onClose} aria-label={t('settings.close')}>
            <X size={20} />
          </button>

          <div className="settings-content">
            {activeSection === 'account' && (
              <section className="settings-section">
                <h3>{t('settings.section.account')}</h3>
                <label className="settings-field">
                  <span>{t('settings.email')}</span>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings((s) => ({ ...s, email: e.target.value }))}
                  />
                </label>
                <label className="settings-field">
                  <span>{t('settings.password')}</span>
                  <button type="button" className="settings-btn-secondary" disabled title="Sắp ra mắt">
                    {t('settings.changePassword')}
                  </button>
                </label>
                <div className="settings-danger-zone">
                  <button type="button" className="settings-btn-danger" disabled title="Liên hệ admin VPS">
                    {t('settings.deleteAccount')}
                  </button>
                </div>
              </section>
            )}

            {activeSection === 'general' && (
              <section className="settings-section">
                <h3>{t('settings.generalTitle')}</h3>

                <label className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.emailNotifications')}</strong>
                    <span>{t('settings.emailNotificationsHint')}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emailNotifications}
                    onChange={(e) => setSettings((s) => ({ ...s, emailNotifications: e.target.checked }))}
                  />
                </label>

                <label className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.darkMode')}</strong>
                    <span>{t('settings.darkModeHint')}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.darkMode}
                    onChange={(e) => setSettings((s) => ({ ...s, darkMode: e.target.checked }))}
                  />
                </label>

                <label className="settings-toggle-row">
                  <div>
                    <strong>{t('settings.autoSave')}</strong>
                    <span>{t('settings.autoSaveHint')}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoSave}
                    onChange={(e) => setSettings((s) => ({ ...s, autoSave: e.target.checked }))}
                  />
                </label>

                <label className="settings-field">
                  <span>{t('settings.language')}</span>
                  <select
                    value={settings.language}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        language: e.target.value as AppSettings['language'],
                        languageExplicitlySelected: true,
                      }))
                    }
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                  </select>
                </label>

                <div className="settings-subsection">
                  <h4>{t('settings.apiStatus')}</h4>
                  <p className="settings-hint">{t('settings.apiStatusHint')}</p>
                  {Object.keys(PROVIDER_LABELS).map((key) => (
                    <div key={key} className={`settings-api-row${configured[key] ? ' on' : ''}`}>
                      <span>{PROVIDER_LABELS[key]}</span>
                      <em>{configured[key] ? t('settings.configured') : t('settings.notConfigured')}</em>
                    </div>
                  ))}
                </div>

                <button type="button" className="settings-btn-outline-danger" onClick={onClearHistory}>
                  {t('settings.clearHistory')}
                </button>
              </section>
            )}

            {activeSection === 'billing' && (
              <section className="settings-section">
                <h3>{t('settings.section.billing')}</h3>
                <div className="settings-plan-card">
                  <h4>{t('settings.currentPlan')}</h4>
                  <dl>
                    <div>
                      <dt>{t('settings.plan')}</dt>
                      <dd>{settings.plan}</dd>
                    </div>
                    <div>
                      <dt>{t('settings.billingCycle')}</dt>
                      <dd>{settings.billingCycle === 'monthly' ? t('settings.monthly') : t('settings.yearly')}</dd>
                    </div>
                    <div>
                      <dt>{t('settings.price')}</dt>
                      <dd>$9.99/tháng</dd>
                    </div>
                  </dl>
                </div>
                <div className="settings-upgrade-hint">{t('settings.upgradeHint')}</div>
                <button type="button" className="settings-btn-primary" disabled title="Sắp ra mắt">
                  {t('settings.upgradePlan')}
                </button>
              </section>
            )}

            {activeSection === 'personalization' && (
              <section className="settings-section">
                <h3>{t('settings.personalizationTitle')}</h3>
                <div className="settings-card">
                  <label className="settings-field">
                    <span>{t('settings.displayName')}</span>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('settings.bio')}</span>
                    <textarea
                      value={profileRole}
                      onChange={(e) => setProfileRole(e.target.value)}
                      rows={4}
                    />
                  </label>
                  <label className="settings-field">
                    <span>{t('settings.theme')}</span>
                    <select
                      value={settings.theme}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, theme: e.target.value as AppSettings['theme'] }))
                      }
                    >
                      <option value="dark">{t('settings.theme.dark')}</option>
                      <option value="light">{t('settings.theme.light')}</option>
                      <option value="auto">{t('settings.theme.auto')}</option>
                    </select>
                  </label>
                </div>
              </section>
            )}

            <footer className="settings-footer">
              <button type="button" className="settings-btn-cancel" onClick={onClose}>
                Đóng
              </button>
              <button type="button" className="settings-btn-primary" onClick={saveAll}>
                Lưu
              </button>
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}
