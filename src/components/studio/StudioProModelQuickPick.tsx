import { findVideoModel, type VideoModelId } from '../../lib/videoModels'
import { getVideoModelRefLayout } from '../../lib/videoModelRefLayout'

const PRO_MODELS: { id: VideoModelId; badge?: string }[] = [
  { id: 'seedance-2.0-fast', badge: 'NHANH' },
  { id: 'seedance-2.0' },
  { id: 'kling-3.0', badge: 'PRO' },
]

type Props = {
  modelId: string
  onModelChange: (id: VideoModelId) => void
}

export default function StudioProModelQuickPick({ modelId, onModelChange }: Props) {
  const activeLayout = getVideoModelRefLayout(modelId)

  return (
    <div className="spmq-wrap">
      <div className="spmq-head">
        <strong>Model AI cấu hình cao</strong>
        <span className="spmq-hint">Chọn model để mở upload theo layout riêng</span>
      </div>
      <div className="spmq-row">
        {PRO_MODELS.map(({ id, badge }) => {
          const m = findVideoModel(id)
          const active = modelId === id
          const layout = getVideoModelRefLayout(id)
          return (
            <button
              key={id}
              type="button"
              className={`spmq-chip${active ? ' active' : ''}`}
              onClick={() => onModelChange(id)}
              title={m.desc}
            >
              {badge && <span className={`spmq-badge spmq-badge-${badge.toLowerCase()}`}>{badge}</span>}
              <span className="spmq-chip-label">{m.label}</span>
              <small>
                {layout === 'seedance-mix' ? 'Ảnh · Video · Audio' : 'Khung đầu · Khung cuối'}
              </small>
            </button>
          )
        })}
      </div>
      {activeLayout === 'standard' && (
        <p className="spmq-promo">
          Đang dùng model thường — bấm <strong>Seedance 2.0</strong> hoặc <strong>Kling 3.0 Pro</strong> để thấy ô upload nâng cao.
        </p>
      )}
    </div>
  )
}
