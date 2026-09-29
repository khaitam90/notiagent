import { useMemo } from 'react'
import {
  WORKFLOW_BLOCK_LIBRARY,
  type WorkflowDefinition,
  type WorkflowMedia,
} from '../../lib/workflows'
import { parseWorkflowMetadata, parseWorkflowTags } from './workflowHubData'

export type WorkflowLibraryFilter =
  | 'all'
  | 'templates'
  | 'published'
  | 'components'
  | 'image'
  | 'video'
  | 'automation'
  | 'run_heavy'
  | 'fail_high'
  | 'slow'
  | 'stale'
  | 'low_use'

export type WorkflowSortMode =
  | 'updated_desc'
  | 'name_asc'
  | 'nodes_desc'
  | 'runs_desc'
  | 'success_desc'
  | 'avg_duration_asc'

export type WorkflowCollection = {
  id: string
  name: string
  workflowIds: string[]
}

export type WorkflowRunStatsSummary = {
  total: number
  success: number
  failed: number
  queued: number
  running: number
  lastRunAt: string | null
  finishedCount: number
  avgDurationMs: number
}

type WorkflowLibraryStatsFns = {
  isWorkflowFailHigh: (stats: WorkflowRunStatsSummary | null | undefined) => boolean
  isWorkflowSlow: (stats: WorkflowRunStatsSummary | null | undefined) => boolean
  isWorkflowLowUse: (stats: WorkflowRunStatsSummary | null | undefined) => boolean
  isWorkflowStale: (workflow: WorkflowDefinition, stats: WorkflowRunStatsSummary | null | undefined) => boolean
}

type UseWorkflowHubLibraryDataParams = {
  workflows: WorkflowDefinition[]
  folderId: string
  query: string
  libraryFilter: WorkflowLibraryFilter
  libraryTagFilter: string
  activeLibraryCollectionId: string
  favoriteWorkflowIds: string[]
  customCollections: WorkflowCollection[]
  workflowRunStatsById: Map<string, WorkflowRunStatsSummary>
  workflowSort: WorkflowSortMode
  libraryPreviewWorkflowId: string | null
  selectedWorkflowIds: string[]
  draftWorkflowId: string | null | undefined
  starterCollectionId: string
  mediaLabel: (media: WorkflowMedia) => string
  prettyJson: (value: unknown) => string
  statsFns: WorkflowLibraryStatsFns
}

export function useWorkflowHubLibraryData({
  workflows,
  folderId,
  query,
  libraryFilter,
  libraryTagFilter,
  activeLibraryCollectionId,
  favoriteWorkflowIds,
  customCollections,
  workflowRunStatsById,
  workflowSort,
  libraryPreviewWorkflowId,
  selectedWorkflowIds,
  draftWorkflowId,
  starterCollectionId,
  mediaLabel,
  prettyJson,
  statsFns,
}: UseWorkflowHubLibraryDataParams) {
  const visibleWorkflows = useMemo(() => {
    return workflows.filter((workflow) => {
      const matchesFolder = folderId === 'all' ? true : workflow.folderId === folderId
      const q = query.trim().toLowerCase()
      const tags = parseWorkflowTags(workflow)
      const metadata = parseWorkflowMetadata(workflow)
      const metadataText = Object.entries(metadata)
        .flatMap(([key, value]) => [key, typeof value === 'string' ? value : prettyJson(value)])
        .join(' ')
        .toLowerCase()
      const matchesSearch =
        !q ||
        workflow.name.toLowerCase().includes(q) ||
        workflow.description.toLowerCase().includes(q) ||
        mediaLabel(workflow.media).toLowerCase().includes(q) ||
        tags.some((tag) => tag.toLowerCase().includes(q)) ||
        metadataText.includes(q)
      const matchesLibraryFilter =
        libraryFilter === 'all'
          ? true
          : libraryFilter === 'templates'
            ? workflow.category === 'template'
            : libraryFilter === 'published'
              ? workflow.category === 'custom' && workflow.published
              : libraryFilter === 'components'
                ? workflow.category === 'custom' && Boolean(workflow.component)
                : libraryFilter === 'image'
                  ? workflow.media === 'image'
                  : libraryFilter === 'video'
                    ? workflow.media === 'video'
                    : libraryFilter === 'run_heavy'
                      ? (workflowRunStatsById.get(workflow.id)?.total || 0) >= 3
                      : libraryFilter === 'fail_high'
                        ? statsFns.isWorkflowFailHigh(workflowRunStatsById.get(workflow.id))
                        : libraryFilter === 'slow'
                          ? statsFns.isWorkflowSlow(workflowRunStatsById.get(workflow.id))
                          : libraryFilter === 'stale'
                            ? statsFns.isWorkflowStale(workflow, workflowRunStatsById.get(workflow.id))
                            : libraryFilter === 'low_use'
                              ? statsFns.isWorkflowLowUse(workflowRunStatsById.get(workflow.id))
                              : workflow.media === 'automation'
      const matchesCollection =
        activeLibraryCollectionId === 'all'
          ? true
          : activeLibraryCollectionId === 'favorites'
            ? favoriteWorkflowIds.includes(workflow.id)
            : customCollections.find((collection) => collection.id === activeLibraryCollectionId)?.workflowIds.includes(workflow.id) ??
              false
      const matchesTag = !libraryTagFilter || tags.includes(libraryTagFilter)
      return matchesFolder && matchesSearch && matchesLibraryFilter && matchesCollection && matchesTag
    })
  }, [
    activeLibraryCollectionId,
    customCollections,
    favoriteWorkflowIds,
    folderId,
    libraryFilter,
    libraryTagFilter,
    mediaLabel,
    prettyJson,
    query,
    statsFns,
    workflowRunStatsById,
    workflows,
  ])

  const sortedVisibleWorkflows = useMemo(() => {
    const next = [...visibleWorkflows]
    if (workflowSort === 'name_asc') {
      next.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      return next
    }
    if (workflowSort === 'nodes_desc') {
      next.sort((a, b) => b.nodes.length - a.nodes.length || Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      return next
    }
    if (workflowSort === 'runs_desc') {
      next.sort(
        (a, b) =>
          (workflowRunStatsById.get(b.id)?.total || 0) - (workflowRunStatsById.get(a.id)?.total || 0) ||
          Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      )
      return next
    }
    if (workflowSort === 'success_desc') {
      next.sort((a, b) => {
        const aStats = workflowRunStatsById.get(a.id)
        const bStats = workflowRunStatsById.get(b.id)
        const aSettled = (aStats?.success || 0) + (aStats?.failed || 0)
        const bSettled = (bStats?.success || 0) + (bStats?.failed || 0)
        const aRate = aSettled > 0 ? (aStats?.success || 0) / aSettled : -1
        const bRate = bSettled > 0 ? (bStats?.success || 0) / bSettled : -1
        return bRate - aRate || (bStats?.total || 0) - (aStats?.total || 0) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      })
      return next
    }
    if (workflowSort === 'avg_duration_asc') {
      next.sort((a, b) => {
        const aValue = workflowRunStatsById.get(a.id)?.avgDurationMs || Number.POSITIVE_INFINITY
        const bValue = workflowRunStatsById.get(b.id)?.avgDurationMs || Number.POSITIVE_INFINITY
        return aValue - bValue || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      })
      return next
    }
    next.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    return next
  }, [visibleWorkflows, workflowRunStatsById, workflowSort])

  const workflowTagOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const workflow of workflows) {
      for (const tag of parseWorkflowTags(workflow)) {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'vi'))
      .slice(0, 12)
      .map(([tag]) => tag)
  }, [workflows])

  // Khong tu mo workflow dau tien: truoc day `?? sortedVisibleWorkflows[0]` khien panel "Xem truoc"
  // luon mo che het danh sach va nut X (dat id = null) khong dong duoc vi tu mo lai.
  const selectedLibraryWorkflow = useMemo(
    () => sortedVisibleWorkflows.find((workflow) => workflow.id === libraryPreviewWorkflowId) ?? null,
    [libraryPreviewWorkflowId, sortedVisibleWorkflows],
  )

  const selectedVisibleWorkflows = useMemo(
    () => sortedVisibleWorkflows.filter((workflow) => selectedWorkflowIds.includes(workflow.id)),
    [selectedWorkflowIds, sortedVisibleWorkflows],
  )

  const selectedVisibleCustomWorkflows = useMemo(
    () => selectedVisibleWorkflows.filter((workflow) => workflow.category === 'custom'),
    [selectedVisibleWorkflows],
  )

  const libraryDashboardStats = useMemo(() => {
    let totalRuns = 0
    let totalSuccess = 0
    let totalFailed = 0
    let totalAvgDuration = 0
    let avgDurationCount = 0
    for (const workflow of sortedVisibleWorkflows) {
      const stats = workflowRunStatsById.get(workflow.id)
      if (!stats) continue
      totalRuns += stats.total
      totalSuccess += stats.success
      totalFailed += stats.failed
      if (stats.finishedCount > 0) {
        totalAvgDuration += stats.avgDurationMs
        avgDurationCount += 1
      }
    }
    const settled = totalSuccess + totalFailed
    return {
      workflows: sortedVisibleWorkflows.length,
      favorites: sortedVisibleWorkflows.filter((workflow) => favoriteWorkflowIds.includes(workflow.id)).length,
      collections: customCollections.length,
      totalRuns,
      successRate: settled > 0 ? Math.round((totalSuccess / settled) * 100) : 0,
      failHigh: sortedVisibleWorkflows.filter((workflow) => statsFns.isWorkflowFailHigh(workflowRunStatsById.get(workflow.id))).length,
      avgDurationMs: avgDurationCount > 0 ? totalAvgDuration / avgDurationCount : 0,
      runHeavy: sortedVisibleWorkflows.filter((workflow) => (workflowRunStatsById.get(workflow.id)?.total || 0) >= 3).length,
      slow: sortedVisibleWorkflows.filter((workflow) => statsFns.isWorkflowSlow(workflowRunStatsById.get(workflow.id))).length,
      stale: sortedVisibleWorkflows.filter((workflow) => statsFns.isWorkflowStale(workflow, workflowRunStatsById.get(workflow.id))).length,
      lowUse: sortedVisibleWorkflows.filter((workflow) => statsFns.isWorkflowLowUse(workflowRunStatsById.get(workflow.id))).length,
    }
  }, [customCollections.length, favoriteWorkflowIds, sortedVisibleWorkflows, statsFns, workflowRunStatsById])

  const reusableWorkflowOptions = useMemo(
    () =>
      workflows
        .filter((workflow) => workflow.id !== draftWorkflowId)
        .filter((workflow) => workflow.category === 'template' || workflow.component)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [draftWorkflowId, workflows],
  )

  const componentWorkflowOptions = useMemo(
    () =>
      reusableWorkflowOptions.filter((workflow) => workflow.component).sort((a, b) =>
        (a.componentName || a.name).localeCompare(b.componentName || b.name, 'vi'),
      ),
    [reusableWorkflowOptions],
  )

  const starterWorkflowOptions = useMemo(
    () =>
      reusableWorkflowOptions
        .filter((workflow) => workflow.category === 'template' || parseWorkflowTags(workflow).includes('starter'))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    [reusableWorkflowOptions],
  )

  const filteredStarterWorkflowOptions = useMemo(() => {
    if (starterCollectionId === 'all') return starterWorkflowOptions
    return starterWorkflowOptions.filter((workflow) => {
      const tags = parseWorkflowTags(workflow)
      const useCase = String(parseWorkflowMetadata(workflow).use_case || '')
      if (starterCollectionId === 'character') return tags.includes('character') || useCase.includes('character')
      if (starterCollectionId === 'social') return tags.includes('social') || tags.includes('marketing') || useCase.includes('social')
      return workflow.media === 'automation' || tags.includes('automation') || useCase.includes('automation')
    })
  }, [starterCollectionId, starterWorkflowOptions])

  const groupedWorkflowBlocks = useMemo(() => {
    const order = ['Media', 'Automation', 'Logic', 'Integration', 'Reusable'] as const
    return order
      .map((group) => ({
        group,
        blocks: WORKFLOW_BLOCK_LIBRARY.filter((block) => (block.group || 'Automation') === group),
      }))
      .filter((entry) => entry.blocks.length > 0)
  }, [])

  const reusableWorkflowById = useMemo(
    () => new Map(reusableWorkflowOptions.map((workflow) => [workflow.id, workflow])),
    [reusableWorkflowOptions],
  )

  return {
    visibleWorkflows,
    sortedVisibleWorkflows,
    workflowTagOptions,
    selectedLibraryWorkflow,
    selectedVisibleWorkflows,
    selectedVisibleCustomWorkflows,
    libraryDashboardStats,
    reusableWorkflowOptions,
    componentWorkflowOptions,
    starterWorkflowOptions,
    filteredStarterWorkflowOptions,
    groupedWorkflowBlocks,
    reusableWorkflowById,
  }
}
