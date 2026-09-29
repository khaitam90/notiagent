import { useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { Boxes, Copy, Save, Search, Wand2, Workflow } from 'lucide-react'
import type {
  WorkflowBlockTemplate,
  WorkflowDefinition,
  WorkflowMedia,
  WorkflowNodeType,
  WorkflowRun,
} from '../../lib/workflows'
import {
  WorkflowLocalPresetPanel,
} from './WorkflowHubPresetPanels'
import { WorkflowHubRunPanels } from './WorkflowHubRunPanels'
import { WorkflowHubCollapsibleSection } from './WorkflowHubCollapsibleSection'
import type { NodeLibraryItem } from './workflowHubUtils'

type LocalWorkflowPresetLike = {
  id: string
  name: string
  description: string
  savedAt: string
  workflow: WorkflowDefinition
}

type ValidationIssueLike = {
  code: string
  message: string
}

type PaletteTab = 'blocks' | 'component' | 'local'

type WorkflowHubEditorPaletteProps = {
  isEditable: boolean
  mediaLabel: (media: WorkflowMedia) => string
  nodeLibraryItems: NodeLibraryItem[]
  onAddNode: (type: WorkflowNodeType) => void
  onOpenNodeQuickAdd: () => void
  groupedWorkflowBlocks: Array<{ group: string; blocks: WorkflowBlockTemplate[] }>
  onAddBlock: (block: WorkflowBlockTemplate) => void
  componentWorkflowOptions: WorkflowDefinition[]
  onAddComponentWorkflowBlock: (workflow: WorkflowDefinition) => void
  parseComponentInputSchema: (workflow: WorkflowDefinition | null | undefined) => string[]
  parseComponentOutputSchema: (workflow: WorkflowDefinition | null | undefined) => Record<string, string>
  onSaveLocalPreset: () => void
  localWorkflowPresets: LocalWorkflowPresetLike[]
  selectedLocalPresetId: string | null
  onSelectLocalPreset: (id: string) => void
  onApplyLocalPreset: (preset: LocalWorkflowPresetLike) => void
  onDeleteLocalPreset: (preset: LocalWorkflowPresetLike) => void
  relativeTime: (iso: string) => string
  previewWorkflowMetadataEntries: (workflow: WorkflowDefinition) => Array<[string, string]>
  draftWorkflow: WorkflowDefinition
  currentMode: 'image' | 'video' | 'automation'
  displayedRunFields: string[]
  runInputValues: Record<string, string>
  setRunInputValues: Dispatch<SetStateAction<Record<string, string>>>
  runVariablesJson: string
  setRunVariablesJson: Dispatch<SetStateAction<string>>
  runMode: 'image' | 'video'
  setRunMode: Dispatch<SetStateAction<'image' | 'video'>>
  runWorkflowAction: () => void | Promise<void>
  isRunning: boolean
  workflowValidationErrors: ValidationIssueLike[]
  workflowValidationWarnings: ValidationIssueLike[]
  currentRuns: WorkflowRun[]
  selectedRunId: string | null
  setSelectedRunId: Dispatch<SetStateAction<string | null>>
  setSelectedTraceNodeId: Dispatch<SetStateAction<string | null>>
  inputFieldLabel: (field: string) => string
  isLongTextField: (field: string) => boolean
  inputFieldPlaceholder: (field: string) => string
  inputFieldHint: (field: string) => string
  statusClass: (status: WorkflowRun['status']) => string
  statusLabel: (status: WorkflowRun['status']) => string
  prettyJson: (value: unknown) => string
}

export function WorkflowHubEditorPalette({
  isEditable,
  mediaLabel,
  nodeLibraryItems,
  onAddNode,
  onOpenNodeQuickAdd,
  groupedWorkflowBlocks,
  onAddBlock,
  componentWorkflowOptions,
  onAddComponentWorkflowBlock,
  parseComponentInputSchema,
  parseComponentOutputSchema,
  onSaveLocalPreset,
  localWorkflowPresets,
  selectedLocalPresetId,
  onSelectLocalPreset,
  onApplyLocalPreset,
  onDeleteLocalPreset,
  relativeTime,
  previewWorkflowMetadataEntries,
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
  prettyJson,
}: WorkflowHubEditorPaletteProps) {
  const [paletteTab, setPaletteTab] = useState<PaletteTab>('blocks')

  return (
    <aside className="wf-palette">

      <WorkflowHubCollapsibleSection
        title="Thư viện node"
        icon={<Workflow size={16} />}
        summary="Thêm node đơn lẻ"
        count={nodeLibraryItems.length}
        defaultOpen
      >
        {/* 2026-07-26j: bo danh sach day (trung voi popover "+ Them node" tren canvas - 2 cho cung
            lam 1 viec). Chi giu 1 nut mo dung popover do, tranh 2 UI trung lap cung luc tren man hinh. */}
        <p className="wf-panel-hint">Có {nodeLibraryItems.length} loại node — bấm nút dưới hoặc nút "+ Thêm node" trên canvas để tìm và thêm.</p>
        <button type="button" className="wf-secondary-btn" onClick={onOpenNodeQuickAdd} disabled={!isEditable}>
          <Search size={14} />
          Mở bảng thêm node
        </button>
      </WorkflowHubCollapsibleSection>


      {/* 2026-07-26n: gop 3 khoi rieng (Cum workflow / Cum component / Preset cuc bo) thanh 1
          khoi "Mau & khoi dung san" co tab con - truoc day 4 header rieng luon hien cung luc
          la nguon "roi" chinh o sidebar trai.
          2026-07-28: bo han tab "Preset" (WORKFLOW_WIZARD_PRESETS) khoi day - no trung 100%
          voi "Trinh tao workflow" o sidebar danh sach workflow (cung mot danh sach preset,
          cung mot muc dich "dung nhanh 1 khung workflow hoan chinh"), chi khac hanh dong
          (tao workflow MOI vs de len canvas dang mo, it dung va de ghi de nham noi dung dang
          sua). Tao workflow tu preset gio chi lam 1 noi duy nhat: sidebar danh sach. */}
      <WorkflowHubCollapsibleSection
        title="Mẫu & khối dựng sẵn"
        icon={<Wand2 size={16} />}
        summary="Cụm node, component, preset local"
        count={groupedWorkflowBlocks.reduce((sum, group) => sum + group.blocks.length, 0) + componentWorkflowOptions.length + localWorkflowPresets.length}
      >
        <div className="wf-palette-tabs">
          <button type="button" className={`wf-palette-tab${paletteTab === 'blocks' ? ' active' : ''}`} onClick={() => setPaletteTab('blocks')}>
            <Copy size={13} />
            Cụm
          </button>
          <button type="button" className={`wf-palette-tab${paletteTab === 'component' ? ' active' : ''}`} onClick={() => setPaletteTab('component')}>
            <Boxes size={13} />
            Component
          </button>
          <button type="button" className={`wf-palette-tab${paletteTab === 'local' ? ' active' : ''}`} onClick={() => setPaletteTab('local')}>
            <Save size={13} />
            Local
          </button>
        </div>
        {paletteTab === 'blocks' && (
          <div className="wf-palette-tab-panel">
        <p className="wf-panel-hint">Thư viện starter kit theo nhóm use case để dựng workflow nhanh hơn, gần kiểu workflow builder tổng quát.</p>
        <div className="wf-block-groups">
          {groupedWorkflowBlocks.map((group) => (
            <section key={group.group} className="wf-block-group">
              <div className="wf-block-group-head">
                <strong>{group.group}</strong>
                <small>{group.blocks.length} mẫu</small>
              </div>
              <div className="wf-block-library">
                {group.blocks.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    className="wf-block-library-item"
                    onClick={() => onAddBlock(block)}
                    disabled={!isEditable}
                  >
                    <span>
                      <strong>{block.name}</strong>
                      <small>{block.description}</small>
                    </span>
                    <em>{block.nodes.length} node · {block.difficulty || 'Cơ bản'}</em>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      
          </div>
        )}
        {paletteTab === 'component' && (
          <div className="wf-palette-tab-panel">
        <p className="wf-panel-hint">Các workflow custom đã publish thành component sẽ xuất hiện ở đây để chèn thẳng vào canvas như block tái sử dụng.</p>
        {componentWorkflowOptions.length === 0 ? (
          <p className="wf-panel-hint">Chưa có component custom nào được publish.</p>
        ) : (
          <div className="wf-block-library">
            {componentWorkflowOptions.map((workflow) => (
              <button
                key={workflow.id}
                type="button"
                className="wf-block-library-item"
                onClick={() => onAddComponentWorkflowBlock(workflow)}
                disabled={!isEditable}
              >
                <span>
                  <strong>{workflow.componentName || workflow.name}</strong>
                  <small>{workflow.description || 'Component workflow nội bộ.'}</small>
                </span>
                <em>
                  {parseComponentInputSchema(workflow).length} in · {Object.keys(parseComponentOutputSchema(workflow)).length} out
                </em>
              </button>
            ))}
          </div>
        )}
      
          </div>
        )}
        {paletteTab === 'local' && (
          <div className="wf-palette-tab-panel">
        <p className="wf-panel-hint">Lưu workflow hiện tại thành preset local để tái dùng nhanh mà không cần backend mới.</p>
        <div className="wf-schema-actions">
          <button type="button" className="wf-secondary-btn" onClick={onSaveLocalPreset}>
            <Save size={14} />
            Lưu preset local
          </button>
        </div>
        {localWorkflowPresets.length === 0 ? (
          <p className="wf-panel-hint">Chưa có preset local nào.</p>
        ) : (
          <WorkflowLocalPresetPanel
            presets={localWorkflowPresets}
            selectedPresetId={selectedLocalPresetId}
            onSelectPreset={onSelectLocalPreset}
            onPrimaryAction={onApplyLocalPreset}
            primaryLabel="Áp vào canvas"
            mode="apply"
            onDeleteAction={onDeleteLocalPreset}
            mediaLabel={mediaLabel}
            relativeTime={relativeTime}
            metadataEntries={previewWorkflowMetadataEntries}
          />
        )}
      
          </div>
        )}
      </WorkflowHubCollapsibleSection>

      <WorkflowHubRunPanels
        draftWorkflow={draftWorkflow}
        currentMode={currentMode}
        displayedRunFields={displayedRunFields}
        runInputValues={runInputValues}
        setRunInputValues={setRunInputValues}
        runVariablesJson={runVariablesJson}
        setRunVariablesJson={setRunVariablesJson}
        runMode={runMode}
        setRunMode={setRunMode}
        runWorkflowAction={runWorkflowAction}
        isRunning={isRunning}
        workflowValidationErrors={workflowValidationErrors}
        workflowValidationWarnings={workflowValidationWarnings}
        currentRuns={currentRuns}
        selectedRunId={selectedRunId}
        setSelectedRunId={setSelectedRunId}
        setSelectedTraceNodeId={setSelectedTraceNodeId}
        inputFieldLabel={inputFieldLabel}
        isLongTextField={isLongTextField}
        inputFieldPlaceholder={inputFieldPlaceholder}
        inputFieldHint={inputFieldHint}
        statusClass={statusClass}
        statusLabel={statusLabel}
        relativeTime={relativeTime}
        prettyJson={prettyJson}
      />
    </aside>
  )
}
