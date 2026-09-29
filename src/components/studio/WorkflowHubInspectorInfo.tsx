import { FolderTree, Settings2, Trash2 } from 'lucide-react'
import { TEMPLATE_WORKFLOW_FOLDER_ID, type WorkflowDefinition, type WorkflowFolder, type WorkflowMedia } from '../../lib/workflows'
import {
  COMPONENT_INPUT_FIELD_PRESETS,
  COMPONENT_OUTPUT_SCHEMA_PRESETS,
  WORKFLOW_TAG_PRESETS,
  WORKFLOW_USE_CASE_PRESETS,
} from './workflowHubPresets'
import { parseWorkflowMetadata, parseWorkflowTags, stringifyComponentInputSchema, stringifyComponentOutputSchema } from './workflowHubData'
import { WorkflowHubCollapsibleSection } from './WorkflowHubCollapsibleSection'

type WorkflowHubInspectorInfoProps = {
  draftWorkflow: WorkflowDefinition
  isEditable: boolean
  folders: WorkflowFolder[]
  componentInputSchemaFields: string[]
  componentOutputSchemaMap: Record<string, string>
  componentOutputSchemaEntries: Array<[string, string]>
  updateDraftWorkflow: (patch: Partial<WorkflowDefinition>) => void
  inferComponentInputSchema: (workflow: WorkflowDefinition | null | undefined) => string[]
  inferComponentOutputSchema: (workflow: WorkflowDefinition | null | undefined) => Record<string, string>
  inputFieldLabel: (field: string) => string
  inputFieldPlaceholder: (field: string) => string
  defaultRunFieldValue: (field: string) => string
  stringifyWorkflowTags: (tags: string[]) => string[]
  mergeWorkflowTags: (...groups: Array<string[] | null | undefined>) => string[]
}

export function WorkflowHubInspectorInfo({
  draftWorkflow,
  isEditable,
  folders,
  componentInputSchemaFields,
  componentOutputSchemaMap,
  componentOutputSchemaEntries,
  updateDraftWorkflow,
  inferComponentInputSchema,
  inferComponentOutputSchema,
  inputFieldLabel,
  inputFieldPlaceholder,
  defaultRunFieldValue,
  stringifyWorkflowTags,
  mergeWorkflowTags,
}: WorkflowHubInspectorInfoProps) {
  return (
    <div className="wf-panel-card">
      <div className="wf-panel-card-head">
        <FolderTree size={16} />
        <strong>Thông tin workflow</strong>
      </div>
      <label className="wf-field">
        <span>Tên workflow</span>
        <input
          value={draftWorkflow.name}
          onChange={(event) => updateDraftWorkflow({ name: event.target.value })}
          disabled={!isEditable}
        />
      </label>
      <label className="wf-field">
        <span>Mô tả</span>
        <textarea
          value={draftWorkflow.description}
          onChange={(event) => updateDraftWorkflow({ description: event.target.value })}
          disabled={!isEditable}
          rows={4}
        />
      </label>
      <label className="wf-field">
        <span>Loại workflow</span>
        <select
          value={draftWorkflow.media}
          onChange={(event) => updateDraftWorkflow({ media: event.target.value as WorkflowMedia })}
          disabled={!isEditable}
        >
          <option value="image">Ảnh</option>
          <option value="video">Video</option>
          <option value="hybrid">Kết hợp</option>
          <option value="automation">Tự động hóa</option>
        </select>
      </label>
      <label className="wf-field">
        <span>Thư mục</span>
        <select
          value={draftWorkflow.folderId}
          onChange={(event) => updateDraftWorkflow({ folderId: event.target.value })}
          disabled={!isEditable}
        >
          {folders.filter((folder) => folder.id !== TEMPLATE_WORKFLOW_FOLDER_ID || draftWorkflow.category === 'template').map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>
      {isEditable && (
        <WorkflowHubCollapsibleSection
          title="Cấu hình nâng cao"
          icon={<Settings2 size={16} />}
          summary="Component, tag, metadata JSON"
        >
          <>
          <label className="wf-toggle-row">
            <input
              type="checkbox"
              checked={Boolean(draftWorkflow.component)}
              onChange={(event) =>
                updateDraftWorkflow({
                  component: event.target.checked,
                  componentName: event.target.checked
                    ? draftWorkflow.componentName || draftWorkflow.name
                    : draftWorkflow.componentName || '',
                })
              }
            />
            <span>Xuất bản workflow này thành thành phần nội bộ để node subflow / for_each tái sử dụng.</span>
          </label>
          {draftWorkflow.component && (
            <>
              <label className="wf-field">
                <span>Tên thành phần</span>
                <input
                  value={draftWorkflow.componentName || ''}
                  onChange={(event) => updateDraftWorkflow({ componentName: event.target.value })}
                  placeholder="Ví dụ: Pipeline ảnh nhân vật"
                />
              </label>
              <div className="wf-field">
                <span>Schema đầu vào của thành phần</span>
                <div className="wf-schema-actions">
                  <button
                    type="button"
                    className="wf-secondary-btn"
                    onClick={() =>
                      updateDraftWorkflow({
                        componentInputSchemaJson: stringifyComponentInputSchema(
                          inferComponentInputSchema(draftWorkflow),
                        ),
                      })
                    }
                  >
                    Suy ra từ node đầu vào
                  </button>
                  <button
                    type="button"
                    className="wf-secondary-btn"
                    onClick={() =>
                      updateDraftWorkflow({
                        componentInputSchemaJson: stringifyComponentInputSchema([
                          ...componentInputSchemaFields,
                          `field_${componentInputSchemaFields.length + 1}`,
                        ]),
                      })
                    }
                  >
                    Thêm trường đầu vào
                  </button>
                </div>
                <div className="wf-schema-preset-grid">
                  {COMPONENT_INPUT_FIELD_PRESETS.map((preset) => {
                    const active = componentInputSchemaFields.includes(preset.field)
                    return (
                      <button
                        key={preset.field}
                        type="button"
                        className={`wf-schema-preset${active ? ' is-active' : ''}`}
                        onClick={() =>
                          updateDraftWorkflow({
                            componentInputSchemaJson: stringifyComponentInputSchema(
                              active
                                ? componentInputSchemaFields.filter((field) => field !== preset.field)
                                : [...componentInputSchemaFields, preset.field],
                            ),
                          })
                        }
                      >
                        <strong>{inputFieldLabel(preset.field)}</strong>
                        <small>{preset.hint}</small>
                      </button>
                    )
                  })}
                </div>
                <div className="wf-schema-list">
                  {componentInputSchemaFields.length === 0 ? (
                    <p className="wf-panel-hint">Chưa có trường đầu vào nào. Bạn có thể suy ra từ node đầu vào hoặc tự thêm.</p>
                  ) : (
                    componentInputSchemaFields.map((field, index) => (
                      <div key={`${field}-${index}`} className="wf-schema-row">
                        <input
                          value={field}
                          onChange={(event) => {
                            const next = [...componentInputSchemaFields]
                            next[index] = event.target.value
                            updateDraftWorkflow({
                              componentInputSchemaJson: stringifyComponentInputSchema(next),
                            })
                          }}
                          placeholder="Ví dụ: prompt hoặc chủ đề"
                        />
                        <button
                          type="button"
                          className="wf-config-remove"
                          onClick={() => {
                            const next = componentInputSchemaFields.filter((_, itemIndex) => itemIndex !== index)
                            updateDraftWorkflow({
                              componentInputSchemaJson: stringifyComponentInputSchema(next),
                            })
                          }}
                          aria-label={`Xóa trường đầu vào ${field || index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {componentInputSchemaFields.length > 0 && (
                  <div className="wf-schema-preview">
                    <strong>Xem trước form chạy</strong>
                    <div className="wf-schema-preview-list">
                      {componentInputSchemaFields.map((field) => (
                        <div key={`preview-${field}`} className="wf-schema-preview-item">
                          <span>{inputFieldLabel(field)}</span>
                          <small>{inputFieldPlaceholder(field) || defaultRunFieldValue(field) || 'Nhập tự do'}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="wf-field">
                <span>Schema đầu ra của thành phần</span>
                <div className="wf-schema-actions">
                  <button
                    type="button"
                    className="wf-secondary-btn"
                    onClick={() =>
                      updateDraftWorkflow({
                        componentOutputSchemaJson: stringifyComponentOutputSchema(
                          inferComponentOutputSchema(draftWorkflow),
                        ),
                      })
                    }
                  >
                    Suy ra từ node đầu ra
                  </button>
                  <button
                    type="button"
                    className="wf-secondary-btn"
                    onClick={() =>
                      updateDraftWorkflow({
                        componentOutputSchemaJson: stringifyComponentOutputSchema({
                          ...componentOutputSchemaMap,
                          [`output_${componentOutputSchemaEntries.length + 1}`]:
                            `state.output_${componentOutputSchemaEntries.length + 1}`,
                        }),
                      })
                    }
                  >
                    Thêm ánh xạ đầu ra
                  </button>
                </div>
                <div className="wf-schema-preset-grid">
                  {COMPONENT_OUTPUT_SCHEMA_PRESETS.map((preset) => {
                    const active = componentOutputSchemaMap[preset.key] === preset.value
                    return (
                      <button
                        key={`${preset.key}-${preset.value}`}
                        type="button"
                        className={`wf-schema-preset${active ? ' is-active' : ''}`}
                        onClick={() => {
                          const next = { ...componentOutputSchemaMap }
                          if (active) delete next[preset.key]
                          else next[preset.key] = preset.value
                          updateDraftWorkflow({
                            componentOutputSchemaJson: stringifyComponentOutputSchema(next),
                          })
                        }}
                      >
                        <strong>{preset.key}</strong>
                        <small>{preset.hint}</small>
                      </button>
                    )
                  })}
                </div>
                <div className="wf-schema-list">
                  {componentOutputSchemaEntries.length === 0 ? (
                    <p className="wf-panel-hint">Chưa có ánh xạ đầu ra nào. Bạn có thể suy ra từ node đầu ra hoặc tự thêm.</p>
                  ) : (
                    componentOutputSchemaEntries.map(([key, value], index) => (
                      <div key={`${key}-${index}`} className="wf-schema-row is-output">
                        <input
                          value={key}
                          onChange={(event) => {
                            const next = Object.fromEntries(componentOutputSchemaEntries)
                            delete next[key]
                            next[event.target.value] = value
                            updateDraftWorkflow({
                              componentOutputSchemaJson: stringifyComponentOutputSchema(next),
                            })
                          }}
                          placeholder="Tên biến xuất ra"
                        />
                        <input
                          value={value}
                          onChange={(event) => {
                            const next = Object.fromEntries(componentOutputSchemaEntries)
                            next[key] = event.target.value
                            updateDraftWorkflow({
                              componentOutputSchemaJson: stringifyComponentOutputSchema(next),
                            })
                          }}
                          placeholder="Ví dụ: state.payload"
                        />
                        <button
                          type="button"
                          className="wf-config-remove"
                          onClick={() => {
                            const next = Object.fromEntries(componentOutputSchemaEntries)
                            delete next[key]
                            updateDraftWorkflow({
                              componentOutputSchemaJson: stringifyComponentOutputSchema(next),
                            })
                          }}
                          aria-label={`Xóa ánh xạ đầu ra ${key || index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {componentOutputSchemaEntries.length > 0 && (
                  <div className="wf-schema-preview">
                    <strong>Xem trước đầu ra được xuất</strong>
                    <div className="wf-schema-preview-list">
                      {componentOutputSchemaEntries.map(([key, value]) => (
                        <div key={`output-preview-${key}`} className="wf-schema-preview-item">
                          <span>{key}</span>
                          <small>{value}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <details className="wf-run-details">
                <summary>Chế độ nâng cao: sửa JSON trực tiếp</summary>
                <label className="wf-field">
                  <span>JSON schema đầu vào của thành phần</span>
                  <textarea
                    rows={5}
                    value={draftWorkflow.componentInputSchemaJson || ''}
                    onChange={(event) => updateDraftWorkflow({ componentInputSchemaJson: event.target.value })}
                    placeholder={'["prompt","topic","channel","media_type"]'}
                  />
                </label>
                <label className="wf-field">
                  <span>JSON schema đầu ra của thành phần</span>
                  <textarea
                    rows={6}
                    value={draftWorkflow.componentOutputSchemaJson || ''}
                    onChange={(event) => updateDraftWorkflow({ componentOutputSchemaJson: event.target.value })}
                    placeholder={'{"payload":"state.payload","request_name":"state.request_name"}'}
                  />
                </label>
              </details>
            </>
          )}
          <label className="wf-field">
            <span>Tag workflow</span>
            <input
              value={parseWorkflowTags(draftWorkflow).join(', ')}
              onChange={(event) =>
                updateDraftWorkflow({
                  tags: stringifyWorkflowTags(event.target.value.split(',').map((item) => item.trim())),
                })
              }
              placeholder="anh, nhan-vat, mang-xa-hoi, tu-dong-hoa"
            />
          </label>
          <div className="wf-inline-presets">
            {WORKFLOW_TAG_PRESETS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`wf-tag-chip${parseWorkflowTags(draftWorkflow).includes(tag) ? ' active' : ''}`}
                onClick={() =>
                  updateDraftWorkflow({
                    tags: parseWorkflowTags(draftWorkflow).includes(tag)
                      ? parseWorkflowTags(draftWorkflow).filter((item) => item !== tag)
                      : mergeWorkflowTags(parseWorkflowTags(draftWorkflow), [tag]),
                  })
                }
              >
                #{tag}
              </button>
            ))}
          </div>
          <div className="wf-inline-presets">
            {WORKFLOW_USE_CASE_PRESETS.map((preset) => (
              <button
                key={preset.useCase}
                type="button"
                className="wf-secondary-btn"
                onClick={() =>
                  updateDraftWorkflow({
                    tags: mergeWorkflowTags(parseWorkflowTags(draftWorkflow), preset.tags),
                    metadataJson: JSON.stringify(
                      {
                        ...parseWorkflowMetadata(draftWorkflow),
                        use_case: preset.useCase,
                      },
                      null,
                      2,
                    ),
                  })
                }
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="wf-field">
            <span>Metadata JSON</span>
            <textarea
              rows={5}
              value={draftWorkflow.metadataJson || ''}
              onChange={(event) => updateDraftWorkflow({ metadataJson: event.target.value })}
              placeholder={'{\n  "use_case": "character_image_pipeline",\n  "audience": "marketing",\n  "provider": "novita"\n}'}
            />
          </label>
          </>
        </WorkflowHubCollapsibleSection>
      )}
      <div className="wf-meta-stack">
        <small>ID workflow: {draftWorkflow.id}</small>
        {draftWorkflow.sourceTemplateId && <small>Mẫu nguồn: {draftWorkflow.sourceTemplateId}</small>}
      </div>
    </div>
  )
}
