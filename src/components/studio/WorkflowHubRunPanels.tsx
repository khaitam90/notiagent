import { useRef, useState } from 'react'
import { AlertCircle, Boxes, LoaderCircle, PlaySquare } from 'lucide-react'
import { uploadMedia } from '../../lib/api'
import { fileAcceptForField, isUploadableField, uploadKindForField, uploadLabelForField } from './workflowHubUtils'
import type { WorkflowDefinition, WorkflowRun } from '../../lib/workflows'

type ValidationIssueLike = {
  code: string
  message: string
}

type WorkflowHubRunPanelsProps = {
  draftWorkflow: WorkflowDefinition
  currentMode: 'image' | 'video' | 'automation'
  displayedRunFields: string[]
  runInputValues: Record<string, string>
  setRunInputValues: React.Dispatch<React.SetStateAction<Record<string, string>>>
  runVariablesJson: string
  setRunVariablesJson: React.Dispatch<React.SetStateAction<string>>
  runMode: 'image' | 'video'
  setRunMode: React.Dispatch<React.SetStateAction<'image' | 'video'>>
  runWorkflowAction: () => void | Promise<void>
  isRunning: boolean
  workflowValidationErrors: ValidationIssueLike[]
  workflowValidationWarnings: ValidationIssueLike[]
  currentRuns: WorkflowRun[]
  selectedRunId: string | null
  setSelectedRunId: React.Dispatch<React.SetStateAction<string | null>>
  setSelectedTraceNodeId: React.Dispatch<React.SetStateAction<string | null>>
  inputFieldLabel: (field: string) => string
  isLongTextField: (field: string) => boolean
  inputFieldPlaceholder: (field: string) => string
  inputFieldHint: (field: string) => string
  statusClass: (status: WorkflowRun['status']) => string
  statusLabel: (status: WorkflowRun['status']) => string
  relativeTime: (iso: string) => string
  prettyJson: (value: unknown) => string
}

export function WorkflowHubRunPanels({
  draftWorkflow,
  currentMode,
  displayedRunFields,
  runInputValues,
  setRunInputValues,
  runVariablesJson,
  setRunVariablesJson,
  runMode,
  setRunMode,
  runWorkflowAction,
  isRunning,
  workflowValidationErrors,
  workflowValidationWarnings,
  currentRuns,
  selectedRunId,
  setSelectedRunId,
  setSelectedTraceNodeId,
  inputFieldLabel,
  isLongTextField,
  inputFieldPlaceholder,
  inputFieldHint,
  statusClass,
  statusLabel,
  relativeTime,
  prettyJson,
}: WorkflowHubRunPanelsProps) {
  const hiddenFileInputsRef = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  return (
    <>
      <div className="wf-panel-card">
        <div className="wf-panel-card-head">
          <AlertCircle size={16} />
          <strong>Kiểm tra workflow</strong>
        </div>
        {workflowValidationErrors.length === 0 && workflowValidationWarnings.length === 0 ? (
          <p className="wf-panel-hint">Workflow hiện không có lỗi kiểm tra.</p>
        ) : (
          <div className="wf-validation-list">
            {workflowValidationErrors.map((issue) => (
              <div key={issue.code + issue.message} className="wf-validation-item is-error">
                <strong>Lỗi</strong>
                <span>{issue.message}</span>
              </div>
            ))}
            {workflowValidationWarnings.map((issue) => (
              <div key={issue.code + issue.message} className="wf-validation-item is-warning">
                <strong>Cảnh báo</strong>
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="wf-panel-card">
        <div className="wf-panel-card-head">
          <PlaySquare size={16} />
          <strong>Chạy workflow</strong>
        </div>
        <p className="wf-panel-hint">
          Chế độ thực thi hiện tại: <strong>{currentMode}</strong>
        </p>
        {displayedRunFields.map((field) => (
          <label key={field} className="wf-field">
            <span>{inputFieldLabel(field)}</span>
            {isUploadableField(field) && (
              <>
                <input
                  ref={(element) => {
                    hiddenFileInputsRef.current[field] = element
                  }}
                  className="wf-hidden-file-input"
                  type="file"
                  accept={fileAcceptForField(field)}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    setUploadingField(field)
                    void uploadMedia(file, uploadKindForField(field))
                      .then((uploaded) => {
                        setRunInputValues((current) => ({
                          ...current,
                          [field]: uploaded.url,
                        }))
                      })
                      .catch((error) => {
                        window.alert(error instanceof Error ? error.message : 'Upload thất bại.')
                      })
                      .finally(() => {
                        setUploadingField((current) => (current === field ? null : current))
                        event.target.value = ''
                      })
                  }}
                />
                <button
                  type="button"
                  className="wf-secondary-btn"
                  onClick={() => hiddenFileInputsRef.current[field]?.click()}
                  disabled={uploadingField === field}
                >
                  {uploadingField === field ? <LoaderCircle size={15} className="spin" /> : null}
                  {uploadLabelForField(field)}
                </button>
              </>
            )}
            {isLongTextField(field) ? (
              <textarea
                rows={field === 'prompt' ? 5 : 4}
                value={runInputValues[field] || ''}
                onChange={(event) =>
                  setRunInputValues((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                placeholder={inputFieldPlaceholder(field) || 'Nhập giá trị...'}
              />
            ) : (
              <input
                value={runInputValues[field] || ''}
                onChange={(event) =>
                  setRunInputValues((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                placeholder={inputFieldPlaceholder(field) || 'Nhập giá trị...'}
              />
            )}
            {inputFieldHint(field) && <small className="wf-panel-hint">{inputFieldHint(field)}</small>}
          </label>
        ))}
        <label className="wf-field">
          <span>Biến JSON</span>
          <textarea
            rows={6}
            value={runVariablesJson}
            onChange={(event) => setRunVariablesJson(event.target.value)}
            placeholder={'{\n  "media_type": "image",\n  "reference_image": "https://..."\n}'}
          />
        </label>
        {draftWorkflow.media === 'hybrid' && (
          <label className="wf-field">
            <span>Đầu ra hybrid</span>
            <select value={runMode} onChange={(event) => setRunMode(event.target.value as 'image' | 'video')}>
              <option value="image">Ảnh</option>
              <option value="video">Video</option>
            </select>
          </label>
        )}
        <button
          type="button"
          className="wf-primary-btn"
          onClick={() => void runWorkflowAction()}
          disabled={isRunning || workflowValidationErrors.length > 0}
        >
          {isRunning ? <LoaderCircle size={15} className="spin" /> : <PlaySquare size={15} />}
          Chạy workflow
        </button>
      </div>

      <div className="wf-panel-card">
        <div className="wf-panel-card-head">
          <Boxes size={16} />
          <strong>Lịch sử chạy</strong>
        </div>
        {currentRuns.length === 0 ? (
          <p className="wf-panel-hint">Chưa có lần chạy nào cho workflow này.</p>
        ) : (
          <div className="wf-run-list">
            {currentRuns.slice(0, 8).map((run) => (
              <article key={run.id} className={`wf-run-item${selectedRunId === run.id ? ' is-selected' : ''}`}>
                <div className="wf-run-item-head">
                  <span className={`wf-status-badge ${statusClass(run.status)}`}>{statusLabel(run.status)}</span>
                  <small>{relativeTime(run.createdAt)}</small>
                </div>
                <p>{run.message || 'Không có mô tả'}</p>
                {run.error && <div className="wf-run-error">{run.error}</div>}
                {run.assetUrls.length > 0 && (
                  <div className="wf-run-links">
                    {run.assetUrls.slice(0, 3).map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        Đầu ra {index + 1}
                      </a>
                    ))}
                  </div>
                )}
                {run.outputs && Object.keys(run.outputs).length > 0 && (
                  <details className="wf-run-details">
                    <summary>Chi tiết đầu ra</summary>
                    <pre>{prettyJson(run.outputs)}</pre>
                  </details>
                )}
                <button
                  type="button"
                  className="wf-secondary-btn"
                  onClick={() => {
                    setSelectedRunId(run.id)
                    setSelectedTraceNodeId(null)
                  }}
                >
                  Xem dấu vết chạy
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
