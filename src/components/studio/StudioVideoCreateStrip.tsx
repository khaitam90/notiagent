import { Film, ImageIcon, PlaySquare, UserRound } from 'lucide-react'
import { VIDEO_CREATE_TOOLS, type VideoCreateToolId } from '../../lib/videoCreateTools'

type Props = {
  activeToolId?: string
  onPick: (toolId: string) => void
}

const ICONS = {
  text2video: PlaySquare,
  image2video: Film,
  'image-ref': ImageIcon,
  motion: UserRound,
} as const

export default function StudioVideoCreateStrip({ activeToolId, onPick }: Props) {
  return (
    <div className="svcs-wrap">
      <div className="svcs-title">Tạo video</div>
      <div className="svcs-row">
        {VIDEO_CREATE_TOOLS.map((tool) => {
          const Icon = ICONS[tool.id as VideoCreateToolId]
          const active = activeToolId === tool.toolId
          return (
            <button
              key={tool.id}
              type="button"
              className={`svcs-item${active ? ' active' : ''}`}
              onClick={() => onPick(tool.toolId)}
              title={tool.label}
            >
              {tool.badge && (
                <span className={`svcs-badge svcs-badge-${tool.badge.toLowerCase()}`}>
                  {tool.badge}
                </span>
              )}
              <span className="svcs-icon">
                <Icon size={22} strokeWidth={1.35} />
              </span>
              <span className="svcs-label">{tool.shortLabel}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
