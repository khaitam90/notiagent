import { useRef } from 'react'
import { AtSign, Loader2, Send } from 'lucide-react'
import { useStudioPromptMention } from '../../hooks/useStudioPromptMention'
import type { ProjectMediaItem } from '../../lib/studioProjectMedia'
import { StudioMentionMenu } from './StudioAssetMenus'
import StudioProjectMediaBar from './StudioProjectMediaBar'
import StudioPromptAttachments from './StudioPromptAttachments'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  loading?: boolean
  uploading?: boolean
  canSubmit?: boolean
  onSubmit: () => void
  onUploadClick: () => void
  hasUpload?: boolean
  extraBar?: React.ReactNode
  onAssetRegistered?: () => void
  projectId?: string
  onPickProjectAsset?: (item: ProjectMediaItem) => void
  onUploadDrive?: () => void
  /** image | video — giới hạn loại file từ bảng + */
  pickAcceptKind?: 'image' | 'video'
  /** Đã có StudioProjectMediaBar ở vùng ref — ẩn bản trùng trên prompt */
  hideProjectMediaBar?: boolean
}

export default function StudioPromptField({
  value,
  onChange,
  placeholder,
  rows = 3,
  loading = false,
  uploading = false,
  canSubmit = true,
  onSubmit,
  onUploadClick,
  hasUpload = false,
  extraBar,
  onAssetRegistered,
  projectId,
  onPickProjectAsset,
  onUploadDrive,
  pickAcceptKind,
  hideProjectMediaBar = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mentionWrapRef = useRef<HTMLDivElement>(null)

  const {
    assets,
    mentionOpen,
    mentionQuery,
    handlePromptChange,
    insertMention,
    openMentionPicker,
    refreshAssets,
    closeMention,
  } = useStudioPromptMention({ value, onChange, textareaRef })

  const projectMode = Boolean(projectId && onPickProjectAsset)

  return (
    <div className="spf-wrap" ref={mentionWrapRef}>
      {projectMode && !hideProjectMediaBar && projectId && onPickProjectAsset && (
        <div className="spmb-row-above">
          <StudioProjectMediaBar
            projectId={projectId}
            onPick={onPickProjectAsset}
            onUploadDevice={onUploadClick}
            onUploadDrive={onUploadDrive}
            acceptKind={pickAcceptKind}
          />
        </div>
      )}
      <div className="vs-composer-box">
        <StudioPromptAttachments value={value} />
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handlePromptChange(e.target.value, e.target.selectionStart)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (mentionOpen && mentionQuery) return
              closeMention()
              if (canSubmit && !loading && !uploading) onSubmit()
            }
            if (e.key === 'Escape' && mentionOpen) {
              e.preventDefault()
              closeMention()
            }
          }}
          onBlur={() => setTimeout(() => closeMention(), 150)}
          placeholder={placeholder}
          rows={rows}
        />

        {mentionOpen && (
          <div className="spf-mention-anchor">
            <StudioMentionMenu
              open
              query={mentionQuery}
              assets={assets}
              onPick={(a) => {
                insertMention(a)
                onAssetRegistered?.()
              }}
              onUpload={() => {
                closeMention()
                onUploadClick()
              }}
            />
          </div>
        )}

        <div className="vs-composer-bar">
          {!projectMode && (
            <button
              type="button"
              className={`vs-bar-btn${hasUpload ? ' active' : ''}`}
              title="Tải ảnh lên"
              onClick={onUploadClick}
            >
              <span className="vs-bar-plus-fallback">+</span>
            </button>
          )}
          <button
            type="button"
            className={`vs-bar-btn spf-at-btn${mentionOpen ? ' active' : ''}`}
            title="Nhắc tài liệu đã tải (@)"
            onClick={() => {
              refreshAssets()
              openMentionPicker()
            }}
          >
            <AtSign size={16} />
          </button>
          {extraBar}
          <div className="vs-transport-spacer" style={{ flex: 1 }} />
          <button
            type="button"
            className="vs-bar-send"
            disabled={!canSubmit || loading || uploading}
            onClick={onSubmit}
          >
            {loading || uploading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
