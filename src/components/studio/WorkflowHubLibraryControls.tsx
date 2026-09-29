import { BarChart3, Search, SlidersHorizontal, Tag as TagIcon } from 'lucide-react'
import type { WorkflowDefinition } from '../../lib/workflows'
import type { WorkflowLibraryFilter, WorkflowSortMode } from './useWorkflowHubLibraryData'
import { WorkflowHubCollapsibleSection } from './WorkflowHubCollapsibleSection'

type WorkflowAnalyticsWindow = 'all' | '7d' | '30d'

type LibraryDashboardStats = {
  workflows: number
  favorites: number
  totalRuns: number
  successRate: number
  avgDurationMs: number
  failHigh: number
  slow: number
  stale: number
  lowUse: number
}

type Props = {
  folderLabel: string
  activeLibraryCollectionLabel: string
  activeLibraryFilterLabel: string
  analyticsWindowLabel: string
  libraryTagFilter: string
  libraryDashboardStats: LibraryDashboardStats
  formatDurationMs: (value: number) => string
  selectedVisibleWorkflowsCount: number
  selectedVisibleCustomWorkflowsCount: number
  selectAllVisibleWorkflowsAction: () => void
  clearWorkflowSelectionAction: () => void
  bulkFavoriteSelectionAction: () => void
  isBulkUpdating: boolean
  bulkSaveStarterSelectionAction: () => Promise<void>
  activeLibraryCollectionId: string
  bulkAddSelectionToCurrentCollectionAction: () => void
  bulkUpdateCustomSelectionAction: (
    actionLabel: string,
    updater: (workflow: WorkflowDefinition) => Partial<WorkflowDefinition>,
  ) => Promise<void>
  query: string
  setQuery: (value: string) => void
  visibleWorkflowCount: number
  analyticsWindow: WorkflowAnalyticsWindow
  setAnalyticsWindow: (value: WorkflowAnalyticsWindow) => void
  workflowSort: WorkflowSortMode
  setWorkflowSort: (value: WorkflowSortMode) => void
  libraryFilter: WorkflowLibraryFilter
  setLibraryFilter: (value: WorkflowLibraryFilter) => void
  workflowTagOptions: string[]
  setLibraryTagFilter: (value: string | ((current: string) => string)) => void
}

const FILTER_OPTIONS: Array<[WorkflowLibraryFilter, string]> = [
  ['all', 'Tất cả'],
  ['templates', 'Mẫu'],
  ['published', 'Đã xuất bản'],
  ['components', 'Thành phần'],
  ['image', 'Ảnh'],
  ['video', 'Video'],
  ['automation', 'Tự động hóa'],
  ['run_heavy', 'Chạy nhiều'],
  ['fail_high', 'Fail cao'],
  ['slow', 'Chậm'],
  ['stale', 'Cũ'],
  ['low_use', 'Ít dùng'],
]

export function WorkflowHubLibraryControls({
  folderLabel,
  activeLibraryCollectionLabel,
  activeLibraryFilterLabel,
  analyticsWindowLabel,
  libraryTagFilter,
  libraryDashboardStats,
  formatDurationMs,
  selectedVisibleWorkflowsCount,
  selectedVisibleCustomWorkflowsCount,
  selectAllVisibleWorkflowsAction,
  clearWorkflowSelectionAction,
  bulkFavoriteSelectionAction,
  isBulkUpdating,
  bulkSaveStarterSelectionAction,
  activeLibraryCollectionId,
  bulkAddSelectionToCurrentCollectionAction,
  bulkUpdateCustomSelectionAction,
  query,
  setQuery,
  visibleWorkflowCount,
  analyticsWindow,
  setAnalyticsWindow,
  workflowSort,
  setWorkflowSort,
  libraryFilter,
  setLibraryFilter,
  workflowTagOptions,
  setLibraryTagFilter,
}: Props) {
  return (
    <>
      <div className="wf-library-context">
        <span>Thư mục: {folderLabel}</span>
        <span>Bộ sưu tập: {activeLibraryCollectionLabel}</span>
        <span>Bộ lọc: {activeLibraryFilterLabel}</span>
        <span>Thống kê: {analyticsWindowLabel}</span>
        {libraryTagFilter && <span>Tag: #{libraryTagFilter}</span>}
      </div>
      <div className="wf-library-dashboard wf-library-dashboard-compact">
        <div className="wf-library-dashboard-card">
          <strong>{libraryDashboardStats.workflows}</strong>
          <span>Workflow đang hiển thị</span>
        </div>
        <div className="wf-library-dashboard-card">
          <strong>{libraryDashboardStats.favorites}</strong>
          <span>Yêu thích</span>
        </div>
        <div className="wf-library-dashboard-card">
          <strong>{libraryDashboardStats.totalRuns}</strong>
          <span>Tổng lượt chạy</span>
        </div>
        <div className="wf-library-dashboard-card">
          <strong>{libraryDashboardStats.successRate}%</strong>
          <span>Tỉ lệ thành công</span>
        </div>
      </div>

      {/* 2026-07-27e: 3 khoi "Thong ke chi tiet"/"Bo loc nang cao"/"Tag" truoc day dung the HTML
          native <details>/<summary> - Sep phan anh trong "lac hau", "bop hep nhung keo qua dai"
          (dung that: <details> la block-level mac dinh choan het chieu rong, chi co text + padding
          nho, khong icon/chevron/badge dem giong het cac khoi WorkflowHubCollapsibleSection dang
          dung khap noi khac trong sidebar). Doi sang dung chung 1 component de dong bo giao dien +
          co storageKey nen trang thai dong/mo duoc nho qua lan tai lai. */}
      <WorkflowHubCollapsibleSection
        title="Thống kê chi tiết"
        icon={<BarChart3 size={16} />}
        storageKey="notiagent.workflowLibrary.detailStats"
      >
        <div className="wf-library-dashboard">
          <div className="wf-library-dashboard-card">
            <strong>{formatDurationMs(libraryDashboardStats.avgDurationMs)}</strong>
            <span>Thời gian trung bình</span>
          </div>
          <div className="wf-library-dashboard-card">
            <strong>{libraryDashboardStats.failHigh}</strong>
            <span>Workflow lỗi cao</span>
          </div>
          <div className="wf-library-dashboard-card">
            <strong>{libraryDashboardStats.slow}</strong>
            <span>Workflow chậm</span>
          </div>
          <div className="wf-library-dashboard-card">
            <strong>{libraryDashboardStats.stale}</strong>
            <span>Workflow cũ</span>
          </div>
          <div className="wf-library-dashboard-card">
            <strong>{libraryDashboardStats.lowUse}</strong>
            <span>Workflow ít dùng</span>
          </div>
        </div>
      </WorkflowHubCollapsibleSection>

      {selectedVisibleWorkflowsCount > 0 && (
        <div className="wf-bulk-toolbar">
          <div className="wf-bulk-toolbar-meta">
            <strong>{selectedVisibleWorkflowsCount}</strong>
            <span>workflow đang chọn</span>
            <span>·</span>
            <span>{selectedVisibleCustomWorkflowsCount} workflow riêng</span>
          </div>
          <div className="wf-bulk-toolbar-actions">
            <button type="button" className="wf-secondary-btn" onClick={selectAllVisibleWorkflowsAction}>
              Chọn tất cả
            </button>
            <button type="button" className="wf-secondary-btn" onClick={clearWorkflowSelectionAction}>
              Bỏ chọn
            </button>
            <button
              type="button"
              className="wf-secondary-btn"
              disabled={selectedVisibleWorkflowsCount === 0}
              onClick={bulkFavoriteSelectionAction}
            >
              Yêu thích mục đã chọn
            </button>
            <button
              type="button"
              className="wf-secondary-btn"
              disabled={selectedVisibleWorkflowsCount === 0 || isBulkUpdating}
              onClick={() => {
                void bulkSaveStarterSelectionAction()
              }}
            >
              Lưu mẫu khởi đầu
            </button>
            {activeLibraryCollectionId !== 'all' && activeLibraryCollectionId !== 'favorites' && (
              <button
                type="button"
                className="wf-secondary-btn"
                disabled={selectedVisibleWorkflowsCount === 0}
                onClick={bulkAddSelectionToCurrentCollectionAction}
              >
                Thêm vào bộ sưu tập hiện tại
              </button>
            )}
            <button
              type="button"
              className="wf-secondary-btn"
              disabled={selectedVisibleCustomWorkflowsCount === 0 || isBulkUpdating}
              onClick={() => {
                void bulkUpdateCustomSelectionAction('Xuất bản hàng loạt', (workflow) => ({ published: !workflow.published }))
              }}
            >
              Bật/tắt xuất bản
            </button>
            <button
              type="button"
              className="wf-secondary-btn"
              disabled={selectedVisibleCustomWorkflowsCount === 0 || isBulkUpdating}
              onClick={() => {
                void bulkUpdateCustomSelectionAction('Thành phần hàng loạt', (workflow) => ({
                  component: !workflow.component,
                  componentName: !workflow.component ? workflow.componentName || workflow.name : workflow.componentName,
                }))
              }}
            >
              Bật/tắt thành phần
            </button>
          </div>
        </div>
      )}

      <div className="wf-toolbar">
        <div className="wf-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Tìm trong ${folderLabel.toLowerCase()}...`} />
        </div>
        <div className="wf-toolbar-meta">
          <span className="wf-panel-hint">{visibleWorkflowCount} workflow phù hợp</span>
          <label className="wf-sort-control">
            <span>Mốc thống kê</span>
            <select value={analyticsWindow} onChange={(event) => setAnalyticsWindow(event.target.value as WorkflowAnalyticsWindow)}>
              <option value="all">Toàn bộ</option>
              <option value="7d">7 ngày</option>
              <option value="30d">30 ngày</option>
            </select>
          </label>
          <label className="wf-sort-control">
            <span>Sắp xếp</span>
            <select value={workflowSort} onChange={(event) => setWorkflowSort(event.target.value as WorkflowSortMode)}>
              <option value="updated_desc">Mới cập nhật</option>
              <option value="name_asc">Tên A-Z</option>
              <option value="nodes_desc">Nhiều node nhất</option>
              <option value="runs_desc">Chạy nhiều nhất</option>
              <option value="success_desc">Tỉ lệ thành công cao</option>
              <option value="avg_duration_asc">Nhanh nhất</option>
            </select>
          </label>
        </div>
      </div>

      <WorkflowHubCollapsibleSection
        title="Bộ lọc nâng cao"
        icon={<SlidersHorizontal size={16} />}
        count={libraryFilter !== 'all' ? activeLibraryFilterLabel : undefined}
        storageKey="notiagent.workflowLibrary.advancedFilter"
      >
        <div className="wf-library-filters">
          {FILTER_OPTIONS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`wf-filter-chip${libraryFilter === value ? ' active' : ''}`}
              onClick={() => setLibraryFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </WorkflowHubCollapsibleSection>

      {workflowTagOptions.length > 0 && (
        <WorkflowHubCollapsibleSection
          title="Tag"
          icon={<TagIcon size={16} />}
          count={libraryTagFilter ? `#${libraryTagFilter}` : workflowTagOptions.length}
          storageKey="notiagent.workflowLibrary.tagFilter"
        >
          <div className="wf-library-tags">
            <button
              type="button"
              className={`wf-tag-chip${!libraryTagFilter ? ' active' : ''}`}
              onClick={() => setLibraryTagFilter('')}
            >
              Tất cả tag
            </button>
            {workflowTagOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`wf-tag-chip${libraryTagFilter === tag ? ' active' : ''}`}
                onClick={() => setLibraryTagFilter((current) => (current === tag ? '' : tag))}
              >
                #{tag}
              </button>
            ))}
          </div>
        </WorkflowHubCollapsibleSection>
      )}
    </>
  )
}
