import { ChevronDown } from 'lucide-react'
import StudioCreditBadge from './StudioCreditBadge'
import {
  STUDIO_ASPECT_RATIOS,
  STUDIO_VARIANT_COUNTS,
  type StudioVariantCount,
} from '../../lib/studioComposerRatios'
import type { ImageResolutionId } from '../../lib/imageModels'
import { usdToCredits } from '../../lib/costEstimate'

type ResolutionOption = {
  id: ImageResolutionId
  label: string
  desc: string
}

type Props = {
  mode: 'image' | 'video'
  ratio: string
  onRatioChange: (ratio: string) => void
  /** Chỉ ảnh — số biến thể */
  variantCount?: StudioVariantCount
  onVariantChange?: (n: StudioVariantCount) => void
  /** Chỉ ảnh — độ phân giải xuất */
  resolution?: ImageResolutionId
  resolutionOptions?: ResolutionOption[]
  onResolutionChange?: (id: ImageResolutionId) => void
  modelLabel?: string
  modelIcon?: string
  onModelClick?: () => void
  ratios?: string[]
  /** Ước tính credit khi gửi */
  creditUsd?: number
  creditHint?: string
}

export default function StudioComposerToolbar({
  mode,
  ratio,
  onRatioChange,
  variantCount = 1,
  onVariantChange,
  resolution = '1K',
  resolutionOptions,
  onResolutionChange,
  modelLabel,
  modelIcon,
  onModelClick,
  ratios,
  creditUsd,
  creditHint,
}: Props) {
  const allowed = ratios?.length
    ? STUDIO_ASPECT_RATIOS.filter((r) => ratios.includes(r.id) || r.id === ratio)
    : STUDIO_ASPECT_RATIOS

  return (
    <div className="sct-wrap">
      <div className="sct-ratio-row">
        {allowed.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`sct-ratio-btn${ratio === r.id ? ' active' : ''}`}
            onClick={() => onRatioChange(r.id)}
            title={r.label}
          >
            <span
              className="sct-ratio-frame"
              style={{ width: r.frameW, height: r.frameH }}
              aria-hidden
            />
            <span className="sct-ratio-label">{r.label}</span>
          </button>
        ))}
      </div>

      {mode === 'image' && onVariantChange && (
        <div className="sct-variant-row">
          {STUDIO_VARIANT_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className={`sct-variant-btn${variantCount === n ? ' active' : ''}`}
              onClick={() => onVariantChange(n)}
            >
              {n}x
            </button>
          ))}
        </div>
      )}

      {mode === 'image' && onResolutionChange && resolutionOptions && resolutionOptions.length > 0 && (
        <div className="sct-resolution-row">
          <span className="sct-resolution-head">Độ phân giải xuất</span>
          <div className="sct-resolution-btns">
            {resolutionOptions.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`sct-resolution-btn${resolution === r.id ? ' active' : ''}`}
                onClick={() => onResolutionChange(r.id)}
                title={r.desc}
              >
                <strong>{r.label}</strong>
                <small>{r.desc}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {modelLabel && onModelClick && (
        <button type="button" className="sct-model-btn" onClick={onModelClick}>
          {modelIcon && <span className="sct-model-icon">{modelIcon}</span>}
          <span className="sct-model-label">{modelLabel}</span>
          <ChevronDown size={14} />
        </button>
      )}

      {creditUsd !== undefined && creditUsd > 0 && (
        <StudioCreditBadge
          credits={usdToCredits(creditUsd)}
          usd={creditUsd}
          hint={creditHint}
        />
      )}
    </div>
  )
}
