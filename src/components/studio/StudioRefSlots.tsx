import { Film, Image as ImageIcon, Upload, X } from 'lucide-react'
import type { RefSlotMode } from '../../lib/studioRefTypes'

export type RefGalleryItem = {
  id: string
  url: string
  name?: string
}

type SlotProps = {
  mode: RefSlotMode
  kind: 'image' | 'video'
  label: string
  hint: string
  preview: string | null
  onPick: () => void
  onClear: () => void
  gallery?: RefGalleryItem[]
  activeGalleryId?: string | null
  onGallerySelect?: (id: string) => void
  onGalleryRemove?: (id: string) => void
}

function RefSlot({
  mode,
  kind,
  label,
  hint,
  preview,
  onPick,
  onClear,
  gallery,
  activeGalleryId,
  onGallerySelect,
  onGalleryRemove,
}: SlotProps) {
  if (mode === 'none') return null
  const required = mode === 'required'
  const Icon = kind === 'image' ? ImageIcon : Film

  if (preview) {
    return (
      <div className={`vs-ref-slot has-media${required ? ' required' : ''}`}>
        <div className="vs-ref-slot-head">
          <span>{label}{required && <em className="vs-ref-req">*</em>}</span>
          <button type="button" className="vs-ref-slot-clear" onClick={onClear} aria-label="Xóa">
            <X size={14} />
          </button>
        </div>
        <div className={`vs-ref-slot-preview${kind === 'video' ? ' video' : ''}`}>
          {kind === 'image' ? (
            <img src={preview} alt={label} />
          ) : (
            <video src={preview} muted playsInline controls />
          )}
        </div>
        {kind === 'image' && gallery && gallery.length > 0 && (
          <div className="vs-ref-gallery" aria-label="Danh sách ảnh tham chiếu">
            {gallery.map((item) => (
              <div
                key={item.id}
                className={`vs-ref-gallery-item${item.id === activeGalleryId ? ' active' : ''}`}
              >
                <button
                  type="button"
                  className="vs-ref-gallery-thumb"
                  title={item.name || 'Ảnh tham chiếu'}
                  onClick={() => onGallerySelect?.(item.id)}
                >
                  <img src={item.url} alt={item.name || 'Ảnh tham chiếu'} />
                </button>
                {onGalleryRemove && (
                  <button
                    type="button"
                    className="vs-ref-gallery-remove"
                    aria-label={`Xóa ${item.name || 'ảnh tham chiếu'}`}
                    onClick={() => onGalleryRemove(item.id)}
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="vs-ref-gallery-add" onClick={onPick} aria-label="Thêm ảnh tham chiếu">
              <Upload size={16} />
            </button>
          </div>
        )}
        <button type="button" className="vs-ref-slot-replace" onClick={onPick}>
          Đổi {kind === 'image' ? 'ảnh' : 'video'}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`vs-ref-slot empty${required ? ' required' : ''}`}
      onClick={onPick}
    >
      <div className="vs-ref-slot-icon">
        <Icon size={20} />
        <Upload size={12} className="vs-ref-slot-upload-badge" />
      </div>
      <strong>
        {label}
        {required && <em className="vs-ref-req"> *</em>}
      </strong>
      <small>{hint}</small>
      {!required && <span className="vs-ref-optional-tag">Tuỳ chọn</span>}
    </button>
  )
}

type Props = {
  layout?: 'motion'
  /** Kling: video chuyển động trước, ảnh nhân vật sau */
  videoFirst?: boolean
  image?: Omit<SlotProps, 'kind'> & { mode: RefSlotMode }
  video?: Omit<SlotProps, 'kind'> & { mode: RefSlotMode }
}

export default function StudioRefSlots({ layout, videoFirst, image, video }: Props) {
  const showImage = image && image.mode !== 'none'
  const showVideo = video && video.mode !== 'none'
  if (!showImage && !showVideo) return null

  const layoutClass = showImage && showVideo
    ? (layout === 'motion' ? ' dual motion' : ' dual')
    : ''

  const videoSlot = showVideo ? <RefSlot kind="video" {...video} /> : null
  const imageSlot = showImage ? <RefSlot kind="image" {...image} /> : null

  return (
    <div className={`vs-ref-slots${layoutClass}${videoFirst ? ' video-first' : ''}`}>
      {videoFirst ? (
        <>
          {videoSlot}
          {imageSlot}
        </>
      ) : (
        <>
          {imageSlot}
          {videoSlot}
        </>
      )}
    </div>
  )
}
