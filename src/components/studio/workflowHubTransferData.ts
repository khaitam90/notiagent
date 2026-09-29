import { buildWorkflowEdgeId, type WorkflowDefinition, type WorkflowEdge, type WorkflowMedia, type WorkflowNode, type WorkflowNodeType } from '../../lib/workflows'
import { parseWorkflowTags } from './workflowHubData'
import { stringifyWorkflowTags } from './workflowHubUtils'

export type WorkflowPackageDocument = {
  kind: 'notiagent-workflow-package'
  version: 1
  exportedAt: string
  manifest: {
    name: string
    description: string
    media: WorkflowMedia
    tags: string[]
    component: boolean
    componentName: string
    nodeCount: number
    edgeCount: number
  }
  workflow: WorkflowDefinition
}

export function cloneWorkflowDraft(workflow: WorkflowDefinition): WorkflowDefinition {
  return JSON.parse(JSON.stringify(workflow)) as WorkflowDefinition
}

export function buildWorkflowPackage(workflow: WorkflowDefinition): WorkflowPackageDocument {
  return {
    kind: 'notiagent-workflow-package',
    version: 1,
    exportedAt: new Date().toISOString(),
    manifest: {
      name: workflow.name,
      description: workflow.description,
      media: workflow.media,
      tags: parseWorkflowTags(workflow),
      component: Boolean(workflow.component),
      componentName: String(workflow.componentName || ''),
      nodeCount: workflow.nodes.length,
      edgeCount: workflow.edges.length,
    },
    workflow: cloneWorkflowDraft(workflow),
  }
}

export function normalizeImportedWorkflow(raw: unknown, current: WorkflowDefinition): WorkflowDefinition {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('File import phải là JSON object.')
  }
  const payload = raw as Partial<WorkflowDefinition> & {
    nodes?: unknown
    edges?: unknown
  }
  if (!Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
    throw new Error('File import phải có đủ nodes và edges.')
  }

  const nodes = payload.nodes.map((nodeItem, index) => {
    if (!nodeItem || typeof nodeItem !== 'object' || Array.isArray(nodeItem)) {
      throw new Error(`Node tại vị trí ${index + 1} không hợp lệ.`)
    }
    const node = nodeItem as Partial<WorkflowNode>
    const nodeX = Number(node.x)
    const nodeY = Number(node.y)
    return {
      id: String(node.id || `node_${index + 1}`),
      type: String(node.type || 'output') as WorkflowNodeType,
      label: String(node.label || `Node ${index + 1}`),
      description: String(node.description || ''),
      x: Number.isFinite(nodeX) ? nodeX : 80 + index * 220,
      y: Number.isFinite(nodeY) ? nodeY : 120,
      config:
        node.config && typeof node.config === 'object' && !Array.isArray(node.config)
          ? Object.fromEntries(
              Object.entries(node.config as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')]),
            )
          : {},
    } satisfies WorkflowNode
  })

  const edges = payload.edges.map((edgeItem, index) => {
    if (!edgeItem || typeof edgeItem !== 'object' || Array.isArray(edgeItem)) {
      throw new Error(`Edge tại vị trí ${index + 1} không hợp lệ.`)
    }
    const edge = edgeItem as Partial<WorkflowEdge>
    const branch =
      edge.branch === 'true' || edge.branch === 'false' || edge.branch === 'always' ? edge.branch : undefined
    const source = String(edge.source || '').trim()
    const target = String(edge.target || '').trim()
    return {
      id: buildWorkflowEdgeId(source, target, branch),
      source,
      target,
      branch,
    } satisfies WorkflowEdge
  })

  const nextMedia = String(payload.media || '').trim()

  return {
    ...current,
    name: String(payload.name || current.name).trim() || current.name,
    description: String(payload.description || current.description),
    media:
      nextMedia === 'image' || nextMedia === 'video' || nextMedia === 'hybrid' || nextMedia === 'automation'
        ? (nextMedia as WorkflowMedia)
        : current.media,
    component: typeof payload.component === 'boolean' ? payload.component : current.component,
    componentName: String(payload.componentName || current.componentName || ''),
    componentInputSchemaJson: String(payload.componentInputSchemaJson || current.componentInputSchemaJson || ''),
    componentOutputSchemaJson: String(payload.componentOutputSchemaJson || current.componentOutputSchemaJson || ''),
    tags: Array.isArray(payload.tags) ? stringifyWorkflowTags(payload.tags.map((tag) => String(tag || ''))) : parseWorkflowTags(current),
    metadataJson: String(payload.metadataJson || current.metadataJson || ''),
    nodes,
    edges,
  }
}

export function normalizeImportedWorkflowDocument(raw: unknown, current: WorkflowDefinition): WorkflowDefinition {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const payload = raw as Record<string, unknown>
    if (payload.kind === 'notiagent-workflow-package' && payload.workflow) {
      return normalizeImportedWorkflow(payload.workflow, current)
    }
  }
  return normalizeImportedWorkflow(raw, current)
}

export function parseWorkflowPackageDocument(raw: unknown): WorkflowPackageDocument | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const payload = raw as Record<string, unknown>
  if (payload.kind !== 'notiagent-workflow-package' || !payload.workflow) return null
  return payload as WorkflowPackageDocument
}

export function buildDraftFromPreset(current: WorkflowDefinition, presetWorkflow: WorkflowDefinition): WorkflowDefinition {
  return {
    ...current,
    name: presetWorkflow.name,
    description: presetWorkflow.description,
    media: presetWorkflow.media,
    published: false,
    component: presetWorkflow.component,
    componentName: String(presetWorkflow.componentName || ''),
    componentInputSchemaJson: String(presetWorkflow.componentInputSchemaJson || ''),
    componentOutputSchemaJson: String(presetWorkflow.componentOutputSchemaJson || ''),
    tags: parseWorkflowTags(presetWorkflow),
    metadataJson: String(presetWorkflow.metadataJson || ''),
    nodes: cloneWorkflowDraft(presetWorkflow).nodes,
    edges: cloneWorkflowDraft(presetWorkflow).edges,
  }
}
