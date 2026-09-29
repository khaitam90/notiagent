import { useMemo } from 'react'
import type { WorkflowDefinition, WorkflowNode } from '../../lib/workflows'
import {
  NODE_CONFIG_TEMPLATES,
  WORKFLOW_WIZARD_PRESETS,
  type NodeConfigTemplate,
  type WorkflowWizardPreset,
} from './workflowHubPresets'
import {
  parseComponentInputSchema,
  parseComponentOutputSchema,
} from './workflowHubData'

type LocalWorkflowPresetLike = {
  id: string
  name: string
  description: string
  savedAt: string
  workflow: WorkflowDefinition
}

type UseWorkflowHubEditorDataParams = {
  localWorkflowPresets: LocalWorkflowPresetLike[]
  selectedLocalPresetId: string | null
  selectedWizardPresetId: string
  draftWorkflow: WorkflowDefinition | null
  selectedNode: WorkflowNode | null
  reusableWorkflowOptions: WorkflowDefinition[]
  reusableWorkflowById: Map<string, WorkflowDefinition>
}

export function useWorkflowHubEditorData({
  localWorkflowPresets,
  selectedLocalPresetId,
  selectedWizardPresetId,
  draftWorkflow,
  selectedNode,
  reusableWorkflowOptions,
  reusableWorkflowById,
}: UseWorkflowHubEditorDataParams) {
  const selectedLocalPreset = useMemo(
    () => localWorkflowPresets.find((preset) => preset.id === selectedLocalPresetId) ?? null,
    [localWorkflowPresets, selectedLocalPresetId],
  )

  const selectedWizardPreset = useMemo<WorkflowWizardPreset | null>(
    () => WORKFLOW_WIZARD_PRESETS.find((preset) => preset.id === selectedWizardPresetId) ?? WORKFLOW_WIZARD_PRESETS[0] ?? null,
    [selectedWizardPresetId],
  )

  const componentInputSchemaFields = useMemo(
    () => parseComponentInputSchema(draftWorkflow),
    [draftWorkflow?.componentInputSchemaJson, draftWorkflow?.id],
  )

  const componentOutputSchemaMap = useMemo(
    () => parseComponentOutputSchema(draftWorkflow),
    [draftWorkflow?.componentOutputSchemaJson, draftWorkflow?.id],
  )

  const componentOutputSchemaEntries = useMemo(
    () => Object.entries(componentOutputSchemaMap),
    [componentOutputSchemaMap],
  )

  const selectedReusableWorkflow = useMemo(
    () =>
      selectedNode && (selectedNode.type === 'subflow' || selectedNode.type === 'for_each')
        ? reusableWorkflowOptions.find((workflow) => workflow.id === String(selectedNode.config.workflow_id || '').trim()) ?? null
        : null,
    [reusableWorkflowOptions, selectedNode],
  )

  const selectedNodeConfigTemplates = useMemo<NodeConfigTemplate[]>(
    () => (selectedNode ? NODE_CONFIG_TEMPLATES[selectedNode.type] || [] : []),
    [selectedNode],
  )

  const componentCanvasInfoByNodeId = useMemo(() => {
    const result = new Map<
      string,
      {
        workflow: WorkflowDefinition
        inputs: string[]
        outputs: Array<[string, string]>
      }
    >()
    for (const node of draftWorkflow?.nodes || []) {
      if (node.type !== 'subflow' && node.type !== 'for_each') continue
      const workflowId = String(node.config.workflow_id || '').trim()
      if (!workflowId) continue
      const workflow = reusableWorkflowById.get(workflowId)
      if (!workflow?.component) continue
      result.set(node.id, {
        workflow,
        inputs: parseComponentInputSchema(workflow),
        outputs: Object.entries(parseComponentOutputSchema(workflow)),
      })
    }
    return result
  }, [draftWorkflow?.nodes, reusableWorkflowById])

  return {
    selectedLocalPreset,
    selectedWizardPreset,
    componentInputSchemaFields,
    componentOutputSchemaMap,
    componentOutputSchemaEntries,
    selectedReusableWorkflow,
    selectedNodeConfigTemplates,
    componentCanvasInfoByNodeId,
  }
}
