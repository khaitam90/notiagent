import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bot, Clapperboard, Plus, Sparkles } from 'lucide-react'
import type { FreezeStatus } from './lib/freezeMode'
import { useI18n } from './lib/i18n'

type Props = {
  freeze?: FreezeStatus | null
}

export default function Layout({ freeze }: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const frozen = freeze?.active === true

  const nav = frozen
    ? [{ to: '/studio', icon: Clapperboard, label: 'Studio', end: false as const }]
    : [
      { to: '/', icon: Bot, label: t('layout.agent'), end: true as const },
      { to: '/studio', icon: Clapperboard, label: 'Studio', end: false as const },
    ]

  return (
    <div className={`app-shell${frozen ? ' app-shell-frozen' : ''}`}>
      {frozen && freeze?.message && (
        <div className="freeze-banner" role="status">
          {freeze.message}
        </div>
      )}
      <div className="app-shell-body">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <Sparkles size={20} color="#818cf8" />
            Nô Tì <span>Studio</span>
          </div>
          {!frozen && (
            <button className="btn-new" onClick={() => navigate('/')} type="button">
              <Plus size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
              {t('layout.newTask')}
            </button>
          )}
          <div className="sidebar-section">{t('layout.navigation')}</div>
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </aside>
        <div className="app-main">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
