import type { WorkflowDefinition } from '../../lib/workflows'
import { parseWorkflowMetadata, parseWorkflowTags } from './workflowHubData'

type ImportedWorkflowCandidate = {
  fileName: string
  importedAt: string
  workflow: WorkflowDefinition
  packageDocument: { kind: string } | null
}

type Props = {
  importedWorkflowCandidate: ImportedWorkflowCandidate
  mediaLabel: (media: WorkflowDefinition['media']) => string
  createWorkflowFromDefinitionAction: (
    workflow: WorkflowDefinition,
    options?: { suggestedName?: string; openInEditor?: boolean },
  ) => Promise<void>
  clearImportedWorkflowCandidate: () => void
  relativeTime: (iso: string) => string
  prettyJson: (value: unknown) => string
}

export function WorkflowHubImportedWorkflowPreview({
  importedWorkflowCandidate,
  mediaLabel,
  createWorkflowFromDefinitionAction,
  clearImportedWorkflowCandidate,
  relativeTime,
  prettyJson,
}: Props) {
  return (
    <div className="wf-library-preview">
      <div className="wf-library-preview-head">
        <div>
          <div className="wf-card-top">
            <span className={`wf-media-badge media-${importedWorkflowCandidate.workflow.media}`}>
              {mediaLabel(importedWorkflowCandidate.workflow.media)}
            </span>
            <span className="wf-template-badge">
              {importedWorkflowCandidate.packageDocument ? 'Nhập gói' : 'Nhập workflow JSON'}
            </span>
            {importedWorkflowCandidate.workflow.component && <span className="wf-template-badge is-component">Thành phần</span>}
          </div>
          <h3>{importedWorkflowCandidate.workflow.name}</h3>
          <p>{importedWorkflowCandidate.workflow.description || 'Không có mô tả trong file import.'}</p>
        </div>
        <div className="wf-library-preview-actions">
          <button
            type="button"
            className="wf-primary-btn"
            onClick={() => {
              void createWorkflowFromDefinitionAction(importedWorkflowCandidate.workflow, {
                suggestedName: importedWorkflowCandidate.workflow.name,
                openInEditor: true,
              })
              clearImportedWorkflowCandidate()
            }}
          >
            Tạo workflow từ file này
          </button>
          <button type="button" className="wf-secondary-btn" onClick={clearImportedWorkflowCandidate}>
            Bỏ import
          </button>
        </div>
      </div>
      <div className="wf-library-preview-meta">
        <span>Tệp: {importedWorkflowCandidate.fileName}</span>
        <span>{importedWorkflowCandidate.workflow.nodes.length} node</span>
        <span>{importedWorkflowCandidate.workflow.edges.length} liên kết</span>
        <span>Nhập {relativeTime(importedWorkflowCandidate.importedAt)}</span>
      </div>
      {parseWorkflowTags(importedWorkflowCandidate.workflow).length > 0 && (
        <div className="wf-tag-row">
          {parseWorkflowTags(importedWorkflowCandidate.workflow).map((tag) => (
            <span key={`${importedWorkflowCandidate.fileName}-${tag}`} className="wf-tag-chip">
              #{tag}
            </span>
          ))}
        </div>
      )}
      {Object.keys(parseWorkflowMetadata(importedWorkflowCandidate.workflow)).length > 0 && (
        <div className="wf-library-meta-grid">
          {Object.entries(parseWorkflowMetadata(importedWorkflowCandidate.workflow)).map(([key, value]) => (
            <div key={`${importedWorkflowCandidate.fileName}-${key}`} className="wf-library-meta-item">
              <strong>{key}</strong>
              <span>{typeof value === 'string' ? value : prettyJson(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
