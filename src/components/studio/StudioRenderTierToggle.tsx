import { Clapperboard, Zap } from 'lucide-react'
import { STUDIO_RENDER_TIER_OPTIONS, type StudioRenderTier } from '../../lib/studioRenderTier'

type Props = {
  tier: StudioRenderTier
  onChange: (tier: StudioRenderTier) => void
  compact?: boolean
}

export default function StudioRenderTierToggle({ tier, onChange, compact }: Props) {
  return (
    <div className={`vs-render-tier${compact ? ' compact' : ''}`} role="group" aria-label="Chế độ render">
      {STUDIO_RENDER_TIER_OPTIONS.map((opt) => {
        const Icon = opt.id === 'director' ? Clapperboard : Zap
        return (
          <button
            key={opt.id}
            type="button"
            className={`vs-render-tier-btn${tier === opt.id ? ' active' : ''}${opt.id === 'director' ? ' director' : ''}`}
            title={opt.desc}
            onClick={() => onChange(opt.id)}
          >
            <Icon size={compact ? 13 : 14} />
            <span className="vs-render-tier-label">{opt.label}</span>
            {!compact && <small>{opt.id === 'director' ? 'Model cao cấp' : 'Model trung bình'}</small>}
          </button>
        )
      })}
    </div>
  )
}
