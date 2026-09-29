import { useRef, useState } from 'react'
import { Boxes, CirclePlus, FolderOpen, ImagePlus, Loader2, Maximize2, MoveDown, MoveLeft, MoveRight, MoveUp, Trash2, X } from 'lucide-react'
import type { WorkflowDefinition, WorkflowEdge, WorkflowEdgeBranch, WorkflowNode } from '../../lib/workflows'
import type { NodeConfigTemplate } from './workflowHubPresets'
import { buildSuggestedSubflowConfig, parseComponentInputSchema, parseComponentOutputSchema } from './workflowHubData'
import { fetchMediaLibrary, uploadMedia, type MediaLibraryItem } from '../../lib/api'
import { primaryInlineEditableKey } from './workflowHubUtils'
import { WorkflowHubTextModal } from './WorkflowHubTextModal'
import { WorkflowHubModelPicker } from './WorkflowHubModelPicker'
import { WorkflowHubMediaSettings } from './WorkflowHubMediaSettings'

type Props = {
  draftWorkflow: WorkflowDefinition | null
  selectedNode: WorkflowNode | null
  isEditable: boolean
  selectedNodeConfigTemplates: NodeConfigTemplate[]
  selectedConditionEdges: WorkflowEdge[]
  reusableWorkflowOptions: WorkflowDefinition[]
  selectedReusableWorkflow: WorkflowDefinition | null
  applySelectedNodeConfigTemplate: (template: NodeConfigTemplate) => void
  updateDraftNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  removeDraftNodeConfigKey: (nodeId: string, key: string) => void
  updateDraftEdge: (edgeId: string, updates: Partial<WorkflowEdge>) => void
  openWorkflow: (workflowId: string) => void
  moveNode: (deltaX: number, deltaY: number) => void
  removeSelectedNode: () => void
}

function isLongConfigField(key: string) {
  return ['template', 'body_json', 'headers_json', 'query_json', 'assign_json', 'template_json', 'actions_json'].includes(key)
}

function configFieldRows(key: string) {
  if (key === 'template_json' || key === 'assign_json' || key === 'body_json') return 8
  if (key === 'headers_json' || key === 'query_json' || key === 'template') return 5
  if (key === 'actions_json') return 6
  return 4
}

export function WorkflowHubInspectorNode({
  draftWorkflow,
  selectedNode,
  isEditable,
  selectedNodeConfigTemplates,
  selectedConditionEdges,
  reusableWorkflowOptions,
  selectedReusableWorkflow,
  applySelectedNodeConfigTemplate,
  updateDraftNode,
  removeDraftNodeConfigKey,
  updateDraftEdge,
  openWorkflow,
  moveNode,
  removeSelectedNode,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [libraryUploads, setLibraryUploads] = useState<MediaLibraryItem[]>([])
  const [libraryGenerated, setLibraryGenerated] = useState<MediaLibraryItem[]>([])
  const [addingConfig, setAddingConfig] = useState(false)
  const [configKeyDraft, setConfigKeyDraft] = useState('')
  const [configValueDraft, setConfigValueDraft] = useState('')
  // 2026-07-26i: config key dang mo modal toan man hinh de sua (cho cac truong dai nhu template_json,
  // body_json...) - danh muc gia tri tam giong co che cua o inline tren canvas, "Luu" moi ghi that.
  const [modalConfigKey, setModalConfigKey] = useState<string | null>(null)
  const [modalDraftValue, setModalDraftValue] = useState('')

  const referenceImageUrl = selectedNode?.config.reference_image_url || ''
  // 2026-07-26i: truong config "chinh" cua node (vd template cua Prompt) gio da sua truc tiep ngay
  // tren khoi node trong canvas (xem WorkflowHubEditorCanvas) - an no khoi bang config chung o day de
  // khong con hien trung lap 2 noi cung sua 1 gia tri, dung nhu Sep phan anh.
  const hiddenPrimaryKey = selectedNode ? primaryInlineEditableKey(selectedNode.type) : null
  // 2026-07-27g: node loai Anh/Video gio co WorkflowHubModelPicker rieng (card chon model + dong
  // "khuyen dung cho") thay cho 2 o chu tho "provider"/"model" trong bang config chung - an 2 key
  // nay khoi bang chung de khong lap lai 2 noi cung sua 1 gia tri, dung pattern hiddenPrimaryKey da
  // co san o tren cho template/prompt/input.
  const isModelManagedNode = selectedNode?.type === 'image' || selectedNode?.type === 'video'
  // 2026-07-28: gio da co WorkflowHubMediaSettings rieng (chip ty le/do phan giai/thoi luong
  // dong theo model) ngay ben duoi WorkflowHubModelPicker - an 4 key nay khoi bang config chung
  // de khong lap lai 2 noi cung sua 1 gia tri, dung pattern modelManagedKeys da co san o tren.
  const modelManagedKeys = isModelManagedNode ? ['provider', 'model', 'aspect_ratio', 'resolution', 'duration', 'quality'] : []
  // 2026-07-28: Sep yeu cau gop node Anh/Video lam luon diem cuoi workflow, khong bat buoc phai
  // co node Dau ra rieng nua - backend (execute_workflow_graph trong main.py) da tu gom assetUrls
  // tu MOI node Anh/Video vao ket qua cuoi cung bat ke co node Dau ra hay khong, nen chi can bao
  // cho Sep biet rieng khi node nay khong noi ra dau (leaf) thi no da tu la diem cuoi that su.
  const isLeafOutputNode =
    isModelManagedNode && !!selectedNode && !(draftWorkflow?.edges || []).some((edge) => edge.source === selectedNode.id)

  const handleUploadReferenceImage = async (file: File | null) => {
    if (!file || !selectedNode) return
    setUploading(true)
    setUploadError('')
    try {
      const result = await uploadMedia(file, 'image')
      updateDraftNode(selectedNode.id, {
        config: { ...selectedNode.config, reference_image_url: result.url },
      })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Tải ảnh lên thất bại, thử lại sau.')
    } finally {
      setUploading(false)
    }
  }

  const openLibrary = async () => {
    setLibraryOpen(true)
    setLibraryLoading(true)
    setLibraryError('')
    try {
      const { uploads, generated } = await fetchMediaLibrary()
      setLibraryUploads(uploads)
      setLibraryGenerated(generated)
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Không tải được thư viện.')
    } finally {
      setLibraryLoading(false)
    }
  }

  const pickFromLibrary = (item: MediaLibraryItem) => {
    if (!selectedNode) return
    updateDraftNode(selectedNode.id, {
      config: { ...selectedNode.config, reference_image_url: item.url },
    })
    setLibraryOpen(false)
  }

  const commitAddConfig = () => {
    if (!selectedNode) return
    const trimmedKey = configKeyDraft.trim()
    if (!trimmedKey) return
    if (selectedNode.config[trimmedKey] !== undefined) {
      window.alert('Config key này đã tồn tại.')
      return
    }
    updateDraftNode(selectedNode.id, {
      config: {
        ...selectedNode.config,
        [trimmedKey]: configValueDraft,
      },
    })
    setAddingConfig(false)
    setConfigKeyDraft('')
    setConfigValueDraft('')
  }

  return (
    <div className="wf-panel-card">
      <div className="wf-panel-card-head">
        <Boxes size={16} />
        <strong>Trình chỉnh node</strong>
      </div>
      {!selectedNode && <p className="wf-panel-hint">Chọn một node trên canvas để chỉnh sửa.</p>}
      {selectedNode && (
        <>
          {/* 2026-07-28: da xoa khoi "Anh tham chieu (tuy chon)" o day - no ghi vao config.reference_image_url nhung KHONG NOI NAO trong backend/frontend doc lai gia tri nay (da grep xac nhan) - la code chet, Sep bam vao tuong co tac dung nhung thuc ra khong lam gi ca. Cach dung dung: bam nut "Tai anh" ngay tren khoi node Dau vao trong canvas (chi hien khi config.fields co field kieu anh, vd reference_image) - cai do moi thuc su ghi vao runInputValues va duoc backend doc qua resolve_input_value(). */}

          {/* 2026-07-28: voi node Prompt, cac preset o day ghi vao config.template - trung
              voi o soan prompt inline tren canvas (muc 15). Voi node Image/Video, preset ghi vao
              provider/model/aspect_ratio_path... - trung voi WorkflowHubNodeMediaPanel moi tren
              canvas (Sep yeu cau lam lai node theo mockup app khac). Ca 2 truong hop deu an bang
              preset o day, chi giu cho cac loai node con lai (input, http, json...). */}
          {(selectedNode.type === 'prompt' || isModelManagedNode) && selectedNodeConfigTemplates.length > 0 && (
            <p className="wf-panel-hint">
              {selectedNode.type === 'prompt'
                ? 'Mẫu prompt dựng sẵn (Cinematic rewrite, Character consistency...) giờ soạn trực tiếp ngay trên khối node trong canvas — bấm vào node để gõ, không còn bảng preset riêng ở đây nữa để tránh ghi đè nhầm nội dung đang soạn.'
                : 'Mẫu preset model giờ chọn trực tiếp ngay trên khối node trong canvas (model, tỷ lệ, độ phân giải/thời lượng) — không còn bảng preset riêng ở đây nữa để tránh ghi đè nhầm lựa chọn đang chỉnh.'}
            </p>
          )}
          {selectedNode.type !== 'prompt' && !isModelManagedNode && selectedNodeConfigTemplates.length > 0 && (
            <div className="wf-field">
              <span>Mẫu cấu hình cho node {selectedNode.type}</span>
              <div className="wf-node-template-grid">
                {selectedNodeConfigTemplates.map((template) => (
                  <button
                    key={`${selectedNode.type}-${template.id}`}
                    type="button"
                    className="wf-node-template-card"
                    onClick={() => applySelectedNodeConfigTemplate(template)}
                    disabled={!isEditable}
                  >
                    <strong>{template.label}</strong>
                    <small>{template.description}</small>
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="wf-field">
            <span>Nhãn</span>
            <input
              value={selectedNode.label}
              onChange={(event) => updateDraftNode(selectedNode.id, { label: event.target.value })}
              disabled={!isEditable}
            />
          </label>
          <label className="wf-field">
            <span>Mô tả</span>
            <textarea
              value={selectedNode.description}
              onChange={(event) => updateDraftNode(selectedNode.id, { description: event.target.value })}
              disabled={!isEditable}
              rows={4}
            />
          </label>

          {hiddenPrimaryKey && selectedNode.config[hiddenPrimaryKey] !== undefined && (
            <p className="wf-panel-hint">
              Trường <code>{hiddenPrimaryKey}</code> giờ sửa trực tiếp ngay trên khối node trong canvas (bấm vào node để bung ô nhập) — không lặp lại ở bảng dưới đây nữa.
            </p>
          )}

          {/* 2026-07-28: Sep yeu cau lam lai node Anh/Video theo mockup app khac - model/ty le/
              do phan giai/che do gio chon TRUC TIEP ngay tren khoi node trong canvas
              (WorkflowHubNodeMediaPanel, xem WorkflowHubEditorCanvas.tsx). An WorkflowHubModelPicker
              + WorkflowHubMediaSettings o day de khong con 2 noi cung sua 1 gia tri (dung pattern da
              lap lai nhieu lan truoc: input trung config template o muc truoc, anh tham chieu chet
              o Input node...).
              2026-07-28h: Sep bao node canvas "khong phai dung de tai anh len va viet prompt o day"
              - da bo han o "Anh tham chieu"/"Prompt chay thu"/nut "Chay node" (test cach ly, khong
              dung du lieu that cua workflow) khoi WorkflowHubNodeMediaPanel. Preview tren node gio
              lay THAT tu lan "Chay workflow" gan nhat - cap nhat lai hint text o day cho dung, khong
              con nhac toi nut "Chay node" da bi xoa nua. */}
          {isModelManagedNode && (
            <p className="wf-panel-hint">
              Model, tỷ lệ, độ phân giải/thời lượng và chế độ (Đạo diễn/Tiêu chuẩn) giờ chọn trực tiếp ngay trên khối node trong canvas, không cần chỉnh ở đây nữa. Khung xem trước kết quả trên node tự hiển thị đúng ảnh/video của node này sau khi bấm "Chạy workflow" (không cần test riêng từng node).
            </p>
          )}

          {isLeafOutputNode && (
            <p className="wf-panel-hint wf-panel-hint-success">
              ✓ Node này không nối ra node nào khác — tự động là điểm kết thúc workflow, kết quả (ảnh/video) tự trả về cho ứng dụng. Không cần thêm node Đầu ra riêng.
            </p>
          )}

          {Object.entries(selectedNode.config).filter(([key]) => key !== hiddenPrimaryKey && !modelManagedKeys.includes(key)).length > 0 && (
            <div className="wf-config-grid">
              {Object.entries(selectedNode.config)
                .filter(([key]) => key !== hiddenPrimaryKey && !modelManagedKeys.includes(key))
                .map(([key, value]) => (
                <div key={key} className="wf-config-item">
                  <label className="wf-field">
                    <span>
                      {key}
                      {isLongConfigField(key) && (
                        <button
                          type="button"
                          className="wf-config-expand"
                          onClick={() => {
                            setModalConfigKey(key)
                            setModalDraftValue(value)
                          }}
                          disabled={!isEditable}
                          title="Mở rộng toàn màn hình"
                        >
                          <Maximize2 size={11} /> Mở rộng
                        </button>
                      )}
                    </span>
                    {isLongConfigField(key) ? (
                      <textarea
                        rows={configFieldRows(key)}
                        value={value}
                        onChange={(event) =>
                          updateDraftNode(selectedNode.id, {
                            config: {
                              ...selectedNode.config,
                              [key]: event.target.value,
                            },
                          })}
                        disabled={!isEditable}
                      />
                    ) : (
                      <input
                        value={value}
                        onChange={(event) =>
                          updateDraftNode(selectedNode.id, {
                            config: {
                              ...selectedNode.config,
                              [key]: event.target.value,
                            },
                          })}
                        disabled={!isEditable}
                      />
                    )}
                  </label>
                  {isEditable && (
                    <button
                      type="button"
                      className="wf-config-remove"
                      onClick={() => removeDraftNodeConfigKey(selectedNode.id, key)}
                      aria-label={`Xóa config ${key}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditable && (
            addingConfig ? (
              <div className="wf-config-grid">
                <label className="wf-field">
                  <span>Config key mới</span>
                  <input
                    value={configKeyDraft}
                    autoFocus
                    onChange={(event) => setConfigKeyDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitAddConfig()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        setAddingConfig(false)
                        setConfigKeyDraft('')
                        setConfigValueDraft('')
                      }
                    }}
                  />
                </label>
                <label className="wf-field">
                  <span>Giá trị</span>
                  <textarea
                    rows={3}
                    value={configValueDraft}
                    onChange={(event) => setConfigValueDraft(event.target.value)}
                  />
                </label>
                <div className="wf-inline-presets">
                  <button type="button" className="wf-primary-btn" onClick={commitAddConfig} disabled={!configKeyDraft.trim()}>
                    <CirclePlus size={14} />
                    Thêm
                  </button>
                  <button
                    type="button"
                    className="wf-secondary-btn"
                    onClick={() => {
                      setAddingConfig(false)
                      setConfigKeyDraft('')
                      setConfigValueDraft('')
                    }}
                  >
                    <X size={14} />
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="wf-secondary-btn" onClick={() => setAddingConfig(true)}>
                <CirclePlus size={14} />
                Thêm config
              </button>
            )
          )}

          {selectedNode.type === 'condition' && selectedConditionEdges.length > 0 && (
            <div className="wf-config-grid">
              {selectedConditionEdges.map((edge) => {
                const targetNode = draftWorkflow?.nodes.find((node) => node.id === edge.target)
                return (
                  <label key={edge.id} className="wf-field">
                    <span>Nhánh tới {targetNode?.label || edge.target}</span>
                    <select
                      value={edge.branch || 'always'}
                      onChange={(event) => updateDraftEdge(edge.id, { branch: event.target.value as WorkflowEdgeBranch })}
                      disabled={!isEditable}
                    >
                      <option value="true">TRUE</option>
                      <option value="false">FALSE</option>
                      <option value="always">ALWAYS</option>
                    </select>
                  </label>
                )
              })}
            </div>
          )}

          {(selectedNode.type === 'subflow' || selectedNode.type === 'for_each') && (
            <div className="wf-config-grid">
              <label className="wf-field">
                <span>Workflow con / component</span>
                <select
                  value={selectedNode.config.workflow_id || ''}
                  onChange={(event) =>
                    updateDraftNode(selectedNode.id, {
                      config: {
                        ...selectedNode.config,
                        workflow_id: event.target.value,
                      },
                    })
                  }
                  disabled={!isEditable}
                >
                  <option value="">Chọn workflow</option>
                  {reusableWorkflowOptions.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.component ? `[Component] ${workflow.componentName || workflow.name}` : workflow.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedReusableWorkflow && (
                <>
                  <div className="wf-schema-box">
                    <strong>{selectedReusableWorkflow.componentName || selectedReusableWorkflow.name}</strong>
                    <small>
                      Schema đầu vào:{' '}
                      {parseComponentInputSchema(selectedReusableWorkflow).length > 0
                        ? parseComponentInputSchema(selectedReusableWorkflow).join(', ')
                        : 'chưa khai báo'}
                    </small>
                    <small>
                      Schema đầu ra:{' '}
                      {Object.keys(parseComponentOutputSchema(selectedReusableWorkflow)).length > 0
                        ? Object.entries(parseComponentOutputSchema(selectedReusableWorkflow))
                            .map(([key, value]) => `${key} ← ${value}`)
                            .join(' · ')
                        : 'chưa khai báo'}
                    </small>
                    <div className="wf-schema-actions">
                      <button
                        type="button"
                        className="wf-secondary-btn"
                        onClick={() => openWorkflow(selectedReusableWorkflow.id)}
                      >
                        Mở workflow component
                      </button>
                    </div>
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      className="wf-secondary-btn"
                      onClick={() => {
                        const suggestedConfig = buildSuggestedSubflowConfig(selectedReusableWorkflow)
                        updateDraftNode(selectedNode.id, {
                          label: selectedReusableWorkflow.componentName || selectedReusableWorkflow.name,
                          description: `Component nội bộ: ${selectedReusableWorkflow.componentName || selectedReusableWorkflow.name}`,
                          config: {
                            ...selectedNode.config,
                            ...suggestedConfig,
                            ...(selectedNode.type === 'for_each'
                              ? {
                                  items_path: selectedNode.config.items_path || 'items',
                                  item_key: selectedNode.config.item_key || 'item',
                                  item_index_key: selectedNode.config.item_index_key || 'item_index',
                                  output_key: selectedNode.config.output_key || 'loop_results',
                                }
                              : {
                                  output_key: selectedNode.config.output_key || 'component_result',
                                }),
                          },
                        })
                      }}
                    >
                      Áp dụng config gợi ý từ schema component
                    </button>
                  )}
                </>
              )}
              {selectedNode.type === 'for_each' && (
                <p className="wf-panel-hint">
                  `items_path` phải trỏ tới một mảng trong state, ví dụ: <code>items</code> hoặc <code>batch_items</code>.
                </p>
              )}
            </div>
          )}

          {isEditable && (
            <>
              <div className="wf-move-grid">
                <button type="button" className="wf-secondary-btn" onClick={() => moveNode(0, -72)}>
                  <MoveUp size={14} />
                  Lên
                </button>
                <button type="button" className="wf-secondary-btn" onClick={() => moveNode(-120, 0)}>
                  <MoveLeft size={14} />
                  Trái
                </button>
                <button type="button" className="wf-secondary-btn" onClick={() => moveNode(120, 0)}>
                  <MoveRight size={14} />
                  Phải
                </button>
                <button type="button" className="wf-secondary-btn" onClick={() => moveNode(0, 72)}>
                  <MoveDown size={14} />
                  Xuống
                </button>
              </div>

              <button type="button" className="wf-danger-btn" onClick={removeSelectedNode}>
                <Trash2 size={14} />
                Xóa node
              </button>
            </>
          )}
        </>
      )}

      {modalConfigKey && selectedNode && (
        <WorkflowHubTextModal
          title={`${selectedNode.label} — ${modalConfigKey}`}
          value={modalDraftValue}
          isEditable={isEditable}
          onSave={(nextValue) => {
            updateDraftNode(selectedNode.id, {
              config: { ...selectedNode.config, [modalConfigKey]: nextValue },
            })
            setModalConfigKey(null)
          }}
          onClose={() => setModalConfigKey(null)}
        />
      )}
    </div>
  )
}
