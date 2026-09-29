import { Link2, Upload, Image as ImageIcon, Film, X } from 'lucide-react'
import type { StudioAsset } from '../../lib/studioAssetLibrary'

type PlusMenuProps = {
  open: boolean
  onClose: () => void
  onUploadImage: () => void
  onUploadVideo: () => void
  onAddLink: () => void
  onPickAsset: (asset: StudioAsset) => void
  assets: StudioAsset[]
}

export function StudioPlusMenu({
  open,
  onClose,
  onUploadImage,
  onUploadVideo,
  onAddLink,
  onPickAsset,
  assets = [],
}: PlusMenuProps) {
  if (!open) return null
  return (
    <div className="vs-asset-menu" role="menu">
      <button type="button" className="vs-asset-menu-item" onClick={() => { onAddLink(); onClose() }}>
        <Link2 size={16} /> Thêm đường liên kết
      </button>
      <button type="button" className="vs-asset-menu-item" onClick={() => { onUploadImage(); onClose() }}>
        <Upload size={16} /> Tải ảnh lên
      </button>
      <button type="button" className="vs-asset-menu-item" onClick={() => { onUploadVideo(); onClose() }}>
        <Film size={16} /> Tải video ref
      </button>
      {assets.length > 0 && (
        <>
          <div className="vs-asset-menu-divider" />
          <div className="vs-asset-menu-head">Tài sản đã tải</div>
          {assets.slice(0, 6).map((a) => (
            <button
              key={a.id}
              type="button"
              className="vs-asset-menu-item vs-asset-menu-pick"
              onClick={() => { onPickAsset(a); onClose() }}
            >
              {a.kind === 'image' ? <ImageIcon size={14} /> : a.kind === 'video' ? <Film size={14} /> : <Link2 size={14} />}
              <span>{a.name.slice(0, 28)}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

type MentionMenuProps = {
  open: boolean
  query: string
  assets: StudioAsset[]
  onPick: (asset: StudioAsset) => void
  onUpload: () => void
}

export function StudioMentionMenu({ open, query, assets = [], onPick, onUpload }: MentionMenuProps) {
  if (!open) return null
  const q = query.toLowerCase()
  const filtered = assets.filter((a) => !q || a.name.toLowerCase().includes(q))
  const images = filtered.filter((a) => a.kind === 'image')
  const others = filtered.filter((a) => a.kind !== 'image')

  return (
    <div className="vs-mention-menu" role="listbox">
      <div className="vs-mention-head">Tệp phương tiện đã tải lên</div>
      {filtered.length === 0 ? (
        <button type="button" className="vs-mention-upload" onClick={onUpload}>
          Tải tệp lên để nhắc @ nhân vật / bối cảnh…
        </button>
      ) : (
        <>
          {images.length > 0 && (
            <>
              <div className="vs-mention-sub">Ảnh đại diện / nhân vật</div>
              <div className="vs-mention-avatars">
                {images.slice(0, 8).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="vs-mention-thumb"
                    title={a.name}
                    onClick={() => onPick(a)}
                  >
                    {a.preview ? <img src={a.preview} alt="" /> : <ImageIcon size={18} />}
                  </button>
                ))}
              </div>
            </>
          )}
          {others.map((a) => (
            <button key={a.id} type="button" className="vs-asset-menu-item" onClick={() => onPick(a)}>
              {a.kind === 'video' ? <Film size={14} /> : <Link2 size={14} />}
              <span>{a.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}

export function StudioActiveToolBanner({
  label,
  meta,
  onClear,
}: {
  label: string
  meta: string
  onClear: () => void
}) {
  return (
    <div className="vs-tool-banner">
      <span><strong>{label}</strong> · {meta}</span>
      <button type="button" onClick={onClear} aria-label="Bỏ công cụ"><X size={14} /></button>
    </div>
  )
}
