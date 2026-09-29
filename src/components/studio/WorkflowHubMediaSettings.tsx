import type { WorkflowNodeType } from '../../lib/workflows'
import { findImageModelByApiModel } from '../../lib/imageModels'
import { findVideoModelByApiModel, durationOptionsForModel } from '../../lib/videoModels'

// 2026-07-28: Sep yeu cau (workflow ảnh minh họa node thứ 3 "xuất ra sản phẩm"): node Ảnh/Video
// tự chứa luôn cài đặt tỷ lệ/độ phân giải/thời lượng — CHỌN MODEL NÀO CHỈ HIỆN ĐÚNG THÔNG SỐ
// MODEL ĐÓ THẬT SỰ HỖ TRỢ theo tài liệu chính thức của nhà sản xuất (vd Nano Banana Pro 10 tỷ lệ
// + 1K-4K; FLUX.2 Pro chỉ 5 khung cố định, không có độ phân giải riêng) — KHÔNG dùng chung 1 bộ
// tùy chọn cho mọi model. Toàn bộ số liệu (ratios/resolutionMode/durationOptionsForModel) lấy từ
// imageModels.ts/videoModels.ts đã được nạp số liệu thật (xem ghi chú nguồn trong 2 file đó).
// Ghi thẳng vào node.config.aspect_ratio / config.resolution / config.duration / config.quality —
// backend (notiagent-api main.py, node Image/Video) đã vá để đọc các key nay truoc, chỉ fallback
// về cơ chế _path (state) cũ nếu node không đặt giá trị cố định — không phá workflow cũ.

type Props = {
  nodeType: WorkflowNodeType
  config: Record<string, string>
  isEditable: boolean
  onChange: (patch: Record<string, string>) => void
}

export function WorkflowHubMediaSettings({ nodeType, config, isEditable, onChange }: Props) {
  if (nodeType !== 'image' && nodeType !== 'video') return null

  const currentApiModel = config.model || ''
  const imageModel = nodeType === 'image' ? findImageModelByApiModel(currentApiModel) : undefined
  const videoModel = nodeType === 'video' ? findVideoModelByApiModel(currentApiModel) : undefined

  if (!imageModel && !videoModel) {
    return (
      <p className="wf-panel-hint">Chọn model AI ở trên trước — bảng tỷ lệ/độ phân giải/thời lượng sẽ hiện đúng theo model đó.</p>
    )
  }

  const currentRatio = config.aspect_ratio || ''
  const currentResolution = config.resolution || '1K'
  const currentDuration = Number(config.duration) || 0
  const currentQuality =
    config.quality ||
    (videoModel
      ? videoModel.defaultQuality
      : imageModel?.id === 'gpt-image-2'
        ? 'high'
        : '')

  return (
    <div className="wf-field wf-media-settings">
      <span>Tỷ lệ · độ phân giải{videoModel ? ' · thời lượng' : ''} — theo model đang chọn</span>

      <div className="wf-media-settings-row">
        <small>Tỷ lệ khung hình</small>
        <div className="wf-media-chip-grid">
          {(imageModel ? imageModel.ratios : videoModel!.ratios).map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={`wf-media-chip${currentRatio === ratio ? ' active' : ''}`}
              onClick={() => onChange({ aspect_ratio: ratio })}
              disabled={!isEditable}
            >
              {ratio}
            </button>
          ))}
        </div>
      </div>

      {imageModel && imageModel.resolutionMode === 'tiers' && (
        <div className="wf-media-settings-row">
          <small>Độ phân giải xuất</small>
          <div className="wf-media-chip-grid">
            {(['1K', '2K', '4K'] as const)
              .filter((r) => {
                const rank: Record<string, number> = { '1K': 1, '2K': 2, '4K': 3 }
                return rank[r] <= rank[imageModel.maxResolution]
              })
              .map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`wf-media-chip${currentResolution === r ? ' active' : ''}`}
                  onClick={() => onChange({ resolution: r })}
                  disabled={!isEditable}
                >
                  {r}
                </button>
              ))}
          </div>
        </div>
      )}

      {imageModel && imageModel.resolutionMode === 'fixed' && (
        <p className="wf-panel-hint">
          {imageModel.label} không có tham số độ phân giải riêng (API chỉ nhận khung cố định theo tỷ lệ) — độ phân giải đã theo đúng tỷ lệ chọn ở trên.
        </p>
      )}

      {imageModel?.id === 'gpt-image-2' && (
        <div className="wf-media-settings-row">
          <small>Chất lượng</small>
          <div className="wf-media-chip-grid">
            {(['low', 'medium', 'high'] as const).map((quality) => (
              <button
                key={quality}
                type="button"
                className={`wf-media-chip${currentQuality === quality ? ' active' : ''}`}
                onClick={() => onChange({ quality })}
                disabled={!isEditable}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>
      )}

      {videoModel && (
        <div className="wf-media-settings-row">
          <small>Thời lượng (giây)</small>
          <div className="wf-media-chip-grid">
            {durationOptionsForModel(videoModel).map((d) => (
              <button
                key={d}
                type="button"
                className={`wf-media-chip${currentDuration === d ? ' active' : ''}`}
                onClick={() => onChange({ duration: String(d) })}
                disabled={!isEditable}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>
      )}

      {videoModel && (
        <div className="wf-media-settings-row">
          <small>Độ phân giải</small>
          <div className="wf-media-chip-grid">
            {(videoModel.qualityOptions || [videoModel.defaultQuality]).map((quality) => (
              <button
                key={quality}
                type="button"
                className={`wf-media-chip${currentQuality === quality ? ' active' : ''}`}
                onClick={() => onChange({ resolution: quality, quality })}
                disabled={!isEditable}
              >
                {quality.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
