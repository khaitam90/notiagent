import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import {
  buildWorkflowEdgeId,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowNode,
} from '../../lib/workflows'
import type { NodeConfigTemplate } from './workflowHubPresets'

function normalizeWorkflowForCompare(workflow: WorkflowDefinition | null) {
  if (!workflow) return null
  const { updatedAt, ...rest } = workflow
  return rest
}

type UseWorkflowHubEditorMutationsParams = {
  activeWorkflow: WorkflowDefinition | null
  draftWorkflow: WorkflowDefinition | null
  isEditable: boolean
  selectedNode: WorkflowNode | null
  selectedEdgeId: string | null
  setEditorDraft: Dispatch<SetStateAction<WorkflowDefinition | null>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
}

export function useWorkflowHubEditorMutations({
  activeWorkflow,
  draftWorkflow,
  isEditable,
  selectedNode,
  selectedEdgeId,
  setEditorDraft,
  setSelectedEdgeId,
}: UseWorkflowHubEditorMutationsParams) {
  const isDirty = useMemo(() => {
    if (!activeWorkflow || !draftWorkflow) return false
    return JSON.stringify(normalizeWorkflowForCompare(activeWorkflow)) !== JSON.stringify(normalizeWorkflowForCompare(draftWorkflow))
  }, [activeWorkflow, draftWorkflow])

  const confirmDiscardChanges = useCallback(() => {
    if (!isDirty) return true
    return window.confirm('Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?')
  }, [isDirty])

  const updateDraftWorkflow = useCallback((patch: Partial<WorkflowDefinition>) => {
    setEditorDraft((current) => {
      if (!current || current.category !== 'custom') return current
      return {
        ...current,
        ...patch,
      }
    })
  }, [setEditorDraft])

  const updateDraftNode = useCallback((nodeId: string, patch: Partial<WorkflowNode>) => {
    setEditorDraft((current) => {
      if (!current || current.category !== 'custom') return current
      return {
        ...current,
        nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
      }
    })
  }, [setEditorDraft])

  const removeDraftNodeConfigKey = useCallback((nodeId: string, keyToRemove: string) => {
    setEditorDraft((current) => {
      if (!current || current.category !== 'custom') return current
      return {
        ...current,
        nodes: current.nodes.map((node) => {
          if (node.id !== nodeId) return node
          const nextConfig = { ...node.config }
          delete nextConfig[keyToRemove]
          return { ...node, config: nextConfig }
        }),
      }
    })
  }, [setEditorDraft])

  const applySelectedNodeConfigTemplate = useCallback((template: NodeConfigTemplate) => {
    if (!selectedNode || !isEditable) return
    updateDraftNode(selectedNode.id, {
      config: {
        ...selectedNode.config,
        ...template.config,
      },
    })
  }, [isEditable, selectedNode, updateDraftNode])

  const updateDraftEdge = useCallback((edgeId: string, patch: Partial<WorkflowEdge>) => {
    const currentEdge = draftWorkflow?.edges.find((edge) => edge.id === edgeId) ?? null
    const nextBranch =
      patch.branch === undefined
        ? currentEdge?.branch
        : patch.branch === 'true' || patch.branch === 'false' || patch.branch === 'always'
          ? patch.branch
          : undefined
    const nextSelectedEdgeId = currentEdge
      ? buildWorkflowEdgeId(patch.source || currentEdge.source, patch.target || currentEdge.target, nextBranch)
      : edgeId
    setEditorDraft((current) => {
      if (!current || current.category !== 'custom') return current
      return {
        ...current,
        edges: current.edges.map((edge) => {
          if (edge.id !== edgeId) return edge
          const nextEdge = {
            ...edge,
            ...patch,
            branch: nextBranch,
          }
          nextEdge.id = buildWorkflowEdgeId(nextEdge.source, nextEdge.target, nextEdge.branch)
          return nextEdge
        }),
      }
    })
    if (selectedEdgeId === edgeId) {
      setSelectedEdgeId((current) => (current === edgeId ? nextSelectedEdgeId : current))
    }
  }, [draftWorkflow, selectedEdgeId, setEditorDraft, setSelectedEdgeId])

  return {
    isDirty,
    confirmDiscardChanges,
    updateDraftWorkflow,
    updateDraftNode,
    removeDraftNodeConfigKey,
    applySelectedNodeConfigTemplate,
    updateDraftEdge,
  }
}
