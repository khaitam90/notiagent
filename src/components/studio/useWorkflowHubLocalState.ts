import { useEffect, useState } from 'react'
import type { WorkflowDefinition } from '../../lib/workflows'
import type { WorkflowCollection } from './useWorkflowHubLibraryData'
import { generateId } from '../../lib/uuid'

export type LocalWorkflowPreset = {
  id: string
  name: string
  description: string
  savedAt: string
  workflow: WorkflowDefinition
}

const WORKFLOW_FAVORITES_STORAGE_KEY = 'notiagent.workflowFavorites'
const WORKFLOW_COLLECTIONS_STORAGE_KEY = 'notiagent.workflowCollections'
const WORKFLOW_LOCAL_PRESETS_STORAGE_KEY = 'notiagent.workflowLocalPresets'

export function useWorkflowHubLocalState() {
  const [favoriteWorkflowIds, setFavoriteWorkflowIds] = useState<string[]>([])
  const [customCollections, setCustomCollections] = useState<WorkflowCollection[]>([])
  const [localWorkflowPresets, setLocalWorkflowPresets] = useState<LocalWorkflowPreset[]>([])
  const [selectedLocalPresetId, setSelectedLocalPresetId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const storedFavorites = window.localStorage.getItem(WORKFLOW_FAVORITES_STORAGE_KEY)
      if (storedFavorites) {
        const parsed = JSON.parse(storedFavorites) as unknown
        if (Array.isArray(parsed)) {
          setFavoriteWorkflowIds(parsed.map((item) => String(item || '').trim()).filter(Boolean))
        }
      }

      const storedCollections = window.localStorage.getItem(WORKFLOW_COLLECTIONS_STORAGE_KEY)
      if (storedCollections) {
        const parsed = JSON.parse(storedCollections) as unknown
        if (Array.isArray(parsed)) {
          setCustomCollections(
            parsed
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
              }),
          )
        }
      }

      const storedPresets = window.localStorage.getItem(WORKFLOW_LOCAL_PRESETS_STORAGE_KEY)
      if (storedPresets) {
        const parsed = JSON.parse(storedPresets) as unknown
        if (Array.isArray(parsed)) {
          setLocalWorkflowPresets(
            parsed
              .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
              .map((item) => {
                const value = item as Record<string, unknown>
                return {
                  id: String(value.id || generateId()),
                  name: String(value.name || 'Preset cục bộ'),
                  description: String(value.description || ''),
                  savedAt: String(value.savedAt || new Date().toISOString()),
                  workflow:
                    value.workflow && typeof value.workflow === 'object' && !Array.isArray(value.workflow)
                      ? (value.workflow as WorkflowDefinition)
                      : null,
                }
              })
              .filter((item) => item.workflow) as LocalWorkflowPreset[],
          )
        }
      }
    } catch {
      // ignore local storage parse errors
    }
  }, [])

  useEffect(() => {
    window.localStorage.setItem(WORKFLOW_FAVORITES_STORAGE_KEY, JSON.stringify(favoriteWorkflowIds))
  }, [favoriteWorkflowIds])

  useEffect(() => {
    window.localStorage.setItem(WORKFLOW_COLLECTIONS_STORAGE_KEY, JSON.stringify(customCollections))
  }, [customCollections])

  useEffect(() => {
    window.localStorage.setItem(WORKFLOW_LOCAL_PRESETS_STORAGE_KEY, JSON.stringify(localWorkflowPresets))
  }, [localWorkflowPresets])

  useEffect(() => {
    if (localWorkflowPresets.length === 0) {
      setSelectedLocalPresetId(null)
      return
    }
    setSelectedLocalPresetId((current) =>
      current && localWorkflowPresets.some((preset) => preset.id === current) ? current : localWorkflowPresets[0].id,
    )
  }, [localWorkflowPresets])

  return {
    favoriteWorkflowIds,
    setFavoriteWorkflowIds,
    customCollections,
    setCustomCollections,
    localWorkflowPresets,
    setLocalWorkflowPresets,
    selectedLocalPresetId,
    setSelectedLocalPresetId,
  }
}
