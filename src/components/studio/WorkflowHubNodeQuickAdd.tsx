import { useEffect, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import type { WorkflowNodeType } from '../../lib/workflows'
import { NODE_CATEGORIES, NODE_CATEGORY_ICON, NODE_TYPE_CATEGORY, type NodeLibraryItem } from './workflowHubUtils'

// 2026-07-26i: bang tim-kiem-them-node - lay cam hung tu co che search+tab-danh-muc cua app tham khao
// nhung KHONG sao chep nguyen xi: danh muc duoc thiet ke rieng theo 17 loai node thuc te cua Noti
// (xem NODE_CATEGORIES/NODE_TYPE_CATEGORY trong workflowHubUtils.tsx), va component nay dung duoc o
// 2 noi - popover noi tren canvas (variant="popover", nut "+ Them node") la noi DUY NHAT de them node,
// va inline (variant="inline") chi dung lam preview/tai lieu, khong con render day trong sidebar nua.
//
// 2026-07-26j: Sep phan hoi 2 diem sau khi xem lai UI cua app tham khao (khong sao chep nguyen xi,
// chi lay cam hung ve co che):
// 1) Bo het header/vien toi cua popover - o tim kiem xuat hien NHE, khong che canvas phia sau (giong
//    tham khao: khong co lop den phu toan man hinh), dong bang click-ra-ngoai hoac phim Escape.
// 2) Doi tab danh muc tu text-chip (chiem nhieu ngang) sang icon-only + tooltip (title) - gon hon,
//    dung dung tinh than "nhieu tinh nang nhung nhin don gian" ma Sep yeu cau.
type Props = {
  items: NodeLibraryItem[]
  isEditable: boolean
  onAddNode: (type: WorkflowNodeType) => void
  variant?: 'inline' | 'popover'
  onRequestClose?: () => void
}

export function WorkflowHubNodeQuickAdd({ items, isEditable, onAddNode, variant = 'inline', onRequestClose }: Props) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    if (variant !== 'popover' || !onRequestClose) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [variant, onRequestClose])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      const category = NODE_TYPE_CATEGORY[item.type]
      if (activeCategory !== 'all' && category !== activeCategory) return false
      if (!query) return true
      return (
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
      )
    })
  }, [items, search, activeCategory])

  return (
    <div className={`wf-node-quickadd wf-node-quickadd-${variant}`}>
      <div className="wf-node-quickadd-search">
        <Search size={14} />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm node theo tên hoặc mô tả..."
          autoFocus={variant === 'popover'}
        />
        {search && (
          <button type="button" className="wf-node-quickadd-clear" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm">
            <X size={12} />
          </button>
        )}
      </div>
      <div className="wf-node-quickadd-tabs">
        <button
          type="button"
          className={`wf-node-quickadd-tab${activeCategory === 'all' ? ' active' : ''}`}
          onClick={() => setActiveCategory('all')}
          title="Tất cả"
          aria-label="Tất cả"
        >
          {NODE_CATEGORY_ICON.all}
        </button>
        {NODE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`wf-node-quickadd-tab${activeCategory === category.id ? ' active' : ''}`}
            onClick={() => setActiveCategory(category.id)}
            title={category.label}
            aria-label={category.label}
          >
            {NODE_CATEGORY_ICON[category.id]}
          </button>
        ))}
      </div>
      <div className="wf-node-quickadd-list">
        {filtered.length === 0 && <p className="wf-panel-hint">Không tìm thấy node phù hợp, thử từ khóa khác.</p>}
        {filtered.map((item) => (
          <button
            key={item.type}
            type="button"
            className="wf-node-quickadd-item"
            disabled={!isEditable}
            onClick={() => {
              onAddNode(item.type)
              if (variant === 'popover') onRequestClose?.()
            }}
          >
            <span className="wf-node-quickadd-icon" style={{ color: item.color, background: `${item.color}20` }}>
              {item.icon}
            </span>
            <span className="wf-node-quickadd-text">
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
