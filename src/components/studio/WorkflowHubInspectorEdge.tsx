import { CirclePlus, Link2, Trash2 } from 'lucide-react'
import type { WorkflowDefinition, WorkflowEdge, WorkflowEdgeBranch, WorkflowNode } from '../../lib/workflows'

type Props = {
  draftWorkflow: WorkflowDefinition
  selectedEdge: WorkflowEdge | null
  selectedEdgeSourceNode: WorkflowNode | null
  selectedEdgeTargetNode: WorkflowNode | null
  edgeFormSourceNode: WorkflowNode | null
  edgeFormTargetNode: WorkflowNode | null
  edgeSourceId: string
  edgeTargetId: string
  edgeBranch: WorkflowEdgeBranch
  isEditable: boolean
  updateDraftEdge: (edgeId: string, updates: Partial<WorkflowEdge>) => void
  removeSelectedEdge: () => void
  setEdgeSourceId: (value: string) => void
  setEdgeTargetId: (value: string) => void
  setEdgeBranch: (value: WorkflowEdgeBranch) => void
  addEdgeAction: () => void
}

export function WorkflowHubInspectorEdge({
  draftWorkflow,
  selectedEdge,
  selectedEdgeSourceNode,
  selectedEdgeTargetNode,
  edgeFormSourceNode,
  edgeFormTargetNode,
  edgeSourceId,
  edgeTargetId,
  edgeBranch,
  isEditable,
  updateDraftEdge,
  removeSelectedEdge,
  setEdgeSourceId,
  setEdgeTargetId,
  setEdgeBranch,
  addEdgeAction,
}: Props) {
  return (
    <div className="wf-panel-card">
      <div className="wf-panel-card-head">
        <Link2 size={16} />
        <strong>Trình chỉnh liên kết</strong>
      </div>

      {selectedEdge ? (
        <>
          <label className="wf-field">
            <span>Node nguồn</span>
            <select
              value={selectedEdge.source}
              onChange={(event) => {
                const nextSource = event.target.value
                const nextSourceNode = draftWorkflow.nodes.find((node) => node.id === nextSource)
                updateDraftEdge(selectedEdge.id, {
                  source: nextSource,
                  branch: nextSourceNode?.type === 'condition' ? selectedEdge.branch || 'always' : undefined,
                })
              }}
              disabled={!isEditable}
            >
              {draftWorkflow.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </label>
          <label className="wf-field">
            <span>Node đích</span>
            <select
              value={selectedEdge.target}
              onChange={(event) => updateDraftEdge(selectedEdge.id, { target: event.target.value })}
              disabled={!isEditable}
            >
              {draftWorkflow.nodes
                .filter((node) => node.id !== selectedEdge.source)
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="wf-field">
            <span>Nhánh</span>
            <select
              value={selectedEdgeSourceNode?.type === 'condition' ? selectedEdge.branch || 'always' : 'always'}
              onChange={(event) =>
                updateDraftEdge(selectedEdge.id, {
                  branch:
                    selectedEdgeSourceNode?.type === 'condition'
                      ? (event.target.value as WorkflowEdgeBranch)
                      : undefined,
                })
              }
              disabled={!isEditable || selectedEdgeSourceNode?.type !== 'condition'}
            >
              <option value="always">ALWAYS</option>
              <option value="true">TRUE</option>
              <option value="false">FALSE</option>
            </select>
          </label>
          <div className="wf-panel-hint">
            {selectedEdgeSourceNode?.label || selectedEdge.source} → {selectedEdgeTargetNode?.label || selectedEdge.target}
          </div>
          {isEditable && (
            <button type="button" className="wf-danger-btn" onClick={removeSelectedEdge}>
              <Trash2 size={14} />
              Xóa liên kết
            </button>
          )}
        </>
      ) : (
        <p className="wf-panel-hint">Bấm vào một đường nối trên canvas để chỉnh liên kết.</p>
      )}

      {isEditable && (
        <>
          <div className="wf-divider" />
          <p className="wf-panel-hint">
            Liên kết nháp: <strong>{edgeFormSourceNode?.label ?? 'chưa chọn nguồn'}</strong> →{' '}
            <strong>{edgeFormTargetNode?.label ?? 'chưa chọn đích'}</strong>. Có thể bấm trực tiếp vào port
            <code> OUT </code>
            hoặc
            <code> IN </code>
            của component trên canvas để đặt nhanh hai đầu nối, rồi click node còn lại trên canvas để nối ngay.
          </p>
          <label className="wf-field">
            <span>Thêm liên kết từ</span>
            <select value={edgeSourceId} onChange={(event) => setEdgeSourceId(event.target.value)}>
              {draftWorkflow.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </label>
          <label className="wf-field">
            <span>Đến</span>
            <select value={edgeTargetId} onChange={(event) => setEdgeTargetId(event.target.value)}>
              {draftWorkflow.nodes
                .filter((node) => node.id !== edgeSourceId)
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="wf-field">
            <span>Nhánh liên kết mới</span>
            <select
              value={edgeFormSourceNode?.type === 'condition' ? edgeBranch : 'always'}
              onChange={(event) => setEdgeBranch(event.target.value as WorkflowEdgeBranch)}
              disabled={edgeFormSourceNode?.type !== 'condition'}
            >
              <option value="always">ALWAYS</option>
              <option value="true">TRUE</option>
              <option value="false">FALSE</option>
            </select>
          </label>
          <button type="button" className="wf-secondary-btn" onClick={addEdgeAction}>
            <CirclePlus size={14} />
            Thêm liên kết
          </button>
        </>
      )}
    </div>
  )
}
