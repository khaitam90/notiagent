import { Coins } from 'lucide-react'
import { formatCreditsWithUsd, formatUsd } from '../../lib/costEstimate'

type Props = {
  credits: number
  usd: number
  hint?: string
  compact?: boolean
}

/** Badge ước tính credit trừ khi gửi render */
export default function StudioCreditBadge({ credits, usd, hint, compact = false }: Props) {
  if (credits <= 0) return null

  return (
    <div
      className={`sct-credit-badge${compact ? ' compact' : ''}`}
      title={`Ước tính chi phí API — ${formatCreditsWithUsd(usd)}. Giá thực tế có thể chênh nhẹ.`}
    >
      <Coins size={14} className="sct-credit-icon" aria-hidden />
      <div className="sct-credit-text">
        <span className="sct-credit-value">
          ≈ <strong>{credits}</strong> credit
        </span>
        {!compact && hint && <small className="sct-credit-hint">{hint}</small>}
      </div>
      {!compact && <span className="sct-credit-usd">{formatUsd(usd)}</span>}
    </div>
  )
}
