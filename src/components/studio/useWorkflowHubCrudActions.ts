import { useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  DEFAULT_WORKFLOW_FOLDER_ID,
  TEMPLATE_WORKFLOW_FOLDER_ID,
  validateWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowFolder,
  type WorkflowVersion,
} from '../../lib/workflows'
import {
  cloneWorkflow,
  createWorkflow,
  createWorkflowFolder,
  deleteWorkflowFolder,
  fetchWorkflowVersions,
  renameWorkflowFolder,
  updateWorkflow,
} from '../../lib/workflowApi'
import { parseWorkflowMetadata, parseWorkflowTags } from './workflowHubData'
import { buildWorkflowDefinitionFromWizardPreset, type WorkflowWizardPreset } from './workflowHubPresets'

type ViewMode = 'list' | 'editor'

type UseWorkflowHubCrudActionsParams = {
  draftWorkflow: WorkflowDefinition | null
  workflowValidationErrors: { message: string }[]
  folderId: string
  libraryPreviewNameDraft: string
  libraryPreviewDescriptionDraft: string
  libraryPreviewTagInput: string
  libraryPreviewMetadataDraft: string
  setIsSaving: Dispatch<SetStateAction<boolean>>
  setWorkflows: Dispatch<SetStateAction<WorkflowDefinition[]>>
  setEditorDraft: Dispatch<SetStateAction<WorkflowDefinition | null>>
  setWorkflowVersions: Dispatch<SetStateAction<WorkflowVersion[]>>
  setError: Dispatch<SetStateAction<string | null>>
  setFolders: Dispatch<SetStateAction<WorkflowFolder[]>>
  setFolderId: Dispatch<SetStateAction<string>>
  setWorkflowId: Dispatch<SetStateAction<string | null>>
  setViewMode: Dispatch<SetStateAction<ViewMode>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
  refreshData: (silent?: boolean) => Promise<void>
  confirmDiscardChanges: () => boolean
  errorMessage: (error: unknown) => string
  validationIssueLines: (messages: { message: string }[]) => string
  cloneWorkflowDraft: (workflow: WorkflowDefinition) => WorkflowDefinition
  buildDraftFromPreset: (current: WorkflowDefinition, presetWorkflow: WorkflowDefinition) => WorkflowDefinition
  mergeWorkflowTags: (...groups: Array<string[] | null | undefined>) => string[]
  stringifyWorkflowTags: (tags: string[]) => string[]
}

export function useWorkflowHubCrudActions({
  draftWorkflow,
  workflowValidationErrors,
  folderId,
  libraryPreviewNameDraft,
  libraryPreviewDescriptionDraft,
  libraryPreviewTagInput,
  libraryPreviewMetadataDraft,
  setIsSaving,
  setWorkflows,
  setEditorDraft,
  setWorkflowVersions,
  setError,
  setFolders,
  setFolderId,
  setWorkflowId,
  setViewMode,
  setSelectedEdgeId,
  refreshData,
  confirmDiscardChanges,
  errorMessage,
  validationIssueLines,
  cloneWorkflowDraft,
  buildDraftFromPreset,
  mergeWorkflowTags,
  stringifyWorkflowTags,
}: UseWorkflowHubCrudActionsParams) {
  const targetFolderId = useCallback(() => {
    return !folderId || folderId === 'all' || folderId === TEMPLATE_WORKFLOW_FOLDER_ID
      ? DEFAULT_WORKFLOW_FOLDER_ID
      : folderId
  }, [folderId])

  const saveWorkflowDraft = useCallback(async () => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    if (workflowValidationErrors.length > 0) {
      window.alert(`Workflow chưa hợp lệ để lưu:\n${validationIssueLines(workflowValidationErrors)}`)
      return
    }
    setIsSaving(true)
    try {
      const saved = await updateWorkflow(draftWorkflow.id, {
        name: draftWorkflow.name,
        description: draftWorkflow.description,
        folderId: draftWorkflow.folderId,
        media: draftWorkflow.media,
        published: draftWorkflow.published,
        component: draftWorkflow.component,
        componentName: draftWorkflow.componentName,
        componentInputSchemaJson: draftWorkflow.componentInputSchemaJson,
        componentOutputSchemaJson: draftWorkflow.componentOutputSchemaJson,
        tags: parseWorkflowTags(draftWorkflow),
        metadataJson: String(draftWorkflow.metadataJson || ''),
        nodes: draftWorkflow.nodes,
        edges: draftWorkflow.edges,
      })
      setWorkflows((current) =>
        [...current.map((item) => (item.id === saved.id ? saved : item))].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
      )
      setEditorDraft(cloneWorkflowDraft(saved))
      setWorkflowVersions(await fetchWorkflowVersions(saved.id))
      setError(null)
    } catch (saveError) {
      window.alert(errorMessage(saveError))
    } finally {
      setIsSaving(false)
    }
  }, [
    cloneWorkflowDraft,
    draftWorkflow,
    errorMessage,
    setEditorDraft,
    setError,
    setIsSaving,
    setWorkflowVersions,
    setWorkflows,
    validationIssueLines,
    workflowValidationErrors,
  ])

  const createFolderAction = useCallback(async () => {
    // 2026-07-26d: bo window.prompt() - cung rui ro bi trinh duyet/app chan am tham nhu 2 cho da sua truoc.
    // Dat ten mac dinh theo gio tao, doi ten sau bang nut sua (pencil icon) canh ten thu muc.
    const name = `Thư mục mới ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    try {
      const nextFolder = await createWorkflowFolder(name.trim())
      setFolders((current) => [...current, nextFolder])
      setFolderId(nextFolder.id)
    } catch (createError) {
      window.alert(errorMessage(createError))
    }
  }, [errorMessage, setFolderId, setFolders])

  const renameFolderAction = useCallback(async (folder: WorkflowFolder, newName: string) => {
    // 2026-07-26e: bo window.prompt() - thay bang o nhap inline ngay trong WorkflowHubLibrarySidebar
    // (bam icon but -> hien input tai cho -> Enter/blur de luu, Escape de huy). Ham nay gio nhan
    // thang ten moi da duoc nguoi dung xac nhan, khong tu hoi nua.
    if (folder.system) return
    if (!newName.trim() || newName.trim() === folder.name) return
    try {
      const updated = await renameWorkflowFolder(folder.id, newName.trim())
      setFolders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (renameError) {
      window.alert(errorMessage(renameError))
    }
  }, [errorMessage, setFolders])

  const deleteFolderAction = useCallback(async (folder: WorkflowFolder) => {
    if (folder.system) return
    if (!window.confirm(`Xóa thư mục “${folder.name}”? Workflow trong thư mục sẽ được chuyển về “Workflow của tôi”.`)) return
    try {
      await deleteWorkflowFolder(folder.id)
      await refreshData(true)
      if (folderId === folder.id) setFolderId(DEFAULT_WORKFLOW_FOLDER_ID)
    } catch (deleteError) {
      window.alert(errorMessage(deleteError))
    }
  }, [errorMessage, folderId, refreshData, setFolderId])

  const createWorkflowAction = useCallback(async () => {
    // 2026-07-26: bo window.prompt() vi bi trinh duyet/app nhung chan am tham (nut bam khong phan hoi,
    // khong loi). Dat ten mac dinh, doi ten sau trong o "Ten workflow" cua Inspector (da xac nhan hoat dong).
    const name = `Workflow ${new Date().toLocaleDateString('vi-VN')}`
    const nextFolderId = targetFolderId()
    try {
      const created = await createWorkflow(name.trim(), nextFolderId)
      setWorkflows((current) => [created, ...current].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
      setFolderId(nextFolderId)
      setWorkflowId(created.id)
      setViewMode('editor')
    } catch (createError) {
      window.alert(errorMessage(createError))
    }
  }, [errorMessage, setFolderId, setViewMode, setWorkflowId, setWorkflows, targetFolderId])

  const createWorkflowFromDefinitionAction = useCallback(async (
    sourceWorkflow: WorkflowDefinition,
    options?: { suggestedName?: string; openInEditor?: boolean },
  ) => {
    const suggestedName = options?.suggestedName?.trim() || sourceWorkflow.name || `Workflow ${new Date().toLocaleDateString('vi-VN')}`
    // 2026-07-26: bo window.prompt() vi bi trinh duyet/app nhung chan am tham (nut bam khong phan hoi,
    // khong loi). Dung thang ten goi y, doi ten sau trong o "Ten workflow" cua Inspector.
    const name = suggestedName
    const nextFolderId = targetFolderId()
    try {
      const created = await createWorkflow(name.trim(), nextFolderId)
      const nextDraft = buildDraftFromPreset(created, {
        ...cloneWorkflowDraft(sourceWorkflow),
        name: name.trim(),
      })
      const saved = await updateWorkflow(created.id, {
        name: nextDraft.name,
        description: nextDraft.description,
        folderId: nextDraft.folderId,
        media: nextDraft.media,
        published: false,
        component: nextDraft.component,
        componentName: nextDraft.componentName,
        componentInputSchemaJson: nextDraft.componentInputSchemaJson,
        componentOutputSchemaJson: nextDraft.componentOutputSchemaJson,
        tags: parseWorkflowTags(nextDraft),
        metadataJson: String(nextDraft.metadataJson || ''),
        nodes: nextDraft.nodes,
        edges: nextDraft.edges,
      })
      setWorkflows((current) =>
        [saved, ...current.filter((item) => item.id !== saved.id)].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      )
      setFolderId(nextFolderId)
      if (options?.openInEditor !== false) {
        setWorkflowId(saved.id)
        setViewMode('editor')
      }
      setError(null)
    } catch (createError) {
      window.alert(errorMessage(createError))
    }
  }, [
    buildDraftFromPreset,
    cloneWorkflowDraft,
    errorMessage,
    setError,
    setFolderId,
    setViewMode,
    setWorkflowId,
    setWorkflows,
    targetFolderId,
  ])

  const createWorkflowFromWizardPresetAction = useCallback(async (preset: WorkflowWizardPreset) => {
    const nextDefinition = buildWorkflowDefinitionFromWizardPreset(preset, targetFolderId())
    await createWorkflowFromDefinitionAction(nextDefinition, {
      suggestedName: preset.label,
      openInEditor: true,
    })
  }, [createWorkflowFromDefinitionAction, targetFolderId])

  const openWorkflow = useCallback((id: string) => {
    if (!confirmDiscardChanges()) return
    setWorkflowId(id)
    setSelectedEdgeId(null)
    setViewMode('editor')
  }, [confirmDiscardChanges, setSelectedEdgeId, setViewMode, setWorkflowId])

  const cloneWorkflowAction = useCallback(async (workflow: WorkflowDefinition) => {
    if (!confirmDiscardChanges()) return
    try {
      const cloned = await cloneWorkflow(workflow.id, DEFAULT_WORKFLOW_FOLDER_ID)
      setWorkflows((current) => [cloned, ...current].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)))
      setFolderId(DEFAULT_WORKFLOW_FOLDER_ID)
      setWorkflowId(cloned.id)
      setViewMode('editor')
    } catch (cloneError) {
      window.alert(errorMessage(cloneError))
    }
  }, [confirmDiscardChanges, errorMessage, setFolderId, setViewMode, setWorkflowId, setWorkflows])

  const saveAsStarterAction = useCallback(async (workflow: WorkflowDefinition) => {
    if (!confirmDiscardChanges()) return
    try {
      const cloned = await cloneWorkflow(workflow.id, DEFAULT_WORKFLOW_FOLDER_ID)
      const sourceMetadata = parseWorkflowMetadata(workflow)
      const nextMetadata = {
        ...sourceMetadata,
        starter: true,
        starter_source_id: workflow.id,
        starter_saved_at: new Date().toISOString(),
      }
      const updated = await updateWorkflow(cloned.id, {
        tags: mergeWorkflowTags(parseWorkflowTags(workflow), ['starter']),
        metadataJson: JSON.stringify(nextMetadata, null, 2),
      })
      setWorkflows((current) =>
        [updated, ...current.filter((item) => item.id !== updated.id)].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
      )
      setFolderId(DEFAULT_WORKFLOW_FOLDER_ID)
      setWorkflowId(updated.id)
      setViewMode('editor')
      setError(null)
    } catch (starterError) {
      window.alert(errorMessage(starterError))
    }
  }, [confirmDiscardChanges, errorMessage, mergeWorkflowTags, setError, setFolderId, setViewMode, setWorkflowId, setWorkflows])

  const quickUpdateWorkflowAction = useCallback(async (workflow: WorkflowDefinition, patch: Partial<WorkflowDefinition>) => {
    if (workflow.category !== 'custom') return
    try {
      const updated = await updateWorkflow(workflow.id, patch)
      setWorkflows((current) =>
        [...current.map((item) => (item.id === updated.id ? updated : item))].sort(
          (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
        ),
      )
      setEditorDraft((current) => (current?.id === updated.id ? cloneWorkflowDraft(updated) : current))
      setError(null)
    } catch (updateError) {
      window.alert(errorMessage(updateError))
    }
  }, [cloneWorkflowDraft, errorMessage, setEditorDraft, setError, setWorkflows])

  const saveLibraryPreviewMetaAction = useCallback(async (workflow: WorkflowDefinition) => {
    if (workflow.category !== 'custom') return
    const rawMetadata = libraryPreviewMetadataDraft.trim()
    if (rawMetadata) {
      try {
        const parsed = JSON.parse(rawMetadata) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          window.alert('Metadata JSON trong preview phải là object hợp lệ.')
          return
        }
      } catch {
        window.alert('Metadata JSON trong preview không hợp lệ.')
        return
      }
    }
    await quickUpdateWorkflowAction(workflow, {
      tags: stringifyWorkflowTags(libraryPreviewTagInput.split(',').map((item) => item.trim())),
      metadataJson: rawMetadata,
    })
  }, [libraryPreviewMetadataDraft, libraryPreviewTagInput, quickUpdateWorkflowAction, stringifyWorkflowTags])

  const saveLibraryPreviewOverviewAction = useCallback(async (workflow: WorkflowDefinition) => {
    if (workflow.category !== 'custom') return
    const nextName = libraryPreviewNameDraft.trim()
    if (!nextName) {
      window.alert('Tên workflow không được để trống.')
      return
    }
    await quickUpdateWorkflowAction(workflow, {
      name: nextName,
      description: libraryPreviewDescriptionDraft,
    })
  }, [libraryPreviewDescriptionDraft, libraryPreviewNameDraft, quickUpdateWorkflowAction])

  return {
    saveWorkflowDraft,
    createFolderAction,
    renameFolderAction,
    deleteFolderAction,
    createWorkflowAction,
    createWorkflowFromDefinitionAction,
    createWorkflowFromWizardPresetAction,
    openWorkflow,
    cloneWorkflowAction,
    saveAsStarterAction,
    quickUpdateWorkflowAction,
    saveLibraryPreviewMetaAction,
    saveLibraryPreviewOverviewAction,
  }
}
