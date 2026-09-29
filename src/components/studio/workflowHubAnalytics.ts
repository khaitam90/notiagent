import type { WorkflowDefinition } from '../../lib/workflows'
import type { WorkflowRunStatsSummary } from './useWorkflowHubLibraryData'

export type RuntimeMode = 'image' | 'video' | 'automation'

export type WorkflowHealthBadge = {
  key: string
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'muted'
}

export function workflowHasReferenceInput(workflow: WorkflowDefinition | null) {
  if (!workflow) return false
  if (workflow.id === 'template-ref-image' || workflow.id === 'template-ref-video') return true
  if (workflow.sourceTemplateId === 'template-ref-image' || workflow.sourceTemplateId === 'template-ref-video') return true
  return workflow.nodes.some((node) => {
    if (node.type !== 'input') return false
    return String(node.config.fields || '').toLowerCase().includes('reference_image')
  })
}

export function workflowRuntimeMode(workflow: WorkflowDefinition | null, requestedMode: 'image' | 'video' = 'image'): RuntimeMode {
  if (!workflow) return 'automation'
  const nodeTypes = new Set(workflow.nodes.map((node) => node.type))
  if (workflow.media === 'image') return 'image'
  if (workflow.media === 'video') return 'video'
  if (workflow.media === 'hybrid') {
    if (requestedMode === 'video') return 'video'
    if (nodeTypes.has('video') && !nodeTypes.has('image')) return 'video'
    return 'image'
  }
  if (nodeTypes.has('video')) return 'video'
  if (nodeTypes.has('image')) return 'image'
  return 'automation'
}

function workflowSettledCount(stats: WorkflowRunStatsSummary | null | undefined) {
  return (stats?.success || 0) + (stats?.failed || 0)
}

export function workflowSuccessRate(stats: WorkflowRunStatsSummary | null | undefined) {
  const settled = workflowSettledCount(stats)
  if (settled <= 0) return null
  return Math.round(((stats?.success || 0) / settled) * 100)
}

export function isWorkflowFailHigh(stats: WorkflowRunStatsSummary | null | undefined) {
  const settled = workflowSettledCount(stats)
  return settled >= 3 && (stats?.failed || 0) / settled >= 0.4
}

export function isWorkflowSlow(stats: WorkflowRunStatsSummary | null | undefined) {
  return Boolean(stats && stats.finishedCount >= 2 && stats.avgDurationMs >= 90000)
}

export function isWorkflowLowUse(stats: WorkflowRunStatsSummary | null | undefined) {
  return !stats || stats.total < 3
}

export function isWorkflowStale(workflow: WorkflowDefinition, stats: WorkflowRunStatsSummary | null | undefined) {
  const referenceIso = stats?.lastRunAt || workflow.updatedAt
  const reference = Date.parse(referenceIso)
  if (!Number.isFinite(reference)) return false
  return Date.now() - reference >= 14 * 24 * 60 * 60 * 1000
}

export function workflowHealthBadges(
  workflow: WorkflowDefinition,
  stats: WorkflowRunStatsSummary | null | undefined,
): WorkflowHealthBadge[] {
  const badges: WorkflowHealthBadge[] = []
  const successRate = workflowSuccessRate(stats)
  if (isWorkflowFailHigh(stats)) badges.push({ key: 'fail_high', label: 'Fail cao', tone: 'danger' })
  if (isWorkflowSlow(stats)) badges.push({ key: 'slow', label: 'Chậm', tone: 'warn' })
  if (isWorkflowStale(workflow, stats)) badges.push({ key: 'stale', label: 'Cũ', tone: 'muted' })
  if (isWorkflowLowUse(stats)) badges.push({ key: 'low_use', label: 'Ít dùng', tone: 'muted' })
  if (stats?.running) badges.push({ key: 'running', label: 'Đang chạy', tone: 'warn' })
  if (stats?.queued) badges.push({ key: 'queued', label: 'Đang chờ', tone: 'muted' })
  if (badges.length === 0) badges.push({ key: 'healthy', label: successRate !== null ? `Ổn định ${successRate}%` : 'Sẵn sàng', tone: 'ok' })
  return badges.slice(0, 3)
}
