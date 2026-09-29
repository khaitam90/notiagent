import { ArrowLeft, Copy, Download, Globe, Package, Pencil, Upload } from 'lucide-react'
import type { MutableRefObject } from 'react'
import type { WorkflowDefinition } from '../../lib/workflows'

type WorkflowHubEditorHeaderProps = {
  draftWorkflow: WorkflowDefinition
  isEditable: boolean
  importInputRef: MutableRefObject<HTMLInputElement | null>
  confirmDiscardChanges: () => boolean
  setViewMode: React.Dispatch<React.SetStateAction<'list' | 'editor'>>
  importWorkflowFile: (file: File | null) => void | Promise<void>
  exportWorkflowAction: () => void
  exportWorkflowPackageAction: () => void
  cloneWorkflowAction: (workflow: WorkflowDefinition) => void | Promise<void>
  updateDraftWorkflow: (patch: Partial<WorkflowDefinition>) => void
  onTogglePublished: () => void | Promise<void>
  publishGateReady: boolean
  publishGateMessage: string
}

export function WorkflowHubEditorHeader({
  draftWorkflow,
  isEditable,
  importInputRef,
  confirmDiscardChanges,
  setViewMode,
  importWorkflowFile,
  exportWorkflowAction,
  exportWorkflowPackageAction,
  cloneWorkflowAction,
  updateDraftWorkflow,
  onTogglePublished,
  publishGateReady,
  publishGateMessage,
}: WorkflowHubEditorHeaderProps) {
  return (
    <header className="wf-editor-head">
      <div className="wf-editor-head-left">
        <button
          type="button"
          className="wf-back-btn"
          onClick={() => {
            if (!confirmDiscardChanges()) return
            setViewMode('list')
          }}
        >
          <ArrowLeft size={16} />
          Danh sách workflow
        </button>
        <div className="wf-editor-identity">
          <div className="wf-editor-title-row">
            <label className="wf-editor-name-pill">
              <input
                value={draftWorkflow.name}
                onChange={(event) => updateDraftWorkflow({ name: event.target.value })}
                disabled={!isEditable}
                aria-label="Tên workflow"
              />
              {isEditable && <Pencil size={13} aria-hidden="true" />}
            </label>
            <span className={`wf-template-badge${draftWorkflow.category === 'template' ? ' is-template' : ''}`}>
              {draftWorkflow.environment === 'sandbox'
                ? 'Thử nghiệm'
                : draftWorkflow.category === 'template'
                  ? 'Mẫu chỉ đọc'
                  : draftWorkflow.published
                    ? 'Đã xuất bản'
                    : 'Bản nháp'}
            </span>
          </div>
          <p>{draftWorkflow.description}</p>
          {draftWorkflow.component && (
            <p className="wf-panel-hint">
              Thành phần nội bộ: <strong>{draftWorkflow.componentName || draftWorkflow.name}</strong>
            </p>
          )}
        </div>
      </div>
      <div className="wf-editor-head-actions">
        <input
          ref={(node) => {
            importInputRef.current = node
          }}
          type="file"
          accept="application/json,.json"
          className="wf-hidden-file-input"
          onChange={(event) => {
            void importWorkflowFile(event.target.files?.[0] ?? null)
            event.target.value = ''
          }}
        />
        <button type="button" className="wf-secondary-btn" onClick={exportWorkflowAction} title="Xuất JSON" aria-label="Xuất JSON">
          <Download size={15} />
          Xuất JSON
        </button>
        <button type="button" className="wf-secondary-btn" onClick={exportWorkflowPackageAction} title="Xuất gói" aria-label="Xuất gói">
          <Package size={15} />
          Xuất gói
        </button>
        {!isEditable && (
          <button type="button" className="wf-primary-btn" onClick={() => void cloneWorkflowAction(draftWorkflow)} title="Nhân bản để chỉnh sửa">
            <Copy size={15} />
            Nhân bản để chỉnh sửa
          </button>
        )}
        {isEditable && (
          <>
            <button
              type="button"
              className="wf-secondary-btn"
              disabled={!draftWorkflow.published && !publishGateReady}
              title={!draftWorkflow.published && !publishGateReady ? publishGateMessage : undefined}
              onClick={() => void onTogglePublished()}
              aria-label={draftWorkflow.published ? 'Bỏ xuất bản' : 'Kiểm tra và xuất bản'}
            >
              <Globe size={15} />
              {draftWorkflow.published ? 'Bỏ xuất bản' : 'Kiểm tra & xuất bản'}
            </button>
            <button type="button" className="wf-primary-btn" onClick={() => void cloneWorkflowAction(draftWorkflow)} title="Nhân bản" aria-label="Nhân bản">
              <Copy size={15} />
              Nhân bản
            </button>
            <button type="button" className="wf-secondary-btn" onClick={() => importInputRef.current?.click()} title="Nhập JSON" aria-label="Nhập JSON">
              <Upload size={15} />
              Nhập JSON
            </button>
          </>
        )}
      </div>
    </header>
  )
}
