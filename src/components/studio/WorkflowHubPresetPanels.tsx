import type { WorkflowDefinition, WorkflowMedia } from '../../lib/workflows'
import type { WorkflowWizardPreset } from './workflowHubPresets'

type LocalWorkflowPresetLike = {
  id: string
  name: string
  description: string
  savedAt: string
  workflow: WorkflowDefinition
}

type WizardPresetPanelProps = {
  presets: WorkflowWizardPreset[]
  selectedPresetId: string | null
  onSelectPreset: (id: string) => void
  onPrimaryAction: (preset: WorkflowWizardPreset) => void
  primaryLabel: string
  primaryDisabled?: boolean
  mediaLabel: (media: WorkflowMedia) => string
  previewMetaLabel: string
}

export function WorkflowWizardPresetPanel({
  presets,
  selectedPresetId,
  onSelectPreset,
  onPrimaryAction,
  primaryLabel,
  primaryDisabled = false,
  mediaLabel,
  previewMetaLabel,
}: WizardPresetPanelProps) {
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null

  return (
    <>
      <div className="wf-preset-list">
        {presets.map((preset) => (
          <article
            key={preset.id}
            className={`wf-preset-item${selectedPreset?.id === preset.id ? ' is-selected' : ''}`}
          >
            <div className="wf-preset-item-top">
              <strong>{preset.label}</strong>
              <span className={`wf-media-badge media-${preset.media}`}>{mediaLabel(preset.media)}</span>
            </div>
            <p>{preset.description}</p>
            <div className="wf-preset-item-meta">
              <span>{preset.nodes.length} node</span>
              <span>{preset.edges.length} liên kết</span>
              <span>{preset.tags.join(' · ')}</span>
            </div>
            <div className="wf-preset-item-actions">
              <button type="button" className="wf-secondary-btn" onClick={() => onSelectPreset(preset.id)}>
                Xem trước
              </button>
              <button
                type="button"
                className="wf-primary-btn"
                onClick={() => onPrimaryAction(preset)}
                disabled={primaryDisabled}
              >
                {primaryLabel}
              </button>
            </div>
          </article>
        ))}
      </div>
      {selectedPreset && (
        <div className="wf-preset-preview">
          <div className="wf-preset-preview-head">
            <strong>{selectedPreset.label}</strong>
            <span className={`wf-media-badge media-${selectedPreset.media}`}>{mediaLabel(selectedPreset.media)}</span>
          </div>
          <p>{selectedPreset.description}</p>
          <div className="wf-preset-item-meta">
            <span>{selectedPreset.nodes.length} node</span>
            <span>{selectedPreset.edges.length} liên kết</span>
            <span>{previewMetaLabel}</span>
          </div>
          <div className="wf-tag-row">
            {selectedPreset.tags.map((tag) => (
              <span key={`${selectedPreset.id}-${tag}`} className="wf-tag-chip">
                #{tag}
              </span>
            ))}
          </div>
          <div className="wf-library-meta-grid">
            {selectedPreset.nodes.map((node) => (
              <div key={`${selectedPreset.id}-${node.key}`} className="wf-library-meta-item">
                <strong>{node.label || node.type}</strong>
                <span>{node.type} · {node.description || 'Không có mô tả'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

type LocalPresetPanelProps = {
  presets: LocalWorkflowPresetLike[]
  selectedPresetId: string | null
  onSelectPreset: (id: string) => void
  onPrimaryAction: (preset: LocalWorkflowPresetLike) => void
  primaryLabel: string
  mode: 'create' | 'apply'
  onDeleteAction?: (preset: LocalWorkflowPresetLike) => void
  mediaLabel: (media: WorkflowMedia) => string
  relativeTime: (iso: string) => string
  metadataEntries: (workflow: WorkflowDefinition) => Array<[string, string]>
}

export function WorkflowLocalPresetPanel({
  presets,
  selectedPresetId,
  onSelectPreset,
  onPrimaryAction,
  primaryLabel,
  mode,
  onDeleteAction,
  mediaLabel,
  relativeTime,
  metadataEntries,
}: LocalPresetPanelProps) {
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId) ?? presets[0] ?? null

  return (
    <>
      <div className="wf-preset-list">
        {presets.map((preset) => (
          <article key={preset.id} className={`wf-preset-item${selectedPreset?.id === preset.id ? ' is-selected' : ''}`}>
            <div className="wf-preset-item-top">
              <strong>{preset.name}</strong>
              <span className={`wf-media-badge media-${preset.workflow.media}`}>{mediaLabel(preset.workflow.media)}</span>
            </div>
            <p>{preset.description || 'Không có mô tả preset.'}</p>
            <div className="wf-preset-item-meta">
              <span>{preset.workflow.nodes.length} node</span>
              <span>{preset.workflow.edges.length} liên kết</span>
              <span>Lưu {relativeTime(preset.savedAt)}</span>
            </div>
            {preset.workflow.tags && preset.workflow.tags.length > 0 && (
              <div className="wf-tag-row">
                {preset.workflow.tags.slice(0, 4).map((tag) => (
                  <span key={`${preset.id}-${tag}`} className="wf-tag-chip">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
            <div className="wf-preset-item-actions">
              {mode === 'create' && (
                <button type="button" className="wf-secondary-btn" onClick={() => onSelectPreset(preset.id)}>
                  Xem trước
                </button>
              )}
              <button type="button" className={mode === 'create' ? 'wf-primary-btn' : 'wf-secondary-btn'} onClick={() => onPrimaryAction(preset)}>
                {primaryLabel}
              </button>
              {mode === 'apply' && onDeleteAction && (
                <button type="button" className="wf-danger-btn" onClick={() => onDeleteAction(preset)}>
                  Xóa
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {selectedPreset && (
        <div className="wf-preset-preview">
          <div className="wf-preset-preview-head">
            <strong>{selectedPreset.name}</strong>
            <span className={`wf-media-badge media-${selectedPreset.workflow.media}`}>{mediaLabel(selectedPreset.workflow.media)}</span>
          </div>
          <p>{selectedPreset.description || 'Không có mô tả preset.'}</p>
          <div className="wf-preset-item-meta">
            <span>{selectedPreset.workflow.nodes.length} node</span>
            <span>{selectedPreset.workflow.edges.length} liên kết</span>
            <span>Lưu {relativeTime(selectedPreset.savedAt)}</span>
          </div>
          {metadataEntries(selectedPreset.workflow).length > 0 && (
            <div className="wf-library-meta-grid">
              {metadataEntries(selectedPreset.workflow).slice(0, 4).map(([key, value]) => (
                <div key={`${selectedPreset.id}-${key}`} className="wf-library-meta-item">
                  <strong>{key}</strong>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
