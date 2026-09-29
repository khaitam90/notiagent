import { Star, Trash2, X } from 'lucide-react'
import type { WorkflowDefinition } from '../../lib/workflows'
import { WORKFLOW_TAG_PRESETS, WORKFLOW_USE_CASE_PRESETS } from './workflowHubPresets'
import { parseWorkflowMetadata, parseWorkflowTags } from './workflowHubData'
import type { WorkflowCollection, WorkflowRunStatsSummary } from './useWorkflowHubLibraryData'

type WorkflowHealthBadge = {
  key: string
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'muted'
}

type Props = {
  selectedLibraryWorkflow: WorkflowDefinition
  mediaLabel: (media: WorkflowDefinition['media']) => string
  libraryPreviewNameDraft: string
  setLibraryPreviewNameDraft: (value: string) => void
  libraryPreviewDescriptionDraft: string
  setLibraryPreviewDescriptionDraft: (value: string) => void
  toggleFavoriteWorkflow: (workflowId: string) => void
  favoriteWorkflowIds: string[]
  openWorkflow: (workflowId: string) => void
  quickUpdateWorkflowAction: (
    workflow: WorkflowDefinition,
    updates: Partial<WorkflowDefinition>,
  ) => Promise<void>
  saveLibraryPreviewOverviewAction: (workflow: WorkflowDefinition) => Promise<void>
  saveAsStarterAction: (workflow: WorkflowDefinition) => void
  cloneWorkflowAction: (workflow: WorkflowDefinition) => void
  relativeTime: (iso: string) => string
  healthBadges: WorkflowHealthBadge[]
  runStats: WorkflowRunStatsSummary | null | undefined
  formatDurationMs: (value: number) => string
  libraryPreviewTagInput: string
  setLibraryPreviewTagInput: (value: string | ((current: string) => string)) => void
  stringifyWorkflowTags: (tags: string[]) => string[]
  mergeWorkflowTags: (...groups: Array<string[] | null | undefined>) => string[]
  libraryPreviewMetadataDraft: string
  setLibraryPreviewMetadataDraft: (value: string) => void
  saveLibraryPreviewMetaAction: (workflow: WorkflowDefinition) => Promise<void>
  customCollections: WorkflowCollection[]
  toggleWorkflowInCollection: (collectionId: string, workflowId: string) => void
  libraryTagFilter: string
  setLibraryTagFilter: (value: string | ((current: string) => string)) => void
  prettyJson: (value: unknown) => string
  onClose: () => void
  onDelete: () => void
}

export function WorkflowHubLibraryPreview({
  selectedLibraryWorkflow,
  mediaLabel,
  libraryPreviewNameDraft,
  setLibraryPreviewNameDraft,
  libraryPreviewDescriptionDraft,
  setLibraryPreviewDescriptionDraft,
  toggleFavoriteWorkflow,
  favoriteWorkflowIds,
  openWorkflow,
  quickUpdateWorkflowAction,
  saveLibraryPreviewOverviewAction,
  saveAsStarterAction,
  cloneWorkflowAction,
  relativeTime,
  healthBadges,
  runStats,
  formatDurationMs,
  libraryPreviewTagInput,
  setLibraryPreviewTagInput,
  stringifyWorkflowTags,
  mergeWorkflowTags,
  libraryPreviewMetadataDraft,
  setLibraryPreviewMetadataDraft,
  saveLibraryPreviewMetaAction,
  customCollections,
  toggleWorkflowInCollection,
  libraryTagFilter,
  setLibraryTagFilter,
  prettyJson,
  onClose,
  onDelete,
}: Props) {
  return (
    <div className="wf-library-preview">
      <button
        type="button"
        className="wf-library-preview-close"
        onClick={onClose}
        aria-label="Đóng xem trước, quay lại danh sách workflow"
        title="Đóng xem trước"
      >
        <X size={16} />
      </button>
      <div className="wf-library-preview-head">
        <div>
          <div className="wf-card-top">
            <span className={`wf-media-badge media-${selectedLibraryWorkflow.media}`}>{mediaLabel(selectedLibraryWorkflow.media)}</span>
            <span className={`wf-template-badge${selectedLibraryWorkflow.category === 'template' ? ' is-template' : ''}`}>
              {selectedLibraryWorkflow.category === 'template'
                ? 'Mẫu'
                : selectedLibraryWorkflow.published
                  ? 'Đã xuất bản'
                  : 'Bản nháp'}
            </span>
            {selectedLibraryWorkflow.component && <span className="wf-template-badge is-component">Thành phần</span>}
          </div>
          {selectedLibraryWorkflow.category === 'custom' ? (
            <div className="wf-library-overview-editor">
              <input
                value={libraryPreviewNameDraft}
                onChange={(event) => setLibraryPreviewNameDraft(event.target.value)}
                placeholder="Tên workflow"
              />
              <textarea
                rows={3}
                value={libraryPreviewDescriptionDraft}
                onChange={(event) => setLibraryPreviewDescriptionDraft(event.target.value)}
                placeholder="Mô tả workflow"
              />
            </div>
          ) : (
            <>
              <h3>{selectedLibraryWorkflow.name}</h3>
              <p>{selectedLibraryWorkflow.description}</p>
            </>
          )}
        </div>
        <div className="wf-library-preview-actions">
          <button type="button" className="wf-secondary-btn" onClick={() => toggleFavoriteWorkflow(selectedLibraryWorkflow.id)}>
            <Star size={14} />
            {favoriteWorkflowIds.includes(selectedLibraryWorkflow.id) ? 'Bỏ yêu thích' : 'Yêu thích'}
          </button>
          <button type="button" className="wf-secondary-btn" onClick={() => openWorkflow(selectedLibraryWorkflow.id)}>
            Mở
          </button>
          {selectedLibraryWorkflow.category === 'custom' && (
            <>
              <button
                type="button"
                className="wf-secondary-btn"
                onClick={() =>
                  void quickUpdateWorkflowAction(selectedLibraryWorkflow, {
                    published: !selectedLibraryWorkflow.published,
                  })
                }
              >
                {selectedLibraryWorkflow.published ? 'Bỏ xuất bản' : 'Xuất bản'}
              </button>
              <button
                type="button"
                className="wf-secondary-btn"
                onClick={() =>
                  void quickUpdateWorkflowAction(selectedLibraryWorkflow, {
                    component: !selectedLibraryWorkflow.component,
                    componentName: !selectedLibraryWorkflow.component
                      ? selectedLibraryWorkflow.componentName || selectedLibraryWorkflow.name
                      : selectedLibraryWorkflow.componentName,
                  })
                }
              >
                {selectedLibraryWorkflow.component ? 'Bỏ thành phần' : 'Thành phần hóa'}
              </button>
              <button
                type="button"
                className="wf-primary-btn"
                onClick={() => {
                  void saveLibraryPreviewOverviewAction(selectedLibraryWorkflow)
                }}
              >
                Lưu tên/mô tả
              </button>
            </>
          )}
          <button type="button" className="wf-secondary-btn" onClick={() => saveAsStarterAction(selectedLibraryWorkflow)}>
            Lưu làm mẫu khởi đầu
          </button>
          <button type="button" className="wf-primary-btn" onClick={() => cloneWorkflowAction(selectedLibraryWorkflow)}>
            Nhân bản
          </button>
          {selectedLibraryWorkflow.category === 'custom' && (
            // 2026-07-28: Sep bao khong tim thay nut Xoa - vi trang danh sach Workflow tu dong
            // mo san panel "Xem truoc" (component nay) cho workflow moi cap nhat nhat, che het
            // danh sach that ben duoi (noi da co nut Xoa tren tung dong, xem WorkflowHubCards.tsx).
            // Nguoi dung thay panel nay dau tien, co du Luu/Nhan ban/Xuat ban nhung KHONG co Xoa
            // - them thang o day de khong con phai cuon xuong/dong panel moi xoa duoc.
            <button
              type="button"
              className="wf-secondary-btn danger"
              onClick={onDelete}
              title="Xóa workflow này"
            >
              <Trash2 size={14} />
              Xóa
            </button>
          )}
        </div>
      </div>
      <div className="wf-library-preview-meta">
        <span>{selectedLibraryWorkflow.nodes.length} node</span>
        <span>{selectedLibraryWorkflow.edges.length} liên kết</span>
        <span>Cập nhật {relativeTime(selectedLibraryWorkflow.updatedAt)}</span>
        {selectedLibraryWorkflow.sourceTemplateId && <span>Nguồn: {selectedLibraryWorkflow.sourceTemplateId}</span>}
      </div>
      <div className="wf-health-row">
        {healthBadges.map((badge) => (
          <span key={`${selectedLibraryWorkflow.id}-${badge.key}`} className={`wf-health-badge is-${badge.tone}`}>
            {badge.label}
          </span>
        ))}
      </div>
      {runStats && (
        <div className="wf-library-analytics">
          <div className="wf-library-analytics-item">
            <strong>{runStats.total}</strong>
            <span>Tổng lượt chạy</span>
          </div>
          <div className="wf-library-analytics-item">
            <strong>{runStats.success}</strong>
            <span>Thành công</span>
          </div>
          <div className="wf-library-analytics-item">
            <strong>{runStats.failed}</strong>
            <span>Thất bại</span>
          </div>
          <div className="wf-library-analytics-item">
            <strong>{runStats.success + runStats.failed > 0 ? `${Math.round((runStats.success / (runStats.success + runStats.failed)) * 100)}%` : '—'}</strong>
            <span>Tỉ lệ thành công</span>
          </div>
          <div className="wf-library-analytics-item">
            <strong>{formatDurationMs(runStats.avgDurationMs || 0)}</strong>
            <span>Thời gian trung bình</span>
          </div>
          <div className="wf-library-analytics-item">
            <strong>{runStats.lastRunAt ? relativeTime(runStats.lastRunAt) : '—'}</strong>
            <span>Lần chạy gần nhất</span>
          </div>
        </div>
      )}
      {selectedLibraryWorkflow.category === 'custom' && (
        <div className="wf-library-editor">
          <label className="wf-field">
            <span>Tag xem trước</span>
            <input
              value={libraryPreviewTagInput}
              onChange={(event) => setLibraryPreviewTagInput(event.target.value)}
              placeholder="mau-khoi-dau, anh, nhan-vat"
            />
          </label>
          <div className="wf-inline-presets">
            {WORKFLOW_TAG_PRESETS.map((tag) => {
              const currentTags = stringifyWorkflowTags(libraryPreviewTagInput.split(',').map((item) => item.trim()))
              const active = currentTags.includes(tag)
              return (
                <button
                  key={`${selectedLibraryWorkflow.id}-${tag}-preview`}
                  type="button"
                  className={`wf-tag-chip${active ? ' active' : ''}`}
                  onClick={() =>
                    setLibraryPreviewTagInput(
                      (active ? currentTags.filter((item) => item !== tag) : mergeWorkflowTags(currentTags, [tag])).join(', '),
                    )
                  }
                >
                  #{tag}
                </button>
              )
            })}
          </div>
          <label className="wf-field">
            <span>Metadata xem trước</span>
            <textarea
              rows={5}
              value={libraryPreviewMetadataDraft}
              onChange={(event) => setLibraryPreviewMetadataDraft(event.target.value)}
              placeholder={'{\n  "use_case": "character_video_pipeline"\n}'}
            />
          </label>
          <div className="wf-inline-presets">
            {WORKFLOW_USE_CASE_PRESETS.map((preset) => (
              <button
                key={`${selectedLibraryWorkflow.id}-${preset.useCase}`}
                type="button"
                className="wf-secondary-btn"
                onClick={() => {
                  const currentMetadata = libraryPreviewMetadataDraft.trim()
                  const parsed =
                    currentMetadata && (() => {
                      try {
                        const value = JSON.parse(currentMetadata) as unknown
                        return value && typeof value === 'object' && !Array.isArray(value)
                          ? (value as Record<string, unknown>)
                          : {}
                      } catch {
                        return {}
                      }
                    })()
                  setLibraryPreviewTagInput(
                    mergeWorkflowTags(
                      stringifyWorkflowTags(libraryPreviewTagInput.split(',').map((item) => item.trim())),
                      preset.tags,
                    ).join(', '),
                  )
                  setLibraryPreviewMetadataDraft(
                    JSON.stringify(
                      {
                        ...(parsed || {}),
                        use_case: preset.useCase,
                      },
                      null,
                      2,
                    ),
                  )
                }}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              className="wf-primary-btn"
              onClick={() => {
                void saveLibraryPreviewMetaAction(selectedLibraryWorkflow)
              }}
            >
              Lưu tags/meta
            </button>
          </div>
          {customCollections.length > 0 && (
            <div className="wf-inline-presets">
              {customCollections.map((collection) => {
                const active = collection.workflowIds.includes(selectedLibraryWorkflow.id)
                return (
                  <button
                    key={`${selectedLibraryWorkflow.id}-${collection.id}`}
                    type="button"
                    className={`wf-tag-chip${active ? ' active' : ''}`}
                    onClick={() => toggleWorkflowInCollection(collection.id, selectedLibraryWorkflow.id)}
                  >
                    {active ? '✓ ' : ''}
                    {collection.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {parseWorkflowTags(selectedLibraryWorkflow).length > 0 && (
        <div className="wf-tag-row">
          {parseWorkflowTags(selectedLibraryWorkflow).map((tag) => (
            <button
              key={`${selectedLibraryWorkflow.id}-${tag}`}
              type="button"
              className={`wf-tag-chip${libraryTagFilter === tag ? ' active' : ''}`}
              onClick={() => setLibraryTagFilter((current) => (current === tag ? '' : tag))}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
      {Object.keys(parseWorkflowMetadata(selectedLibraryWorkflow)).length > 0 && (
        <div className="wf-library-meta-grid">
          {Object.entries(parseWorkflowMetadata(selectedLibraryWorkflow)).map(([key, value]) => (
            <div key={`${selectedLibraryWorkflow.id}-${key}`} className="wf-library-meta-item">
              <strong>{key}</strong>
              <span>{typeof value === 'string' ? value : prettyJson(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
