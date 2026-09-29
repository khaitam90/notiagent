import { useEffect, useMemo, useState } from 'react'
import type { WorkflowDefinition, WorkflowVersion } from '../../lib/workflows'
import { fetchWorkflowVersions } from '../../lib/workflowApi'
import { cloneWorkflowDraft } from './workflowHubTransferData'

type Params = {
  workflowId: string | null
  workflows: WorkflowDefinition[]
  errorMessage: (error: unknown) => string
  setError: (value: string | null) => void
}

export function useWorkflowHubEditorSession({
  workflowId,
  workflows,
  errorMessage,
  setError,
}: Params) {
  const [editorDraft, setEditorDraft] = useState<WorkflowDefinition | null>(null)
  const [workflowVersions, setWorkflowVersions] = useState<WorkflowVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)

  const activeWorkflow = useMemo(
    () => (workflowId ? workflows.find((workflow) => workflow.id === workflowId) ?? null : null),
    [workflowId, workflows],
  )

  useEffect(() => {
    if (!activeWorkflow) {
      setEditorDraft(null)
      return
    }
    setEditorDraft(cloneWorkflowDraft(activeWorkflow))
  }, [activeWorkflow])

  useEffect(() => {
    if (!activeWorkflow || activeWorkflow.category !== 'custom') {
      setWorkflowVersions([])
      setVersionsLoading(false)
      return
    }
    let cancelled = false
    setVersionsLoading(true)
    void fetchWorkflowVersions(activeWorkflow.id)
      .then((versions) => {
        if (!cancelled) setWorkflowVersions(versions)
      })
      .catch((loadError) => {
        if (!cancelled) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (!cancelled) setVersionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeWorkflow, errorMessage, setError])

  return {
    activeWorkflow,
    editorDraft,
    setEditorDraft,
    workflowVersions,
    setWorkflowVersions,
    versionsLoading,
  }
}
