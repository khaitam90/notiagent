import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { WorkflowDefinition } from '../../lib/workflows'
import type { WorkflowCollection } from './useWorkflowHubLibraryData'
import { generateId } from '../../lib/uuid'

type UseWorkflowHubCollectionActionsParams = {
  favoriteWorkflowIds: string[]
  customCollections: WorkflowCollection[]
  activeLibraryCollectionId: string
  selectedVisibleWorkflows: WorkflowDefinition[]
  selectedVisibleCustomWorkflows: WorkflowDefinition[]
  sortedVisibleWorkflows: WorkflowDefinition[]
  setFavoriteWorkflowIds: Dispatch<SetStateAction<string[]>>
  setCustomCollections: Dispatch<SetStateAction<WorkflowCollection[]>>
  setActiveLibraryCollectionId: Dispatch<SetStateAction<string>>
  setSelectedWorkflowIds: Dispatch<SetStateAction<string[]>>
  setIsBulkUpdating: Dispatch<SetStateAction<boolean>>
  errorMessage: (error: unknown) => string
  saveAsStarterAction: (workflow: WorkflowDefinition) => Promise<void>
  quickUpdateWorkflowAction: (workflow: WorkflowDefinition, patch: Partial<WorkflowDefinition>) => Promise<void>
}

export function useWorkflowHubCollectionActions({
  favoriteWorkflowIds,
  customCollections,
  activeLibraryCollectionId,
  selectedVisibleWorkflows,
  selectedVisibleCustomWorkflows,
  sortedVisibleWorkflows,
  setFavoriteWorkflowIds,
  setCustomCollections,
  setActiveLibraryCollectionId,
  setSelectedWorkflowIds,
  setIsBulkUpdating,
  errorMessage,
  saveAsStarterAction,
  quickUpdateWorkflowAction,
}: UseWorkflowHubCollectionActionsParams) {
  const toggleFavoriteWorkflow = useCallback((workflowId: string) => {
    setFavoriteWorkflowIds((current) =>
      current.includes(workflowId) ? current.filter((item) => item !== workflowId) : [workflowId, ...current],
    )
  }, [setFavoriteWorkflowIds])

  const createCustomCollectionAction = useCallback(() => {
    const existingNames = new Set(customCollections.map((collection) => collection.name.trim().toLowerCase()))
    let name = 'Bộ sưu tập mới'
    let suffix = 2
    while (existingNames.has(name.toLowerCase())) {
      name = `Bộ sưu tập mới ${suffix}`
      suffix += 1
    }
    const nextCollection: WorkflowCollection = {
      id: generateId(),
      name,
      workflowIds: [],
    }
    setCustomCollections((current) => [nextCollection, ...current])
    setActiveLibraryCollectionId(nextCollection.id)
  }, [customCollections, setActiveLibraryCollectionId, setCustomCollections])

  const renameCustomCollectionAction = useCallback((collection: WorkflowCollection, newName: string) => {
    // 2026-07-26e: bo window.prompt(), nhan ten moi tu o nhap inline trong sidebar (cung pattern voi
    // renameFolderAction o useWorkflowHubCrudActions.ts).
    if (!newName.trim() || newName.trim() === collection.name) return
    setCustomCollections((current) =>
      current.map((item) => (item.id === collection.id ? { ...item, name: newName.trim() } : item)),
    )
  }, [setCustomCollections])

  const deleteCustomCollectionAction = useCallback((collection: WorkflowCollection) => {
    if (!window.confirm(`Xóa collection “${collection.name}”?`)) return
    setCustomCollections((current) => current.filter((item) => item.id !== collection.id))
    setActiveLibraryCollectionId((current) => (current === collection.id ? 'all' : current))
  }, [setActiveLibraryCollectionId, setCustomCollections])

  const toggleWorkflowInCollection = useCallback((collectionId: string, workflowId: string) => {
    setCustomCollections((current) =>
      current.map((item) => {
        if (item.id !== collectionId) return item
        const exists = item.workflowIds.includes(workflowId)
        return {
          ...item,
          workflowIds: exists ? item.workflowIds.filter((entry) => entry !== workflowId) : [...item.workflowIds, workflowId],
        }
      }),
    )
  }, [setCustomCollections])

  const exportCollectionsAction = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      favorites: favoriteWorkflowIds,
      collections: customCollections,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `workflow-collections-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    window.URL.revokeObjectURL(url)
  }, [customCollections, favoriteWorkflowIds])

  const importCollectionsFile = useCallback(async (file: File | null) => {
    if (!file) return
    try {
      const raw = await file.text()
      const parsed = JSON.parse(raw) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        window.alert('File collection không hợp lệ.')
        return
      }
      const payload = parsed as Record<string, unknown>
      const importedFavorites = Array.isArray(payload.favorites)
        ? payload.favorites.map((item) => String(item || '').trim()).filter(Boolean)
        : []
      const importedCollections = Array.isArray(payload.collections)
        ? payload.collections
            .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
            .map((item) => {
              const value = item as Record<string, unknown>
              return {
                id: String(value.id || generateId()),
                name: String(value.name || 'Bộ sưu tập'),
                workflowIds: Array.isArray(value.workflowIds)
                  ? value.workflowIds.map((entry) => String(entry || '').trim()).filter(Boolean)
                  : [],
              } satisfies WorkflowCollection
            })
        : []
      setFavoriteWorkflowIds(importedFavorites)
      setCustomCollections(importedCollections)
      setActiveLibraryCollectionId('all')
    } catch {
      window.alert('Không đọc được file collection.')
    }
  }, [setActiveLibraryCollectionId, setCustomCollections, setFavoriteWorkflowIds])

  const toggleWorkflowSelection = useCallback((workflowIdValue: string) => {
    setSelectedWorkflowIds((current) =>
      current.includes(workflowIdValue) ? current.filter((item) => item !== workflowIdValue) : [...current, workflowIdValue],
    )
  }, [setSelectedWorkflowIds])

  const selectAllVisibleWorkflowsAction = useCallback(() => {
    setSelectedWorkflowIds(sortedVisibleWorkflows.map((workflow) => workflow.id))
  }, [setSelectedWorkflowIds, sortedVisibleWorkflows])

  const clearWorkflowSelectionAction = useCallback(() => {
    setSelectedWorkflowIds([])
  }, [setSelectedWorkflowIds])

  const runBulkWorkflowAction = useCallback(
    async (label: string, list: WorkflowDefinition[], task: (workflow: WorkflowDefinition) => Promise<void>) => {
      if (list.length === 0) return
      setIsBulkUpdating(true)
      let successCount = 0
      const failures: string[] = []
      try {
        for (const workflow of list) {
          try {
            await task(workflow)
            successCount += 1
          } catch (bulkError) {
            failures.push(`${workflow.name}: ${errorMessage(bulkError)}`)
          }
        }
      } finally {
        setIsBulkUpdating(false)
      }
      if (failures.length > 0) {
        window.alert(`${label}: ${successCount}/${list.length} workflow thành công.\n${failures.slice(0, 5).join('\n')}`)
      }
    },
    [errorMessage, setIsBulkUpdating],
  )

  const bulkFavoriteSelectionAction = useCallback(() => {
    const ids = selectedVisibleWorkflows.map((workflow) => workflow.id)
    if (ids.length === 0) return
    setFavoriteWorkflowIds((current) => Array.from(new Set([...ids, ...current])))
  }, [selectedVisibleWorkflows, setFavoriteWorkflowIds])

  const bulkSaveStarterSelectionAction = useCallback(async () => {
    if (selectedVisibleWorkflows.length === 0) return
    if (!window.confirm(`Lưu ${selectedVisibleWorkflows.length} workflow đã chọn thành starter copy?`)) return
    await runBulkWorkflowAction('Lưu starter', selectedVisibleWorkflows, saveAsStarterAction)
  }, [runBulkWorkflowAction, saveAsStarterAction, selectedVisibleWorkflows])

  const bulkUpdateCustomSelectionAction = useCallback(
    async (label: string, patchFactory: (workflow: WorkflowDefinition) => Partial<WorkflowDefinition>) => {
      if (selectedVisibleCustomWorkflows.length === 0) return
      await runBulkWorkflowAction(label, selectedVisibleCustomWorkflows, async (workflow) => {
        await quickUpdateWorkflowAction(workflow, patchFactory(workflow))
      })
    },
    [quickUpdateWorkflowAction, runBulkWorkflowAction, selectedVisibleCustomWorkflows],
  )

  const bulkAddSelectionToCurrentCollectionAction = useCallback(() => {
    if (activeLibraryCollectionId === 'all' || activeLibraryCollectionId === 'favorites' || selectedVisibleWorkflows.length === 0) return
    const selectedIds = new Set(selectedVisibleWorkflows.map((workflow) => workflow.id))
    setCustomCollections((current) =>
      current.map((collection) =>
        collection.id !== activeLibraryCollectionId
          ? collection
          : {
              ...collection,
              workflowIds: Array.from(new Set([...collection.workflowIds, ...selectedIds])),
            },
      ),
    )
  }, [activeLibraryCollectionId, selectedVisibleWorkflows, setCustomCollections])

  return {
    toggleFavoriteWorkflow,
    createCustomCollectionAction,
    renameCustomCollectionAction,
    deleteCustomCollectionAction,
    toggleWorkflowInCollection,
    exportCollectionsAction,
    importCollectionsFile,
    toggleWorkflowSelection,
    selectAllVisibleWorkflowsAction,
    clearWorkflowSelectionAction,
    runBulkWorkflowAction,
    bulkFavoriteSelectionAction,
    bulkSaveStarterSelectionAction,
    bulkUpdateCustomSelectionAction,
    bulkAddSelectionToCurrentCollectionAction,
  }
}
