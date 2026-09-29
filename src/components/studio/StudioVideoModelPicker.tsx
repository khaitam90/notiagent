import { useEffect, useRef } from 'react'
import { ChevronDown, Sparkles, X } from 'lucide-react'
import {
  VIDEO_MODEL_TIER_GROUPS,
  VIDEO_BRAND_ICON,
  findVideoModel,
  modelSummary,
  type VideoModelId,
} from '../../lib/videoModels'

type ListProps = {
  modelId: VideoModelId
  onModelChange: (id: VideoModelId) => void
}

export function StudioVideoModelList({ modelId, onModelChange }: ListProps) {
  return (
    <>
      {VIDEO_MODEL_TIER_GROUPS.map((group) => (
        <div key={group.tier} className="svmp-tier-group">
          <div className={`svmp-tier-label svmp-tier-${group.tier}`}>{group.label}</div>
          <div className="svmp-list">
            {group.models.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`svmp-item${modelId === m.id ? ' active' : ''}`}
                onClick={() => onModelChange(m.id)}
              >
                <span className={`svmp-icon svmp-brand-${m.brand.toLowerCase()}`} aria-hidden>
                  {VIDEO_BRAND_ICON[m.brand]}
                </span>
                <span className="svmp-text">
                  <span className="svmp-name">
                    {m.label}
                    {m.premium && <span className="svmp-diamond" title="Premium">◆</span>}
                  </span>
                  <span className="svmp-strength">{m.strength}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

type Props = {
  modelId: VideoModelId
  ratio: string
  duration: number
  quality: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onModelChange: (id: VideoModelId) => void
}

export default function StudioVideoModelPicker({
  modelId, ratio, duration, quality, open, onOpenChange, onModelChange,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const model = findVideoModel(modelId)
  const summary = modelSummary(model, ratio, duration, quality)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, onOpenChange])

  const pick = (id: VideoModelId) => {
    onModelChange(id)
    onOpenChange(false)
  }

  return (
    <div className="svmp-wrap" ref={wrapRef}>
      {open && (
        <div className="svmp-panel">
          <div className="svmp-panel-head">
            <Sparkles size={14} />
            <span>Chọn model video AI</span>
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Đóng">
              <X size={14} />
            </button>
          </div>
          <StudioVideoModelList modelId={modelId} onModelChange={pick} />
        </div>
      )}

      <button
        type="button"
        className={`vs-bar-pill svmp-trigger${open ? ' open' : ''}`}
        onClick={() => onOpenChange(!open)}
      >
        <span className="svmp-trigger-icon">{VIDEO_BRAND_ICON[model.brand]}</span>
        <span className="svmp-trigger-text">
          <strong>{model.label}</strong>
          <small>{summary}</small>
        </span>
        <ChevronDown size={12} />
      </button>
    </div>
  )
}
