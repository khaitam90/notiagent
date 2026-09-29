import { Link, useLocation } from 'react-router-dom'
import { STUDIO_SECTIONS, type StudioSectionId } from '../../lib/studioSections'
import { useI18n } from '../../lib/i18n'

type Props = {
  active: StudioSectionId
  onChange: (id: StudioSectionId) => void
}

export default function StudioSectionNav({ active, onChange }: Props) {
  const { t } = useI18n()
  const { pathname } = useLocation()

  return (
    <nav className="sh-nav">
      {STUDIO_SECTIONS.map((tab) => {
        const label = t(`studio.section.${tab.id}`)
        const short = t(`studio.section.${tab.id}.short`)
        if (tab.route) {
          const isActive = pathname.startsWith(tab.route)
          return (
            <Link
              key={tab.id}
              to={tab.route}
              className={`sh-nav-tab${isActive ? ' active' : ''}`}
            >
              <span className="sh-nav-long">{label}</span>
              <span className="sh-nav-short">{short}</span>
            </Link>
          )
        }
        return (
          <button
            key={tab.id}
            type="button"
            className={`sh-nav-tab${active === tab.id ? ' active' : ''}`}
            onClick={() => onChange(tab.id)}
          >
            <span className="sh-nav-long">{label}</span>
            <span className="sh-nav-short">{short}</span>
          </button>
        )
      })}
    </nav>
  )
}
