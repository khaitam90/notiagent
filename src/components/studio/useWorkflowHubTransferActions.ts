import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { DEFAULT_WORKFLOW_FOLDER_ID, TEMPLATE_WORKFLOW_FOLDER_ID, validateWorkflowDefinition, type WorkflowDefinition, type WorkflowVersion } from '../../lib/workflows'
import { deleteWorkflow, fetchWorkflowVersions, restoreWorkflowVersion } from '../../lib/workflowApi'
import { buildWorkflowDefinitionFromWizardPreset, type WorkflowWizardPreset } from './workflowHubPresets'
import { generateId } from '../../lib/uuid'
import type { WorkflowPackageDocument } from './workflowHubTransferData'

type LocalWorkflowPresetLike = {
  id: string
  name: string
  description: string
  savedAt: string
  workflow: WorkflowDefinition
}

type ImportedWorkflowCandidate = {
  fileName: string
  importedAt: string
  workflow: WorkflowDefinition
  packageDocument: WorkflowPackageDocument | null
}

type ViewMode = 'list' | 'editor'

type UseWorkflowHubTransferActionsParams = {
  folderId: string
  workflowId: string | null
  draftWorkflow: WorkflowDefinition | null
  workflowValidationErrors: { message: string }[]
  isDirty: boolean
  setImportedWorkflowCandidate: Dispatch<SetStateAction<ImportedWorkflowCandidate | null>>
  setWorkflows: Dispatch<SetStateAction<WorkflowDefinition[]>>
  setWorkflowId: Dispatch<SetStateAction<string | null>>
  setEditorDraft: Dispatch<SetStateAction<WorkflowDefinition | null>>
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
  setLocalWorkflowPresets: Dispatch<SetStateAction<LocalWorkflowPresetLike[]>>
  setWorkflowVersions: Dispatch<SetStateAction<WorkflowVersion[]>>
  setError: Dispatch<SetStateAction<string | null>>
  errorMessage: (error: unknown) => string
  validationIssueLines: (messages: { message: string }[]) => string
  cloneWorkflowDraft: (workflow: WorkflowDefinition) => WorkflowDefinition
  buildDraftFromPreset: (current: WorkflowDefinition, presetWorkflow: WorkflowDefinition) => WorkflowDefinition
  workflowExportFilename: (workflow: WorkflowDefinition) => string
  workflowPackageFilename: (workflow: WorkflowDefinition) => string
  buildWorkflowPackage: (workflow: WorkflowDefinition) => unknown
  normalizeImportedWorkflowDocument: (raw: unknown, current: WorkflowDefinition) => WorkflowDefinition
  parseWorkflowPackageDocument: (raw: unknown) => WorkflowPackageDocument | null
  relativeTime: (iso: string) => string
}

export function useWorkflowHubTransferActions({
  folderId,
  workflowId,
  draftWorkflow,
  workflowValidationErrors,
  isDirty,
  setImportedWorkflowCandidate,
  setWorkflows,
  setWorkflowId,
  setEditorDraft,
  setViewMode,
  setSelectedNodeId,
  setSelectedEdgeId,
  setLocalWorkflowPresets,
  setWorkflowVersions,
  setError,
  errorMessage,
  validationIssueLines,
  cloneWorkflowDraft,
  buildDraftFromPreset,
  workflowExportFilename,
  workflowPackageFilename,
  buildWorkflowPackage,
  normalizeImportedWorkflowDocument,
  parseWorkflowPackageDocument,
  relativeTime,
}: UseWorkflowHubTransferActionsParams) {
  const importPackageAsNewWorkflowFile = useCallback(async (file: File | null) => {
    if (!file) return
    try {
      const rawText = await file.text()
      const parsed = JSON.parse(rawText) as unknown
      const parsedPackage = parseWorkflowPackageDocument(parsed)
      const fallbackTargetFolderId =
        !folderId || folderId === 'all' || folderId === TEMPLATE_WORKFLOW_FOLDER_ID
          ? DEFAULT_WORKFLOW_FOLDER_ID
          : folderId
      const fallbackCurrent: WorkflowDefinition = {
        id: generateId(),
        folderId: fallbackTargetFolderId,
        name: 'Imported workflow',
        description: '',
        media: 'image',
        category: 'custom',
        published: false,
        component: false,
        componentName: '',
        componentInputSchemaJson: '',
        componentOutputSchemaJson: '',
        tags: [],
        metadataJson: '',
        sourceTemplateId: '',
        updatedAt: new Date().toISOString(),
        nodes: [],
        edges: [],
      }
      const importedWorkflow = normalizeImportedWorkflowDocument(parsed, fallbackCurrent)
      const validation = validateWorkflowDefinition(importedWorkflow)
      if (validation.errors.length > 0) {
        window.alert(`Package/workflow import chưa hợp lệ:\n${validationIssueLines(validation.errors)}`)
        return
      }
      setImportedWorkflowCandidate({
        fileName: file.name,
        importedAt: new Date().toISOString(),
        workflow: importedWorkflow,
        packageDocument: parsedPackage,
      })
      setError(null)
    } catch (importError) {
      window.alert(errorMessage(importError))
    }
  }, [errorMessage, folderId, normalizeImportedWorkflowDocument, parseWorkflowPackageDocument, setError, setImportedWorkflowCandidate, validationIssueLines])

  const deleteWorkflowAction = useCallback(async (workflow: WorkflowDefinition) => {
    if (workflow.category !== 'custom') return
    if (!window.confirm(`Xóa workflow “${workflow.name}”?`)) return
    try {
      await deleteWorkflow(workflow.id)
      setWorkflows((current) => current.filter((item) => item.id !== workflow.id))
      if (workflowId === workflow.id) {
        setWorkflowId(null)
        setEditorDraft(null)
        setViewMode('list')
      }
    } catch (deleteError) {
      window.alert(errorMessage(deleteError))
    }
  }, [errorMessage, setEditorDraft, setViewMode, setWorkflowId, setWorkflows, workflowId])

  const exportWorkflowAction = useCallback(() => {
    if (!draftWorkflow) return
    const payload = JSON.stringify(draftWorkflow, null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = workflowExportFilename(draftWorkflow)
    anchor.click()
    window.URL.revokeObjectURL(url)
  }, [draftWorkflow, workflowExportFilename])

  const exportWorkflowPackageAction = useCallback(() => {
    if (!draftWorkflow) return
    const payload = JSON.stringify(buildWorkflowPackage(draftWorkflow), null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = workflowPackageFilename(draftWorkflow)
    anchor.click()
    window.URL.revokeObjectURL(url)
  }, [buildWorkflowPackage, draftWorkflow, workflowPackageFilename])

  const importWorkflowFile = useCallback(async (file: File | null) => {
    if (!file || !draftWorkflow || draftWorkflow.category !== 'custom') return
    try {
      const rawText = await file.text()
      const parsed = JSON.parse(rawText) as unknown
      const nextWorkflow = normalizeImportedWorkflowDocument(parsed, draftWorkflow)
      const validation = validateWorkflowDefinition(nextWorkflow)
      if (validation.errors.length > 0) {
        window.alert(`File import chưa hợp lệ:\n${validationIssueLines(validation.errors)}`)
        return
      }
      setEditorDraft(nextWorkflow)
      setSelectedNodeId(nextWorkflow.nodes[0]?.id ?? null)
      setSelectedEdgeId(nextWorkflow.edges[0]?.id ?? null)
      setError(null)
    } catch (importError) {
      window.alert(errorMessage(importError))
    }
  }, [draftWorkflow, errorMessage, normalizeImportedWorkflowDocument, setEditorDraft, setError, setSelectedEdgeId, setSelectedNodeId, validationIssueLines])

  const saveLocalPresetAction = useCallback(() => {
    if (!draftWorkflow) return
    const name = draftWorkflow.name.trim() || 'Preset local'
    const description = (draftWorkflow.description || '').trim()
    const nextPreset: LocalWorkflowPresetLike = {
      id: generateId(),
      name,
      description,
      savedAt: new Date().toISOString(),
      workflow: {
        ...cloneWorkflowDraft(draftWorkflow),
        name,
        description,
      },
    }
    setLocalWorkflowPresets((current) => [nextPreset, ...current].slice(0, 40))
  }, [cloneWorkflowDraft, draftWorkflow, setLocalWorkflowPresets])

  const applyLocalPresetAction = useCallback((preset: LocalWorkflowPresetLike) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    if (isDirty && !window.confirm(`Áp preset “${preset.name}” sẽ thay nội dung canvas hiện tại chưa lưu. Tiếp tục?`)) return
    const nextWorkflow = buildDraftFromPreset(draftWorkflow, preset.workflow)
    const validation = validateWorkflowDefinition(nextWorkflow)
    if (validation.errors.length > 0) {
      window.alert(`Preset chưa hợp lệ:\n${validationIssueLines(validation.errors)}`)
      return
    }
    setEditorDraft(nextWorkflow)
    setSelectedNodeId(nextWorkflow.nodes[0]?.id ?? null)
    setSelectedEdgeId(nextWorkflow.edges[0]?.id ?? null)
    setError(null)
  }, [buildDraftFromPreset, draftWorkflow, isDirty, setEditorDraft, setError, setSelectedEdgeId, setSelectedNodeId, validationIssueLines])

  const applyWorkflowWizardToEditorAction = useCallback((preset: WorkflowWizardPreset) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    if (isDirty && !window.confirm(`Áp wizard “${preset.label}” sẽ thay nội dung canvas hiện tại chưa lưu. Tiếp tục?`)) return
    const generated = buildWorkflowDefinitionFromWizardPreset(preset, draftWorkflow.folderId)
    const nextWorkflow = buildDraftFromPreset(draftWorkflow, generated)
    const validation = validateWorkflowDefinition(nextWorkflow)
    if (validation.errors.length > 0) {
      window.alert(`Wizard preset chưa hợp lệ:\n${validationIssueLines(validation.errors)}`)
      return
    }
    setEditorDraft(nextWorkflow)
    setSelectedNodeId(nextWorkflow.nodes[0]?.id ?? null)
    setSelectedEdgeId(nextWorkflow.edges[0]?.id ?? null)
    setError(null)
  }, [buildDraftFromPreset, draftWorkflow, isDirty, setEditorDraft, setError, setSelectedEdgeId, setSelectedNodeId, validationIssueLines])

  const deleteLocalPresetAction = useCallback((preset: LocalWorkflowPresetLike) => {
    if (!window.confirm(`Xóa preset local “${preset.name}”?`)) return
    setLocalWorkflowPresets((current) => current.filter((item) => item.id !== preset.id))
  }, [setLocalWorkflowPresets])

  const restoreVersionAction = useCallback(async (version: WorkflowVersion) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    if (!window.confirm(`Restore workflow về snapshot lúc ${relativeTime(version.createdAt)}?`)) return
    try {
      const restored = await restoreWorkflowVersion(draftWorkflow.id, version.id)
      setWorkflows((current) =>
        [...current.map((item) => (item.id === restored.id ? restored : item))].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
      )
      setEditorDraft(cloneWorkflowDraft(restored))
      setWorkflowVersions(await fetchWorkflowVersions(restored.id))
      setError(null)
    } catch (restoreError) {
      window.alert(errorMessage(restoreError))
    }
  }, [cloneWorkflowDraft, draftWorkflow, errorMessage, relativeTime, setEditorDraft, setError, setWorkflowVersions, setWorkflows])

  return {
    importPackageAsNewWorkflowFile,
    deleteWorkflowAction,
    exportWorkflowAction,
    exportWorkflowPackageAction,
    importWorkflowFile,
    saveLocalPresetAction,
    applyLocalPresetAction,
    applyWorkflowWizardToEditorAction,
    deleteLocalPresetAction,
    restoreVersionAction,
  }
}
