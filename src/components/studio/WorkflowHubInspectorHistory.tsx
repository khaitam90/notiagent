import { PlaySquare, Save } from 'lucide-react'
import type { WorkflowDefinition, WorkflowRun, WorkflowVersion } from '../../lib/workflows'

type TraceItemLike = Record<string, unknown> | null | undefined

type WorkflowHubInspectorHistoryProps = {
  draftWorkflow: WorkflowDefinition
  isEditable: boolean
  versionsLoading: boolean
  workflowVersions: WorkflowVersion[]
  relativeTime: (iso: string) => string
  restoreVersionAction: (version: WorkflowVersion) => void | Promise<void>
  selectedRun: WorkflowRun | null
  selectedRunTrace: TraceItemLike[]
  selectedTraceNodeId: string | null
  setSelectedTraceNodeId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>
  selectedTraceItem: TraceItemLike
  selectedRunState: unknown
  statusClass: (status: WorkflowRun['status']) => string
  statusLabel: (status: WorkflowRun['status']) => string
  prettyJson: (value: unknown) => string
}

export function WorkflowHubInspectorHistory({
  draftWorkflow,
  isEditable,
  versionsLoading,
  workflowVersions,
  relativeTime,
  restoreVersionAction,
  selectedRun,
  selectedRunTrace,
  selectedTraceNodeId,
  setSelectedTraceNodeId,
  setSelectedNodeId,
  selectedTraceItem,
  selectedRunState,
  statusClass,
  statusLabel,
  prettyJson,
}: WorkflowHubInspectorHistoryProps) {
  return (
    <>
      <div className="wf-panel-card">
        <div className="wf-panel-card-head">
          <Save size={16} />
          <strong>Lịch sử phiên bản</strong>
        </div>

        {draftWorkflow.category !== 'custom' ? (
          <p className="wf-panel-hint">Mẫu hệ thống không có lịch sử phiên bản riêng.</p>
        ) : versionsLoading ? (
          <p className="wf-panel-hint">Đang tải lịch sử phiên bản...</p>
        ) : workflowVersions.length === 0 ? (
          <p className="wf-panel-hint">Chưa có snapshot phiên bản nào.</p>
        ) : (
          <div className="wf-version-list">
            {workflowVersions.slice(0, 12).map((version) => (
              <article key={version.id} className="wf-version-item">
                <div className="wf-run-item-head">
                  <strong>{relativeTime(version.createdAt)}</strong>
                  <small>{version.note || 'Đã lưu thay đổi'}</small>
                </div>
                <p className="wf-panel-hint">
                  {version.component ? `Thành phần: ${version.componentName || version.workflowName}` : version.workflowName}
                </p>
                {isEditable && (
                  <button type="button" className="wf-secondary-btn" onClick={() => void restoreVersionAction(version)}>
                    Khôi phục phiên bản này
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="wf-panel-card">
        <div className="wf-panel-card-head">
          <PlaySquare size={16} />
          <strong>Trình xem lượt chạy</strong>
        </div>

        {!selectedRun ? (
          <p className="wf-panel-hint">Chọn hoặc chạy một workflow để xem dấu vết theo node.</p>
        ) : (
          <>
            <div className="wf-run-inspector-head">
              <span className={`wf-status-badge ${statusClass(selectedRun.status)}`}>{statusLabel(selectedRun.status)}</span>
              <small>{relativeTime(selectedRun.createdAt)}</small>
            </div>
            <p className="wf-panel-hint">{selectedRun.message || 'Không có mô tả lượt chạy.'}</p>

            {selectedRunTrace.length > 0 ? (
              <div className="wf-trace-list">
                {selectedRunTrace.map((item, index) => (
                  <button
                    key={`${String(item?.nodeId || 'node')}-${index}`}
                    type="button"
                    className={`wf-trace-item${selectedTraceNodeId === String(item?.nodeId || '') ? ' active' : ''}`}
                    onClick={() => {
                      const nodeId = String(item?.nodeId || '')
                      setSelectedTraceNodeId(nodeId)
                      if (nodeId) setSelectedNodeId(nodeId)
                    }}
                  >
                    <strong>{String(item?.label || item?.nodeId || `Node ${index + 1}`)}</strong>
                    <span>{String(item?.type || 'node')} · {String(item?.status || 'unknown')}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="wf-panel-hint">Lượt chạy này chưa có dấu vết chi tiết.</p>
            )}

            {selectedTraceItem && (
              <div className="wf-run-trace-output">
                <div className="wf-run-trace-meta">
                  <strong>{String(selectedTraceItem.label || selectedTraceItem.nodeId || 'Node')}</strong>
                  <small>{String(selectedTraceItem.type || '')}</small>
                </div>
                <pre>{prettyJson(selectedTraceItem.output)}</pre>
              </div>
            )}

            {selectedRunState && (
              <details className="wf-run-details">
                <summary>State sau lượt chạy</summary>
                <pre>{prettyJson(selectedRunState)}</pre>
              </details>
            )}
          </>
        )}
      </div>
    </>
  )
}
