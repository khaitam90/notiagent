import { useState } from 'react'
import { ChevronDown, ImageOff, Settings2 } from 'lucide-react'
import type { WorkflowNode } from '../../lib/workflows'
import {
  ALL_IMAGE_MODELS,
  IMAGE_BRAND_GROUPS,
  computeImageDimensions,
  findImageModelByApiModel,
  type ImageResolutionId,
} from '../../lib/imageModels'
import { MODEL_GROUPS as VIDEO_MODEL_GROUPS, VIDEO_MODEL_TIER_GROUPS, findVideoModelByApiModel, durationOptionsForModel } from '../../lib/videoModels'
import { DEFAULT_IMAGE_MODEL_BY_TIER, DEFAULT_VIDEO_MODEL_BY_TIER, type StudioRenderTier } from '../../lib/studioRenderTier'
import { imageCostBreakdown, estimateVideoCostUsd, usdToCredits } from '../../lib/costEstimate'

// 2026-07-28: Sep gui anh mau tu app khac (node co preview + settings hien gia credit ngay tren
// khoi node, khong can mo sidebar) va yeu cau lam lai node Anh/Video theo huong nay. Component nay
// la ban RIENG, RUT GON de vua tren the node (~300px) - khac WorkflowHubModelPicker (dung trong
// Inspector, hien card to). "Che do" Dao dien/Tieu chuan dung DUNG khai niem co san o Studio AI
// (studioRenderTier.ts) - KHONG bia "server/toc do uu tien" gia vi ha tang that (fal.ai/Replicate)
// khong co co che do. Gia credit dung DUNG cong thuc uoc tinh da co san (costEstimate.ts, dang dung
// o Studio AI Composer) - khong bia gia moi.
//
// 2026-07-28h: Sep bao "node nay khong phai dung de tai anh len va viet prompt o day" - dung, ban
// dau component nay co them 1 o "Anh tham chieu" (upload) + 1 o "Prompt chay thu" + nut "Chay node"
// de test CACH LY, goi thang API tao anh/video RIENG, KHONG dung du lieu that cua workflow (prompt
// that nam o node "Dung prompt" da noi vao day, anh tham chieu that nam o node Dau vao/run panel).
// Go them 1 lan nua ngay tren node la SAI - gay hieu lam "go o day co anh huong workflow" (thuc te
// KHONG anh huong). Da bo han o upload/prompt-box/nut chay-thu. Preview gio LAY THAT tu ket qua lan
// "Chay workflow" gan nhat (prop latestOutputUrl/latestOutputType, WorkflowHub.tsx tinh tu
// selectedRunTrace - be main.py tra output.imageUrl/output.videoUrl dung theo node) - dung du lieu
// that, khong con duong nhap lieu gia song song. Node card gio CHI con phan CAU HINH (model/ty
// le/do phan giai/thoi luong) - dung dung cho lan chay workflow that.

type Props = {
  node: WorkflowNode
  isEditable: boolean
  onUpdateConfig: (patch: Record<string, string>) => void
  latestOutputUrl?: string
  latestOutputType?: 'image' | 'video'
}

export function WorkflowHubNodeMediaPanel({ node, isEditable, onUpdateConfig, latestOutputUrl, latestOutputType }: Props) {
  const [configOpen, setConfigOpen] = useState(false)
  const isImage = node.type === 'image'
  const isVideo = node.type === 'video'
  if (!isImage && !isVideo) return null

  const config = node.config
  const currentApiModel = config.model || ''
  const imageModel = isImage ? findImageModelByApiModel(currentApiModel) : undefined
  const videoModel = isVideo ? findVideoModelByApiModel(currentApiModel) : undefined
  const currentRatio = config.aspect_ratio || (isVideo ? '16:9' : '1:1')
  const [ratioWidth, ratioHeight] = currentRatio.split(':').map(Number)
  const previewAspectRatio = ratioWidth > 0 && ratioHeight > 0 ? `${ratioWidth} / ${ratioHeight}` : (isVideo ? '16 / 9' : '1 / 1')
  const currentResolution = config.resolution || '1K'
  const currentImageQuality = config.quality || 'high'
  const currentDuration = Number(config.duration) || (videoModel ? durationOptionsForModel(videoModel)[0] : 5)
  const generateAudio = videoModel?.nativeAudio === 'always' || config.generate_audio === 'true'
  const isSeedance = isVideo && currentApiModel.toLowerCase().includes('seedance')
  const referencePolicyClass = config.reference_policy_class || ''
  const consentConfirmed = config.consent_confirmed === 'true'
  const containsPersonalData = config.contains_personal_data === 'true'
  const previewUrl = latestOutputUrl || ''
  const previewType = latestOutputType || (isImage ? 'image' : 'video')
  const supportedRatios = imageModel?.ratios || videoModel?.ratios || []
  const quickRatios = ['16:9', '9:16', '1:1']

  function applyTier(tier: StudioRenderTier) {
    if (!isEditable) return
    if (isImage) {
      const targetId = DEFAULT_IMAGE_MODEL_BY_TIER[tier]
      const target = ALL_IMAGE_MODELS.find((m) => m.id === targetId)
      if (target) onUpdateConfig({ provider: target.provider, model: target.apiModel })
    } else {
      const targetId = DEFAULT_VIDEO_MODEL_BY_TIER[tier]
      const target = VIDEO_MODEL_TIER_GROUPS.flatMap((g) => g.models).find((m) => m.id === targetId)
      if (target) onUpdateConfig({ provider: target.provider, model: target.apiModel })
    }
  }

  const imageOutput = imageModel
    ? computeImageDimensions(currentRatio || '1:1', currentResolution as ImageResolutionId, imageModel.id)
    : null
  const costUsd = isImage && imageModel && imageOutput
    ? imageCostBreakdown(imageModel.id, {
        ...imageOutput,
        numImages: 1,
        ratio: currentRatio,
        quality: currentImageQuality,
      }).usd
    : isVideo && videoModel
      ? estimateVideoCostUsd(
          videoModel.id,
          currentDuration,
          (config.resolution || config.quality || videoModel.defaultQuality) as string,
          generateAudio,
        )
      : 0
  const costCredits = usdToCredits(costUsd)

  return (
    <div
      className="wf-node-media-panel"
      onMouseDown={(event) => event.stopPropagation()}
      // 2026-07-28: KHONG stopPropagation onMouseUp o day - Sep bao khong keo noi canh duoc tu
      // node khac vao node Anh/Video. Root cause: card node cha (WorkflowHubEditorCanvas.tsx) bat
      // su kien "tha chuot bat ky dau tren card = hoan tat noi canh" bang onMouseUp cua CHINH NO
      // (khong chi rieng 2 cham handle nho o vien) - stopPropagation o day chan mat su kien do
      // truoc khi no bubble len duoc toi card cha, nen Sep phai tha trung dung cham handle ~10px
      // moi noi duoc. Van giu stopPropagation cho onMouseDown (tranh bam vao select lai vo tinh keo
      // le ca node) va onClick (tranh bam trong panel lai kich hoat logic click cua card cha).
      onClick={(event) => event.stopPropagation()}
    >
      <div className="wf-node-media-preview" style={{ aspectRatio: previewAspectRatio }}>
        {previewUrl ? (
          previewType === 'video' ? (
            <video src={previewUrl} controls />
          ) : (
            <img src={previewUrl} alt="Kết quả" />
          )
        ) : (
          <div className="wf-node-media-preview-empty">
            <ImageOff size={20} />
            <span>Chưa có kết quả — bấm "Chạy workflow" để xem</span>
          </div>
        )}
      </div>

      <div className="wf-node-media-ratio-quick" aria-label="Chọn nhanh tỷ lệ đầu ra">
        {quickRatios.map((ratio) => {
          const isSupported = supportedRatios.length === 0 || supportedRatios.includes(ratio)
          return (
            <button
              type="button"
              key={ratio}
              className={currentRatio === ratio ? 'active' : ''}
              disabled={!isEditable || !isSupported}
              title={isSupported ? `Đổi nhanh sang ${ratio}` : `Model hiện tại không hỗ trợ ${ratio}`}
              onClick={() => onUpdateConfig({ aspect_ratio: ratio })}
            >
              {ratio}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className={`wf-node-media-config-toggle${configOpen ? ' active' : ''}`}
        onClick={() => setConfigOpen((open) => !open)}
        aria-expanded={configOpen}
      >
        <Settings2 size={12} />
        Cấu hình
        <ChevronDown size={12} className={configOpen ? 'open' : ''} />
      </button>

      {configOpen && <div className="wf-node-media-config">
      <div className="wf-node-media-tier">
        <button type="button" className="wf-node-media-tier-btn" disabled={!isEditable} onClick={() => applyTier('director')}>
          Đạo diễn
        </button>
        <button type="button" className="wf-node-media-tier-btn" disabled={!isEditable} onClick={() => applyTier('standard')}>
          Tiêu chuẩn
        </button>
      </div>

      <label className="wf-node-media-select wf-node-media-model-select">
        <span>Model AI</span>
        <select
          value={currentApiModel}
          disabled={!isEditable}
          onChange={(event) => {
            if (isImage) {
              const picked = ALL_IMAGE_MODELS.find((m) => m.apiModel === event.target.value)
              if (!picked) return
              onUpdateConfig({
                provider: picked.provider,
                model: picked.apiModel,
                aspect_ratio: picked.ratios.includes('1:1') ? '1:1' : picked.ratios[0],
                resolution: '1K',
              })
            } else {
              const picked = VIDEO_MODEL_TIER_GROUPS.flatMap((g) => g.models).find((m) => m.apiModel === event.target.value)
              if (!picked) return
              onUpdateConfig({
                provider: picked.provider,
                model: picked.apiModel,
                aspect_ratio: picked.ratios.includes('16:9') ? '16:9' : picked.ratios[0],
                resolution: picked.defaultQuality,
                quality: picked.defaultQuality,
                duration: String(durationOptionsForModel(picked)[0]),
                generate_audio: picked.nativeAudio === 'always' ? 'true' : 'false',
              })
            }
          }}
        >
          <option value="" disabled>
            Chọn model...
          </option>
          {isVideo &&
            videoModel &&
            currentApiModel !== videoModel.apiModel &&
            currentApiModel !== videoModel.imageApiModel && (
              <option value={currentApiModel}>
                {videoModel.label} · Image-to-video
              </option>
            )}
          {isImage &&
            IMAGE_BRAND_GROUPS.map((group) => (
              <optgroup key={group.brand} label={group.label}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.apiModel}>
                    {model.label}{model.status === 'ready' ? ' · Sẵn sàng' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          {isVideo &&
            VIDEO_MODEL_GROUPS.map((group) => (
              <optgroup key={group.brand} label={group.brand}>
                {group.models.map((model) => (
                  <option key={model.id} value={model.apiModel}>
                    {model.label}
                  </option>
                ))}
              </optgroup>
            ))}
        </select>
      </label>

      {(imageModel || videoModel) && (
        <div className="wf-node-media-model-info">
          <strong>{imageModel?.label || videoModel?.label}</strong>
          <span>{imageModel?.desc || videoModel?.desc}</span>
          <small>
            Phù hợp: {imageModel ? imageModel.strengths.join(' · ') : VIDEO_MODEL_TIER_GROUPS.flatMap((group) => group.models).find((model) => model.id === videoModel?.id)?.strength}
          </small>
        </div>
      )}

      <div className="wf-node-media-row">
        {(imageModel?.ratios || videoModel?.ratios) && (
          <label className="wf-node-media-select">
            <span>Tỷ lệ</span>
            <select value={currentRatio} disabled={!isEditable} onChange={(event) => onUpdateConfig({ aspect_ratio: event.target.value })}>
              {(imageModel?.ratios || videoModel?.ratios || []).map((ratio) => (
                <option key={ratio} value={ratio}>
                  {ratio}
                </option>
              ))}
            </select>
          </label>
        )}

        {isImage && imageModel?.resolutionMode === 'tiers' && (
          <label className="wf-node-media-select">
            <span>Độ phân giải</span>
            <select value={currentResolution} disabled={!isEditable} onChange={(event) => onUpdateConfig({ resolution: event.target.value })}>
              {(['1K', '2K', '4K'] as const)
                .filter((r) => {
                  const rank: Record<string, number> = { '1K': 1, '2K': 2, '4K': 3 }
                  return rank[r] <= rank[imageModel.maxResolution]
                })
                .map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
            </select>
          </label>
        )}

        {isVideo && videoModel && (
          <label className="wf-node-media-select">
            <span>Thời lượng</span>
            <select value={currentDuration} disabled={!isEditable} onChange={(event) => onUpdateConfig({ duration: event.target.value })}>
              {durationOptionsForModel(videoModel).map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {isVideo && videoModel && (
        <label className="wf-node-media-select">
          <span>Độ phân giải</span>
          <select
            value={config.resolution || videoModel.defaultQuality}
            disabled={!isEditable}
            onChange={(event) => onUpdateConfig({ resolution: event.target.value, quality: event.target.value })}
          >
            {(videoModel.qualityOptions || [videoModel.defaultQuality]).map((quality) => (
              <option key={quality} value={quality}>{quality.toUpperCase()}</option>
            ))}
          </select>
        </label>
      )}

      {isVideo && videoModel?.nativeAudio === 'optional' && (
        <label className="wf-node-media-audio-toggle">
          <span>
            <strong>Âm thanh native</strong>
            <small>Thoại, nhạc và hiệu ứng được model tạo đồng bộ.</small>
          </span>
          <input
            type="checkbox"
            checked={generateAudio}
            disabled={!isEditable}
            onChange={(event) => onUpdateConfig({ generate_audio: event.target.checked ? 'true' : 'false' })}
          />
        </label>
      )}

      {isVideo && videoModel?.nativeAudio === 'always' && (
        <p className="wf-node-media-audio-always">Âm thanh native luôn bật theo model.</p>
      )}

      {isSeedance && (
        <div className="wf-node-media-policy">
          <div className="wf-node-media-policy-head">
            <strong>Chính sách ảnh tham chiếu</strong>
            <small>Được kiểm tra trước khi tải ảnh sang Seedance.</small>
          </div>
          <label className="wf-node-media-select">
            <span>Nguồn gốc và mức nhận dạng</span>
            <select
              value={referencePolicyClass}
              disabled={!isEditable}
              onChange={(event) => onUpdateConfig({ reference_policy_class: event.target.value })}
            >
              <option value="">Chưa khai báo · sẽ bị chặn</option>
              <option value="synthetic_non_identifiable">Nhân vật tổng hợp · không nhận dạng</option>
              <option value="licensed_non_identifiable">Ảnh được cấp phép · không nhận dạng</option>
              <option value="consented_adult">Người trưởng thành · đã đồng thuận</option>
            </select>
          </label>
          {referencePolicyClass === 'consented_adult' && (
            <label className="wf-node-media-policy-check">
              <input
                type="checkbox"
                checked={consentConfirmed}
                disabled={!isEditable}
                onChange={(event) => onUpdateConfig({ consent_confirmed: event.target.checked ? 'true' : 'false' })}
              />
              <span>Tôi xác nhận chủ thể trưởng thành đã đồng ý sử dụng ảnh.</span>
            </label>
          )}
          <label className="wf-node-media-policy-check is-danger">
            <input
              type="checkbox"
              checked={containsPersonalData}
              disabled={!isEditable}
              onChange={(event) => onUpdateConfig({ contains_personal_data: event.target.checked ? 'true' : 'false' })}
            />
            <span>Ảnh có dữ liệu cá nhân hoặc riêng tư — bật mục này sẽ chặn render.</span>
          </label>
          <p className={`wf-node-media-policy-status${referencePolicyClass && !containsPersonalData && (referencePolicyClass !== 'consented_adult' || consentConfirmed) ? ' is-ready' : ''}`}>
            {referencePolicyClass && !containsPersonalData && (referencePolicyClass !== 'consented_adult' || consentConfirmed)
              ? 'Đủ khai báo để kiểm tra Policy Gate.'
              : 'Chưa đủ điều kiện gửi ảnh tham chiếu.'}
          </p>
        </div>
      )}

      {isImage && imageModel?.id === 'gpt-image-2' && (
        <label className="wf-node-media-select">
          <span>Chất lượng</span>
          <select value={currentImageQuality} disabled={!isEditable} onChange={(event) => onUpdateConfig({ quality: event.target.value })}>
            <option value="low">Low · tiết kiệm</option>
            <option value="medium">Medium</option>
            <option value="high">High · tốt nhất</option>
          </select>
        </label>
      )}

      {costCredits > 0 && (
        <p className="wf-node-media-cost-hint">
          ≈ {costCredits} credit / lần chạy{generateAudio ? ' · gồm âm thanh' : ''}
        </p>
      )}
      </div>}
    </div>
  )
}
