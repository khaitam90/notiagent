import type { WorkflowDefinition } from '../../lib/workflows'

const TOP_LEVEL_COMPONENT_INPUT_FIELDS = new Set([
  'prompt',
  'image_url',
  'image_urls',
  'reference_image',
  'video_url',
  'audio_url',
  'aspect_ratio',
  'ratio',
  'duration',
  'tool_id',
  'output_mode',
])

export function parseWorkflowTags(workflow: WorkflowDefinition | null | undefined) {
  if (!workflow || !Array.isArray(workflow.tags)) return [] as string[]
  return workflow.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
}

export function parseWorkflowMetadata(workflow: WorkflowDefinition | null | undefined) {
  if (!workflow) return {} as Record<string, unknown>
  const raw = String(workflow.metadataJson || '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function parseWorkflowInputFields(workflow: WorkflowDefinition | null) {
  if (!workflow) return [] as string[]
  const results: string[] = []
  const seen = new Set<string>()
  for (const node of workflow.nodes) {
    if (node.type !== 'input') continue
    for (const field of String(node.config.fields || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)) {
      if (seen.has(field)) continue
      seen.add(field)
      results.push(field)
    }
  }
  return results
}

export function parseComponentInputSchema(workflow: WorkflowDefinition | null | undefined) {
  if (!workflow?.componentInputSchemaJson?.trim()) return [] as string[]
  try {
    const parsed = JSON.parse(workflow.componentInputSchemaJson)
    if (!Array.isArray(parsed)) return [] as string[]
    return parsed
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  } catch {
    return [] as string[]
  }
}

export function parseComponentOutputSchema(workflow: WorkflowDefinition | null | undefined): Record<string, string> {
  if (!workflow?.componentOutputSchemaJson?.trim()) return {} as Record<string, string>
  try {
    const parsed = JSON.parse(workflow.componentOutputSchemaJson)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {} as Record<string, string>
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => [String(key || '').trim(), String(value || '').trim()])
        .filter(([key, value]) => key && value),
    )
  } catch {
    return {} as Record<string, string>
  }
}

export function stringifyComponentInputSchema(fields: string[]) {
  const seen = new Set<string>()
  const next = fields
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
  return JSON.stringify(next, null, 2)
}

export function stringifyComponentOutputSchema(entries: Record<string, string>) {
  const normalized = Object.fromEntries(
    Object.entries(entries)
      .map(([key, value]) => [String(key || '').trim(), String(value || '').trim()])
      .filter(([key, value]) => key && value),
  )
  return JSON.stringify(normalized, null, 2)
}

export function inferComponentInputSchema(workflow: WorkflowDefinition | null | undefined) {
  if (!workflow) return [] as string[]
  return parseWorkflowInputFields(workflow)
}

export function inferComponentOutputSchema(workflow: WorkflowDefinition | null | undefined) {
  if (!workflow) return {} as Record<string, string>
  const result: Record<string, string> = {}
  for (const node of workflow.nodes) {
    if (node.type !== 'output') continue
    const outputKey = String(node.config.output || '').trim() || node.id
    const valuePath = String(node.config.value_path || '').trim()
    if (valuePath) {
      result[outputKey] = valuePath.startsWith('state.') || valuePath.startsWith('nodes.')
        ? valuePath
        : `state.${valuePath}`
      continue
    }
    if (['asset', 'image_files', 'video_files', 'result'].includes(outputKey)) {
      result[outputKey] = 'final_output.value'
    } else {
      result[outputKey] = `state.${outputKey}`
    }
  }
  return result
}

export function buildSuggestedSubflowConfig(workflow: WorkflowDefinition): Record<string, string> {
  const inputFields = parseComponentInputSchema(workflow)
  const outputMap = parseComponentOutputSchema(workflow)
  const topLevelEntries: Record<string, unknown> = {}
  const variableEntries: Record<string, string> = {}

  for (const field of inputFields) {
    if (field === 'image_urls') {
      topLevelEntries.image_urls = ['{{image_url}}']
      continue
    }
    if (TOP_LEVEL_COMPONENT_INPUT_FIELDS.has(field)) {
      topLevelEntries[field] = `{{${field}}}`
    } else {
      variableEntries[field] = `{{${field}}}`
    }
  }

  if (!('prompt' in topLevelEntries)) topLevelEntries.prompt = '{{prompt}}'
  if (Object.keys(variableEntries).length > 0) {
    topLevelEntries.variables = variableEntries
  }

  return {
    workflow_id: workflow.id,
    output_key: 'component_result',
    inputs_json: JSON.stringify(topLevelEntries, null, 2),
    expose_json: JSON.stringify(outputMap, null, 2),
  }
}

export function workflowExportFilename(workflow: WorkflowDefinition) {
  const slug = workflow.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'workflow'}.json`
}

export function workflowPackageFilename(workflow: WorkflowDefinition) {
  return workflowExportFilename(workflow).replace(/\.json$/i, '.package.json')
}
