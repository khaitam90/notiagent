import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Sparkles, ChevronDown, SlidersHorizontal, X, Check, Gem, ImagePlus, Fingerprint } from 'lucide-react'
import { createImage, uploadMedia } from '../lib/api'
import StudioMediaPreviewModal from './studio/StudioMediaPreviewModal'
import {
	  IMAGE_SIZE_PRESETS, IMAGE_RESOLUTION_OPTIONS,
  findImageModel, PROVIDER_LABEL, BRAND_ICON,
  imageModelGroupsForTier, resolveImageApiModel, computeImageDimensions,
  supportsImageFaceId, imageModelStudioTier,
  type ImageModelId, type ImageResolution,
} from '../lib/imageModels'
import { DEFAULT_IMAGE_MODEL_BY_TIER, type StudioRenderTier } from '../lib/studioRenderTier'
import StudioRenderTierToggle from './studio/StudioRenderTierToggle'

import { IMAGE_TOOL_PRESETS, type ImageToolPreset } from '../lib/imageToolPresets'
import StudioRefSlots from './studio/StudioRefSlots'
import { getImagePresetRefConfig } from '../lib/studioRefTypes'
import { imageCostBreakdown, hasImagePriceData, formatCreditsWithUsd } from '../lib/costEstimate'

type Props = {
  ratio?: string
  initialPresetId?: string
  initialRefUrl?: string
  onGenerated: (res: { imageUrl?: string; imageUrls?: string[]; message?: string; status?: string }) => void
}

const IMAGE_VARIANT_COUNTS = [1, 2, 3, 4] as const
type ImageVariantCount = (typeof IMAGE_VARIANT_COUNTS)[number]
type ImageGenerationMode = 'standard' | 'face_id'
const FACE_ID_WEIGHT_MIN = 0.5
const FACE_ID_WEIGHT_MAX = 1.5
const FACE_ID_WEIGHT_STEP = 0.05

export default function AiImageStudio({ ratio = '9:16', initialPresetId, initialRefUrl, onGenerated }: Props) {
  const [renderTier, setRenderTier] = useState<StudioRenderTier>('director')
  const [modelId, setModelId] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL_BY_TIER.director)
  const [sizeId, setSizeId] = useState('portrait')
  const [resolution, setResolution] = useState<ImageResolution>('2K')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ratioMenuOpen, setRatioMenuOpen] = useState(false)
  const [lastUrls, setLastUrls] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [variants, setVariants] = useState<ImageVariantCount>(1)
  const [error, setError] = useState<string | null>(null)
  const [pendingText, setPendingText] = useState<string | null>(null)
  const [activePreset, setActivePreset] = useState<ImageToolPreset | null>(null)
  const [refImage, setRefImage] = useState<string | null>(null)
  const [refImageFile, setRefImageFile] = useState<File | null>(null)
  const [refCdnUrl, setRefCdnUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [generationMode, setGenerationMode] = useState<ImageGenerationMode>('standard')
  const [faceIdWeight, setFaceIdWeight] = useState(1)
  const rootRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!initialRefUrl) return
    setRefImage(initialRefUrl)
    setRefCdnUrl(initialRefUrl)
    setRefImageFile(null)
  }, [initialRefUrl])

  const applyRefFromUrl = (url: string) => {
    setRefImage(url)
    setRefCdnUrl(url)
    setRefImageFile(null)
    setPreviewIndex(null)
  }
  const model = findImageModel(modelId, renderTier)
  const modelGroups = imageModelGroupsForTier(renderTier)
  const tierMeta = renderTier === 'director'
    ? 'Đạo diễn · model cao cấp'
    : 'Tiêu chuẩn · model trung bình'
  const sizePreset = IMAGE_SIZE_PRESETS.find((p) => p.id === sizeId)
    ?? IMAGE_SIZE_PRESETS.find((p) => p.ratio === ratio)
    ?? IMAGE_SIZE_PRESETS[0]
  const outputSize = computeImageDimensions(sizePreset.ratio, resolution, modelId)
  const refConfig = getImagePresetRefConfig(activePreset)
  const faceIdSupported = supportsImageFaceId(model)
  const faceIdEnabled = generationMode === 'face_id' && faceIdSupported
  const effectiveRefConfig = faceIdEnabled
    ? {
        ...refConfig,
        image: 'required' as const,
        imageLabel: 'Ảnh chân dung FaceID',
        imageHint: 'PuLID giữ danh tính từ 1 ảnh chân dung rõ mặt',
      }
    : refConfig

  useEffect(() => {
    if (!faceIdSupported && generationMode === 'face_id') {
      setGenerationMode('standard')
    }
  }, [faceIdSupported, generationMode])

  const clearRefImage = () => {
    setRefImage(null)
    setRefImageFile(null)
    setRefCdnUrl(null)
  }

  const uploadRefImage = async (f: File) => {
    setUploading(true)
    setError(null)
    try {
      const up = await uploadMedia(f, 'image')
      setRefCdnUrl(up.url)
      setRefImage(up.url)
      setRefImageFile(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Upload ảnh ref lỗi: ${msg}`)
      clearRefImage()
      throw e
    } finally {
      setUploading(false)
    }
  }

  const handleRefImage = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    setRefImageFile(f)
    setRefCdnUrl(null)
    setRefImage(URL.createObjectURL(f))
    if (imageRef.current) imageRef.current.value = ''
    void uploadRefImage(f)
  }

  useEffect(() => {
    if (!initialPresetId) {
      setActivePreset(null)
      return
    }
    const preset = IMAGE_TOOL_PRESETS.find((p) => p.id === initialPresetId)
    if (!preset) return
    setActivePreset(preset)
    const pm = findImageModel(preset.modelId)
    setRenderTier(imageModelStudioTier(pm))
    setModelId(preset.modelId as ImageModelId)
    setSizeId(preset.sizeId)
    setPrompt(preset.prompt)
    clearRefImage()
  }, [initialPresetId])

  useEffect(() => {
    if (initialPresetId) return
    const match = IMAGE_SIZE_PRESETS.find((p) => p.ratio === ratio)
    if (match) setSizeId(match.id)
  }, [ratio, initialPresetId])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
        setRatioMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const pickRenderTier = (tier: StudioRenderTier) => {
    setRenderTier(tier)
    const current = findImageModel(modelId, tier)
    if (imageModelStudioTier(current) !== tier) {
      setModelId(DEFAULT_IMAGE_MODEL_BY_TIER[tier])
    }
    setSettingsOpen(false)
  }

  const pickModel = (id: ImageModelId) => {
    setModelId(id)
    setSettingsOpen(false)
  }

  const generate = async () => {
    const text = prompt.trim()
    if (!text || loading) return
	    if (effectiveRefConfig.image === 'required' && !refImage) {
	      setError(`Cần ${effectiveRefConfig.imageLabel || 'ảnh tham chiếu'} — tải ảnh ở ô phía trên`)
	      return
	    }
    if (refImage && uploading) {
      setError('Ảnh ref đang upload — đợi vài giây rồi bấm Tạo lại')
      return
    }
    // provider that (khong phai mock) deu tinh phi that - luon hoi xac nhan truoc, giong dung
    // co che da lam voi tao video (AiVideoStudio.tsx). Khong tu goi thang provider tra phi.
    setError(null)
    setPendingText(text)
  }

  const runGenerate = async (text: string, mock: boolean) => {
    setPendingText(null)
    setLoading(true)
    setError(null)
    try {
      let imageUrl: string | undefined = refCdnUrl?.trim()
        || (refImage && !refImage.startsWith('blob:') && !refImage.startsWith('data:')
          ? refImage.trim()
          : undefined)

      if (!imageUrl && refImageFile) {
        setUploading(true)
        const up = await uploadMedia(refImageFile, 'image')
        imageUrl = up.url
        setRefCdnUrl(up.url)
        setRefImage(up.url)
        setRefImageFile(null)
        setUploading(false)
      }

	      if (refImage && !imageUrl) {
	        throw new Error('Ảnh tham chiếu chưa upload lên server — chọn lại ảnh và đợi upload xong')
	      }

	      if (faceIdEnabled && !imageUrl) {
	        throw new Error('FaceID · FLUX PuLID cần 1 ảnh chân dung tham chiếu rõ mặt')
	      }

	      const useRef = Boolean(imageUrl)
	      const apiModel = faceIdEnabled ? model.apiModel : resolveImageApiModel(model, useRef)
	      const res = await createImage(text, {
	        provider: mock ? 'mock' : model.provider,
	        model: apiModel,
	        generation_mode: faceIdEnabled ? 'face_id' : 'standard',
	        width: outputSize.width,
	        height: outputSize.height,
	        resolution,
	        image_url: imageUrl,
	        image_urls: imageUrl ? [imageUrl] : undefined,
	        num_images: variants,
	        face_id: faceIdEnabled
	          ? {
	              api_model: model.faceIdApiModel,
	              id_weight: Number(faceIdWeight.toFixed(2)),
	            }
	          : undefined,
	      })
      const urls = (Array.isArray(res.imageUrls) ? res.imageUrls : [])
        .filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
      const primary = urls[0] || (res.imageUrl as string | undefined)
      if (!primary) throw new Error('API không trả URL ảnh')
      const allUrls = urls.length > 0 ? urls : [primary]
      setLastUrls(allUrls)
      const variantNote = allUrls.length > 1 ? ` · ${allUrls.length} biến thể` : ''
      const modelLabel = mock ? `${model.label} (test miễn phí — mock)` : model.label
      onGenerated({
        imageUrl: primary,
        imageUrls: allUrls,
        message: `Ảnh đã tạo — ${modelLabel} · ${outputSize.resolutionLabel}${variantNote}`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      onGenerated({ status: 'error', message: msg })
    } finally {
      setLoading(false)
      setUploading(false)
    }
  }

  return (
    <div className="vs-studio vs-image-studio" ref={rootRef}>
      <div className="vs-image-scroll">
        <div className="vs-image-intro">
          <Sparkles size={16} />
          <p>
            <strong>{model.label}</strong>
            <span className={`vs-image-quality-pill vs-q-${model.qualityTier}`}>{model.qualityLabel}</span>
            <span className={`vs-image-quality-pill vs-tier-mode vs-tier-${renderTier}`}>{tierMeta}</span>
            · {PROVIDER_LABEL[model.provider]}
            <br />
            <small>{model.desc}</small>
            <br />
            <small className="vs-image-intro-meta">
              <strong>Sức mạnh:</strong> {model.strengths.join(' · ')}
              {' — '}
              <strong>Khả năng:</strong> {model.capabilities.slice(0, 3).join(' · ')}
            </small>
          </p>
        </div>

        {lastUrls.length > 0 && (
          <div className={`vs-image-result-grid cols-${Math.min(lastUrls.length, 2)}`}>
            {lastUrls.map((url, i) => (
              <button
                key={`${url}-${i}`}
                type="button"
                className="vs-image-result vs-image-result-clickable"
                onClick={() => setPreviewIndex(i)}
                title="Xem trước · tải về · chỉnh sửa"
              >
                {lastUrls.length > 1 && (
                  <span className="vs-image-variant-badge">#{i + 1}</span>
                )}
                <img src={url} alt={`AI generated ${i + 1}`} />
                <span className="sh-ai-media-hover">Xem</span>
              </button>
            ))}
          </div>
        )}

        {pendingText && (() => {
          const cost = imageCostBreakdown(model.id, {
            width: outputSize.width,
            height: outputSize.height,
            resolutionLabel: outputSize.resolutionLabel,
            numImages: variants,
            ratio: sizePreset.ratio,
          })
          const costLabel = hasImagePriceData(model.id)
            ? `tính phí — ${formatCreditsWithUsd(cost.usd)}`
            : `tính phí — ${model.label}, chưa có bảng giá xác thực`
          return (
            <div className="vs-confirm-bar">
              <button type="button" className="vs-confirm-run" onClick={() => runGenerate(pendingText, false)}>
                ✅ Tạo thật ({costLabel})
              </button>
              <button type="button" className="vs-confirm-mock" onClick={() => runGenerate(pendingText, true)}>
                🧪 Test miễn phí trước
              </button>
              <button type="button" onClick={() => setPendingText(null)}>✖ Huỷ</button>
            </div>
          )
        })()}
        {error && <div className="vs-image-error">{error}</div>}

        {settingsOpen && (
          <div className="vs-image-settings">
            <div className="vs-image-settings-head">
              <span>Chọn mô hình</span>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Đóng">
                <X size={14} />
              </button>
            </div>

            {modelGroups.map((group) => (
              <div key={group.tier} className="vs-image-settings-group">
                <div className="vs-image-settings-tier">
                  <span className={`vs-image-tier-badge vs-q-${group.tier}`}>{group.label}</span>
                  <small>Cấp chất lượng ảnh</small>
                </div>
                <div className="vs-image-model-list">
                  {group.models.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`vs-image-model-card${modelId === m.id ? ' active' : ''}`}
                      onClick={() => pickModel(m.id)}
                    >
                      <span className="vs-image-model-icon" aria-hidden>{BRAND_ICON[m.brand]}</span>
                      <span className="vs-image-model-body">
                        <span className="vs-image-model-name">
                          {m.label}
                          {m.premium && <Gem size={11} className="vs-image-premium" aria-label="Cao cấp" />}
                        </span>
                        <span className="vs-image-model-desc">{m.desc}</span>
                        <span className="vs-image-model-strengths">
                          <strong>Sức mạnh:</strong> {m.strengths.join(' · ')}
                        </span>
                        <span className="vs-image-model-caps">
                          <strong>Khả năng:</strong> {m.capabilities.join(' · ')}
                        </span>
                      </span>
                      {modelId === m.id && <Check size={14} className="vs-image-model-check" aria-hidden />}
                    </button>
                  ))}
                </div>
              </div>
            ))}

          </div>
        )}
      </div>

      <div className="vs-composer vs-image-composer">
        <input ref={imageRef} type="file" accept="image/*" hidden onChange={(e) => handleRefImage(e.target.files)} />
	          <StudioRefSlots
	          image={{
	            mode: effectiveRefConfig.image,
	            label: effectiveRefConfig.imageLabel || 'Ảnh tham chiếu',
	            hint: uploading
	              ? 'Đang upload ảnh lên server…'
	              : (effectiveRefConfig.imageHint || 'Style / layout reference'),
	            preview: refImage,
	            onPick: () => imageRef.current?.click(),
	            onClear: clearRefImage,
	          }}
	        />
	        <div className="vs-composer-box" ref={composerRef}>
	          <StudioRenderTierToggle tier={renderTier} onChange={pickRenderTier} />
	          {faceIdSupported && (
	            <div className="vs-image-ratio-bar vs-image-faceid-bar">
	              <span className="vs-image-ratio-label">Chế độ</span>
	              <div className="vs-ratio-row vs-image-ratio-row" role="group" aria-label="Chế độ tạo ảnh">
	                <button
	                  type="button"
	                  className={`vs-ratio-btn${generationMode === 'standard' ? ' active' : ''}`}
	                  onClick={() => setGenerationMode('standard')}
	                >
	                  Edit ref
	                </button>
	                <button
	                  type="button"
	                  className={`vs-ratio-btn${generationMode === 'face_id' ? ' active' : ''}`}
	                  onClick={() => setGenerationMode('face_id')}
	                >
	                  <Fingerprint size={13} /> FaceID · FLUX PuLID
	                </button>
	              </div>
	            </div>
	          )}
	          {faceIdEnabled && (
	            <div className="vs-image-ratio-bar vs-image-faceid-weight">
	              <span className="vs-image-ratio-label">ID weight</span>
	              <input
	                type="range"
	                min={FACE_ID_WEIGHT_MIN}
	                max={FACE_ID_WEIGHT_MAX}
	                step={FACE_ID_WEIGHT_STEP}
	                value={faceIdWeight}
	                onChange={(e) => setFaceIdWeight(Number(e.target.value))}
	              />
	              <span className="vs-image-size-meta">{faceIdWeight.toFixed(2)} · PuLID giữ danh tính</span>
	            </div>
	          )}
	          <div className="vs-image-ratio-bar">
            <span className="vs-image-ratio-label">Khung hình</span>
            <div className="vs-ratio-row vs-image-ratio-row">
              {IMAGE_SIZE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`vs-ratio-btn${sizeId === p.id ? ' active' : ''}`}
                  title={p.label}
                  onClick={() => setSizeId(p.id)}
                >
                  {p.ratio}
                </button>
              ))}
            </div>
          </div>
          <div className="vs-image-ratio-bar vs-image-res-bar">
            <span className="vs-image-ratio-label">Độ phân giải</span>
            <div className="vs-ratio-row vs-image-ratio-row">
              {IMAGE_RESOLUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`vs-ratio-btn vs-res-btn${resolution === opt.id ? ' active' : ''}`}
                  title={`Xuất ảnh ${opt.label} — cạnh dài tối đa ${opt.longEdge}px`}
                  onClick={() => setResolution(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="vs-image-size-meta">
              {outputSize.resolutionLabel} · {outputSize.width}×{outputSize.height}
            </span>
          </div>
          <div className="vs-image-ratio-bar vs-image-variant-bar">
            <span className="vs-image-ratio-label">Biến thể</span>
            <div className="vs-ratio-row vs-image-ratio-row vs-image-variant-row" role="group" aria-label="Số biến thể ảnh">
              {IMAGE_VARIANT_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`vs-ratio-btn vs-variant-btn${variants === n ? ' active' : ''}`}
                  title={`Tạo ${n} phiên bản ảnh`}
                  onClick={() => setVariants(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate() } }}
            placeholder="Mô tả ảnh: phong cảnh Việt Nam, ánh sáng hoàng hôn, cinematic..."
            rows={4}
          />
          <div className="vs-composer-bar vs-image-composer-bar">
            <button
              type="button"
              className={`vs-bar-icon-btn vs-image-upload-btn${refImage ? ' has-ref' : ''}`}
              title={refImage ? 'Đổi ảnh tham chiếu' : 'Tải lên ảnh tham chiếu'}
              onClick={() => imageRef.current?.click()}
            >
              {refImage ? (
                <img src={refImage} alt="" className="vs-bar-ref-thumb" />
              ) : (
                <ImagePlus size={16} />
              )}
            </button>
            <button
              type="button"
              className={`vs-bar-pill${settingsOpen ? ' open' : ''}`}
              onClick={() => { setSettingsOpen((o) => !o); setRatioMenuOpen(false) }}
            >
              <SlidersHorizontal size={13} />
              <span>{model.label}</span>
              <ChevronDown size={12} className={settingsOpen ? 'vs-chevron-up' : ''} />
            </button>
            <div className="vs-param-wrap">
              <button
                type="button"
                className={`vs-param-chip${ratioMenuOpen ? ' open' : ''}`}
                onClick={() => { setRatioMenuOpen((o) => !o); setSettingsOpen(false) }}
              >
                {sizePreset.ratio}
                <ChevronDown size={12} />
              </button>
              {ratioMenuOpen && (
                <div className="vs-param-popover vs-image-ratio-popover" role="listbox">
                  {IMAGE_SIZE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`vs-param-opt${sizeId === p.id ? ' active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setSizeId(p.id); setRatioMenuOpen(false) }}
                    >
                      <span>{p.label}</span>
                      <small>{computeImageDimensions(p.ratio, resolution, modelId).width}×{computeImageDimensions(p.ratio, resolution, modelId).height}px</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="vs-param-wrap">
              <div className="vs-image-res-inline" role="group" aria-label="Độ phân giải">
                {IMAGE_RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`vs-param-chip vs-res-chip${resolution === opt.id ? ' active' : ''}`}
                    onClick={() => setResolution(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="vs-param-wrap">
              <div className="vs-image-variant-inline" role="group" aria-label="Biến thể">
                {IMAGE_VARIANT_COUNTS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`vs-param-chip vs-variant-chip${variants === n ? ' active' : ''}`}
                    title={`${n} biến thể`}
                    onClick={() => setVariants(n)}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
            </div>
            <div className="vs-transport-spacer" style={{ flex: 1 }} />
            <button type="button" className="vs-bar-send" disabled={loading || uploading || !prompt.trim()} onClick={generate}>
              {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            </button>
          </div>
          {uploading && (
            <p className="vs-image-upload-hint">Đang upload ảnh ref…</p>
          )}
        </div>
      </div>

      {previewIndex !== null && lastUrls[previewIndex] && (
        <StudioMediaPreviewModal
          url={lastUrls[previewIndex]}
          title={`Ảnh AI${lastUrls.length > 1 ? ` · biến thể #${previewIndex + 1}` : ''}`}
          onClose={() => setPreviewIndex(null)}
          onUseAsRef={() => applyRefFromUrl(lastUrls[previewIndex])}
        />
      )}
    </div>
  )
}
