import { useCallback, useEffect, useState } from 'react'
import type { WorkflowDefinition, WorkflowFolder, WorkflowRun } from '../../lib/workflows'
import { fetchWorkflowBootstrap } from '../../lib/workflowApi'

type Params = {
  errorMessage: (error: unknown) => string
}

export function useWorkflowHubBootstrapState({ errorMessage }: Params) {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [folders, setFolders] = useState<WorkflowFolder[]>([])
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([])
  const [runs, setRuns] = useState<WorkflowRun[]>([])

  const refreshData = useCallback(async (silent = false) => {
    if (silent) setSyncing(true)
    else setLoading(true)
    try {
      const data = await fetchWorkflowBootstrap()
      const nextWorkflows = [...data.workflows].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      setFolders(data.folders)
      setWorkflows(nextWorkflows)
      setRuns(data.runs)
      setError(null)
    } catch (fetchError) {
      setError(errorMessage(fetchError))
    } finally {
      if (silent) setSyncing(false)
      else setLoading(false)
    }
  }, [errorMessage])

  useEffect(() => {
    void refreshData()
  }, [refreshData])

  return {
    loading,
    syncing,
    error,
    setError,
    folders,
    setFolders,
    workflows,
    setWorkflows,
    runs,
    setRuns,
    refreshData,
  }
}
