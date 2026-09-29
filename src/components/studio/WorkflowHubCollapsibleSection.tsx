import { ChevronDown } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

type Props = {
  title: string
  icon?: ReactNode
  summary?: string
  count?: number | string
  defaultOpen?: boolean
  /** Visual modifier for a section nested inside a parent group (indent, lighter card). */
  nested?: boolean
  /** When set, open/closed state persists across visits via localStorage. */
  storageKey?: string
  children: ReactNode
}

function readStoredOpen(storageKey: string | undefined, fallback: boolean) {
  if (!storageKey) return fallback
  try {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === '1') return true
    if (stored === '0') return false
  } catch {
    // ignore local storage errors
  }
  return fallback
}

export function WorkflowHubCollapsibleSection({
  title,
  icon,
  summary,
  count,
  defaultOpen = false,
  nested = false,
  storageKey,
  children,
}: Props) {
  const [open, setOpen] = useState(() => readStoredOpen(storageKey, defaultOpen))

  useEffect(() => {
    if (!storageKey) return
    try {
      window.localStorage.setItem(storageKey, open ? '1' : '0')
    } catch {
      // ignore local storage errors
    }
  }, [storageKey, open])

  return (
    <section
      className={`wf-panel-card wf-collapsible${open ? ' is-open' : ''}${nested ? ' wf-collapsible-nested' : ''}`}
    >
      {/* 2026-07-27f: Sep phan anh "mo ra duoc nhung khong thay nut de thu gon lai" cho khoi
          "Workflow mẫu". Da tu kiem tra bang Playwright: co che toggle (bam cung 1 nut nay lan nua
          se dong lai) hoat dong dung, header cung khong bi cuon khuat khoi vung nhin sau khi mo
          rong. Nhieu kha nang la do khong ro rang "bam LAI vao chinh dong tieu de nay la dong lai"
          - khong co dau hieu rieng bao "bam de dong". Them title (tooltip) + aria-label dong theo
          trang thai open/closed de ro rang hon, khong doi lai co che (co che dang dung). */}
      <button
        type="button"
        className="wf-collapsible-head"
        onClick={() => setOpen((current) => !current)}
        title={open ? 'Bấm để thu gọn lại' : 'Bấm để mở rộng'}
        aria-expanded={open}
      >
        <span className="wf-collapsible-title">
          {icon}
          <span>
            <strong>{title}</strong>
            {summary && <small>{summary}</small>}
          </span>
        </span>
        <span className="wf-collapsible-meta">
          {count !== undefined && <em>{count}</em>}
          <ChevronDown size={16} className="wf-collapsible-icon" />
        </span>
      </button>
      {open && <div className="wf-collapsible-body">{children}</div>}
    </section>
  )
}
