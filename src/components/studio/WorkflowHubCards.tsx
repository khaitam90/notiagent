import { useState } from 'react'
import { Boxes, ChevronRight, Copy, Globe, Link2, Star, Trash2, Wand2 } from 'lucide-react'
import type { WorkflowDefinition, WorkflowMedia } from '../../lib/workflows'
import { parseWorkflowTags } from './workflowHubData'
import type { WorkflowRunStatsSummary } from './useWorkflowHubLibraryData'

type WorkflowHealthBadge = {
  key: string
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'muted'
}

type WorkflowHubCardsProps = {
  workflows: WorkflowDefinition[]
  workflowRunStatsById: Map<string, WorkflowRunStatsSummary>
  selectedWorkflowIds: string[]
  favoriteWorkflowIds: string[]
  mediaLabel: (media: WorkflowMedia) => string
  relativeTime: (iso: string) => string
  formatDurationMs: (value: number) => string
  getSuccessRate: (stats: WorkflowRunStatsSummary | null | undefined) => number | null
  getHealthBadges: (
    workflow: WorkflowDefinition,
    stats: WorkflowRunStatsSummary | null | undefined,
  ) => WorkflowHealthBadge[]
  onOpenWorkflow: (id: string) => void
  onToggleWorkflowSelection: (id: string) => void
  onToggleFavoriteWorkflow: (id: string) => void
  onPreviewWorkflow: (id: string) => void
  onSaveStarter: (workflow: WorkflowDefinition) => void | Promise<void>
  onCloneWorkflow: (workflow: WorkflowDefinition) => void | Promise<void>
  onQuickUpdateWorkflow: (workflow: WorkflowDefinition, patch: Partial<WorkflowDefinition>) => void | Promise<void>
  onDeleteWorkflow: (workflow: WorkflowDefinition) => void | Promise<void>
}

// 2026-07-26p: truoc day moi workflow la 1 the day dac (tieu de + mo ta + tag + node/lien ket +
// health badge + stat + 8 nut hanh dong) nhoi trong 1 o luoi hep ~300px - voi 26 workflow hien
// cung luc, noi dung tran/de nhau that (Sep phan anh "co nhieu muc bi che"). Doi sang dang danh
// sach: moi workflow 1 dong gon (badge loai + ten + meta ngan), bam mui ten moi xoe phan chi tiet
// (mo ta, tag, health badge, stat, day du nut hanh dong) - dung y Sep de xuat "khong du dien tich
// thi lam nut dang danh sach, bam vao moi xoe ra cho gon".
export function WorkflowHubCards({
  workflows,
  workflowRunStatsById,
  selectedWorkflowIds,
  favoriteWorkflowIds,
  mediaLabel,
  relativeTime,
  formatDurationMs,
  getSuccessRate,
  getHealthBadges,
  onOpenWorkflow,
  onToggleWorkflowSelection,
  onToggleFavoriteWorkflow,
  onPreviewWorkflow,
  onSaveStarter,
  onCloneWorkflow,
  onQuickUpdateWorkflow,
  onDeleteWorkflow,
}: WorkflowHubCardsProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="wf-card-list">
      {workflows.map((workflow) => {
        const stats = workflowRunStatsById.get(workflow.id)
        const successRate = getSuccessRate(stats)
        const healthBadges = getHealthBadges(workflow, stats)
        const selected = selectedWorkflowIds.includes(workflow.id)
        const isFavorite = favoriteWorkflowIds.includes(workflow.id)
        const tags = parseWorkflowTags(workflow)
        const expanded = expandedIds.has(workflow.id)
        const statusLabel = workflow.category === 'template' ? 'Mẫu' : workflow.published ? 'Đã xuất bản' : 'Bản nháp'
        return (
          <article key={workflow.id} className={`wf-card${selected ? ' is-selected' : ''}${expanded ? ' is-expanded' : ''}`}>
            <div className="wf-card-row">
              <button
                type="button"
                className="wf-card-expand-toggle"
                onClick={() => toggleExpanded(workflow.id)}
                aria-label={expanded ? 'Thu gọn chi tiết' : 'Xem chi tiết'}
                aria-expanded={expanded}
              >
                <ChevronRight size={15} className="wf-card-expand-icon" />
              </button>
              <span className={`wf-media-badge media-${workflow.media}`}>{mediaLabel(workflow.media)}</span>
              <span className={`wf-template-badge${workflow.category === 'template' ? ' is-template' : ''}`}>{statusLabel}</span>
              {workflow.component && <span className="wf-template-badge is-component">Thành phần</span>}
              <button type="button" className="wf-card-row-title" onClick={() => onOpenWorkflow(workflow.id)}>
                {workflow.name}
              </button>
              <button
                type="button"
                className={`wf-card-row-fav${isFavorite ? ' is-active' : ''}`}
                onClick={() => onToggleFavoriteWorkflow(workflow.id)}
                aria-label={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
              >
                <Star size={14} />
              </button>
              {workflow.category === 'custom' && (
                // 2026-07-28: Sep bao (1) nut Xoa trong khung "Xem truoc" luon xoa NHAM workflow
                // dau tien trong danh sach - dung THAT: khung do doc "selectedLibraryWorkflow",
                // gia tri nay CHI doi khi bam nut "Xem truoc" trong phan xoe ra, mac dinh fallback
                // ve sortedVisibleWorkflows[0] (xem useWorkflowHubLibraryData.ts) - Sep chua bao
                // gio doi duoc preview sang dung workflow muon xoa nen luon dinh vao cai dau tien.
                // (2) bam vao dong workflow de mo rong (mui ten ChevronRight 15px, rat nho, nam
                // sat nut ten workflow rong hon nhieu) de "di chuyen chuot den" thao tac de trung
                // nham nut ten (wf-card-row-title) -> mo thang vao canvas editor ngay lap tuc.
                // Fix goc: them han 1 nut Xoa rieng, luon hien NGAY TREN DONG THU GON (khong can
                // bam mui ten mo rong / khong can qua buoc "Xem truoc" nua), goi thang
                // onDeleteWorkflow(workflow) dung theo workflow CUA CHINH DONG DO - khong con phu
                // thuoc bien "dang xem truoc" toan cuc nua, khong con co the xoa nham workflow
                // khac, va khong con phai co gang bam trung 1 icon nho.
                <button
                  type="button"
                  className="wf-card-row-delete"
                  onClick={(event) => {
                    event.stopPropagation()
                    void onDeleteWorkflow(workflow)
                  }}
                  aria-label={`Xóa workflow ${workflow.name}`}
                  title="Xóa workflow này"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {expanded && (
              <div className="wf-card-expanded">
                <p>{workflow.description}</p>
                {tags.length > 0 && (
                  <div className="wf-tag-row">
                    {tags.slice(0, 4).map((tag) => (
                      <span key={`${workflow.id}-${tag}`} className="wf-tag-chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="wf-card-meta">
                  <span>{workflow.nodes.length} node</span>
                  <span>{workflow.edges.length} liên kết</span>
                  <span>Cập nhật {relativeTime(workflow.updatedAt)}</span>
                </div>
                {healthBadges.length > 0 && (
                  <div className="wf-health-row">
                    {healthBadges.map((badge) => (
                      <span key={`${workflow.id}-${badge.key}`} className={`wf-health-badge is-${badge.tone}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                )}
                {stats && (
                  <div className="wf-card-metrics">
                    <span>Lượt chạy {stats.total}</span>
                    <span>OK {successRate !== null ? `${successRate}%` : '—'}</span>
                    <span>TB {formatDurationMs(stats.avgDurationMs || 0)}</span>
                  </div>
                )}
                <div className="wf-card-actions">
                  <button type="button" onClick={() => onToggleWorkflowSelection(workflow.id)}>
                    {selected ? 'Bỏ chọn' : 'Chọn'}
                  </button>
                  <button type="button" onClick={() => onPreviewWorkflow(workflow.id)}>
                    <Link2 size={14} />
                    Xem trước
                  </button>
                  <button type="button" onClick={() => void onSaveStarter(workflow)}>
                    <Wand2 size={14} />
                    Lưu mẫu khởi đầu
                  </button>
                  <button type="button" onClick={() => void onCloneWorkflow(workflow)}>
                    <Copy size={14} />
                    Nhân bản
                  </button>
                  {workflow.category === 'custom' && (
                    <>
                      <button
                        type="button"
                        onClick={() => void onQuickUpdateWorkflow(workflow, { published: !workflow.published })}
                      >
                        <Globe size={14} />
                        {workflow.published ? 'Bỏ xuất bản' : 'Xuất bản'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void onQuickUpdateWorkflow(workflow, {
                            component: !workflow.component,
                            componentName: !workflow.component ? workflow.componentName || workflow.name : workflow.componentName,
                          })
                        }
                      >
                        <Boxes size={14} />
                        {workflow.component ? 'Bỏ thành phần' : 'Thành phần hóa'}
                      </button>
                    </>
                  )}
                  {workflow.category === 'custom' && (
                    <button type="button" className="danger" onClick={() => void onDeleteWorkflow(workflow)}>
                      <Trash2 size={14} />
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
