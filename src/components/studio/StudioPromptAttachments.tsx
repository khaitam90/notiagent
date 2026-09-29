import { Film, Image as ImageIcon } from 'lucide-react'
import { resolveMentionAssets } from '../../lib/studioPromptMentions'

type Props = {
  value: string
}

/** Hiển thị thumbnail tài liệu đã chèn qua @ trong prompt */
export default function StudioPromptAttachments({ value }: Props) {
  const assets = resolveMentionAssets(value)
  if (!assets.length) return null

  return (
    <div className="spf-attachments" aria-label="Tài liệu đã gắn trong kịch bản">
      {assets.map((a) => (
        <div key={a.id} className={`spf-attachment-chip spf-attachment-${a.kind}`} title={a.name}>
          <div className="spf-attachment-thumb">
            {a.kind === 'video' ? (
              <video src={a.url} muted playsInline preload="metadata" />
            ) : a.preview || a.url ? (
              <img src={a.preview || a.url} alt="" />
            ) : (
              <ImageIcon size={16} />
            )}
          </div>
          <span className="spf-attachment-name">{a.name}</span>
          {a.kind === 'video' && <Film size={11} className="spf-attachment-kind" />}
        </div>
      ))}
    </div>
  )
}
