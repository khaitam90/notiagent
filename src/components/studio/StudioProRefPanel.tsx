import { useRef } from 'react'
import { Film, Image as ImageIcon, Loader2, Music, Upload, X } from 'lucide-react'
import type { ProRefLayout } from '../../lib/videoModelRefLayout'
import { PRO_REF_LAYOUT_META } from '../../lib/videoModelRefLayout'
import type { ProMediaItem } from '../../lib/studioProMedia'
import { SEEDANCE_MAX_IMAGES } from '../../lib/studioProMedia'
import type { ProjectMediaItem } from '../../lib/studioProjectMedia'
import StudioProjectMediaBar from './StudioProjectMediaBar'

type KeyframeSlot = {
  label: string
  hint: string
  preview: string | null
  onPick: () => void
  onClear: () => void
}

type Props = {
  layout: Exclude<ProRefLayout, 'standard'>
  uploading?: boolean
  projectId?: string
  onPickProjectAsset?: (item: ProjectMediaItem) => void
  onUploadDrive?: () => void
  onUploadDevice?: () => void
  /** Seedance — danh sách media đã tải */
  mixItems?: ProMediaItem[]
  onMixFiles?: (files: FileList | null) => void
  onRemoveMixItem?: (id: string) => void
  /** Kling 3.0 — khung đầu / cuối */
  startFrame?: KeyframeSlot
  endFrame?: KeyframeSlot
}

function MixThumb({ item, onRemove }: { item: ProMediaItem; onRemove: () => void }) {
  return (
    <div className={`spref-mix-thumb spref-mix-thumb-${item.kind}`}>
      {item.kind === 'image' && <img src={item.preview} alt={item.name} />}
      {item.kind === 'video' && <video src={item.preview} muted playsInline />}
      {item.kind === 'audio' && (
        <div className="spref-audio-thumb">
          <Music size={22} />
        </div>
      )}
      <span className="spref-mix-kind">{item.kind === 'image' ? 'Ảnh' : item.kind === 'video' ? 'Video' : 'Audio'}</span>
      <button type="button" className="spref-mix-remove" onClick={onRemove} aria-label="Xóa">
        <X size={12} />
      </button>
    </div>
  )
}

function KeyframeBox({ slot }: { slot: KeyframeSlot }) {
  if (slot.preview) {
    return (
      <div className="spref-keyframe has-media">
        <div className="spref-keyframe-head">
          <span>{slot.label}</span>
          <span className="spref-opt-tag">Tuỳ chọn</span>
        </div>
        <div className="spref-keyframe-preview">
          <img src={slot.preview} alt={slot.label} />
        </div>
        <div className="spref-keyframe-actions">
          <button type="button" onClick={slot.onPick}>Đổi ảnh</button>
          <button type="button" className="muted" onClick={slot.onClear}>Xóa</button>
        </div>
      </div>
    )
  }

  return (
    <button type="button" className="spref-keyframe empty" onClick={slot.onPick}>
      <div className="spref-keyframe-head">
        <span>{slot.label}</span>
        <span className="spref-opt-tag">Tuỳ chọn</span>
      </div>
      <div className="spref-drop-icons spref-drop-icons-sm">
        <ImageIcon size={18} />
      </div>
      <strong>Upload media</strong>
      <small>Image</small>
      <span className="spref-keyframe-hint">{slot.hint}</span>
    </button>
  )
}

export default function StudioProRefPanel({
  layout,
  uploading = false,
  projectId,
  onPickProjectAsset,
  onUploadDrive,
  onUploadDevice,
  mixItems = [],
  onMixFiles,
  onRemoveMixItem,
  startFrame,
  endFrame,
}: Props) {
  const mixInputRef = useRef<HTMLInputElement>(null)
  const meta = PRO_REF_LAYOUT_META[layout]
  const imageCount = mixItems.filter((i) => i.kind === 'image').length

  return (
    <div className={`spref-panel spref-${layout}`}>
      <div className="spref-head">
        <div>
          <strong>{meta.title}</strong>
          <p>{meta.hint}</p>
        </div>
        {layout === 'seedance-mix' && (
          <span className="spref-limit-badge">Tối đa {SEEDANCE_MAX_IMAGES} ảnh</span>
        )}
      </div>

      {projectId && onPickProjectAsset && (
        <div className="spref-project-bar">
          <StudioProjectMediaBar
            projectId={projectId}
            onPick={onPickProjectAsset}
            onUploadDevice={onUploadDevice ?? (() => mixInputRef.current?.click())}
            onUploadDrive={onUploadDrive}
            compact
          />
        </div>
      )}

      {layout === 'seedance-mix' && (
        <>
          <button
            type="button"
            className="spref-mix-drop"
            onClick={() => mixInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 size={22} className="spin" />
            ) : (
              <div className="spref-drop-icons">
                <ImageIcon size={20} />
                <Film size={20} />
                <Music size={20} />
              </div>
            )}
            <strong>Upload media</strong>
            <small>Image, Video, Audio</small>
            <span className="spref-mix-note">
              Model tự động tạo video — vật thể chuyển động theo giai điệu, nhép miệng theo âm thanh
            </span>
            <Upload size={14} className="spref-drop-upload-badge" />
          </button>

          {mixItems.length > 0 && (
            <div className="spref-mix-grid">
              {mixItems.map((item) => (
                <MixThumb
                  key={item.id}
                  item={item}
                  onRemove={() => onRemoveMixItem?.(item.id)}
                />
              ))}
            </div>
          )}

          {imageCount > 0 && (
            <p className="spref-mix-count">{imageCount}/{SEEDANCE_MAX_IMAGES} ảnh · {mixItems.length} tài liệu</p>
          )}
        </>
      )}

      {layout === 'kling-keyframes' && startFrame && endFrame && (
        <div className="spref-keyframes">
          <KeyframeBox slot={startFrame} />
          <KeyframeBox slot={endFrame} />
        </div>
      )}

      <input
        ref={mixInputRef}
        type="file"
        accept={layout === 'seedance-mix'
          ? 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4'
          : 'image/jpeg,image/png,image/webp,image/gif'}
        multiple={layout === 'seedance-mix'}
        hidden
        onChange={(e) => {
          onMixFiles?.(e.target.files)
          if (mixInputRef.current) mixInputRef.current.value = ''
        }}
      />
    </div>
  )
}
