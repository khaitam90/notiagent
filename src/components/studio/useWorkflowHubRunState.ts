import { useEffect, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { WorkflowDefinition, WorkflowRun } from '../../lib/workflows'
import { parseWorkflowInputFields } from './workflowHubData'
import { workflowHasReferenceInput, workflowRuntimeMode, type RuntimeMode } from './workflowHubAnalytics'
import type { WorkflowRunStatsSummary } from './useWorkflowHubLibraryData'

type WorkflowAnalyticsWindow = 'all' | '7d' | '30d'

type Params = {
  draftWorkflow: WorkflowDefinition | null
  runMode: 'image' | 'video'
  workflowId: string | null
  runs: WorkflowRun[]
  analyticsWindow: WorkflowAnalyticsWindow
  refreshData: (silent?: boolean) => Promise<void>
  selectedRunId: string | null
  setSelectedRunId: Dispatch<SetStateAction<string | null>>
  selectedTraceNodeId: string | null
  setSelectedTraceNodeId: Dispatch<SetStateAction<string | null>>
}

export function useWorkflowHubRunState({
  draftWorkflow,
  runMode,
  workflowId,
  runs,
  analyticsWindow,
  refreshData,
  selectedRunId,
  setSelectedRunId,
  selectedTraceNodeId,
  setSelectedTraceNodeId,
}: Params) {
  const currentMode = useMemo<RuntimeMode>(() => workflowRuntimeMode(draftWorkflow, runMode), [draftWorkflow, runMode])
  const workflowInputFields = useMemo(() => parseWorkflowInputFields(draftWorkflow), [draftWorkflow])
  const displayedRunFields = useMemo(() => {
    const fields = [...workflowInputFields]
    const ensureField = (field: string) => {
      if (!fields.includes(field)) fields.push(field)
    }
    if (fields.length === 0) ensureField('prompt')
    // 2026-07-28: da bo ensureField('aspect_ratio') va ensureField('duration') o day - Sep bao
    // day la 2 o thua (da doi chieu backend main.py: node Anh/Video khi thuc thi LUON uu tien
    // config.aspect_ratio / config.duration cua chinh node do neu co gia tri - ma node Anh/Video
    // gio da co san Ty le/Thoi luong dang dropdown ngay tren khoi node (WorkflowHubMediaSettings),
    // nen 2 o nhap tay o day tu truoc gio thuc te KHONG con tac dung, chi con la o text tu do
    // trung lap va de go nham). Rieng 'reference_image' GIU LAI - khac voi 2 truong tren, backend
    // (execute_workflow_graph node "image") CHI doc state.reference_image (KHONG doc
    // config.reference_image_url cua node) khi chay ca workflow, nen day la noi DUY NHAT nap duoc
    // anh tham chieu cho luot "Chay workflow" toan bo - da test truc tiep, nut "Tai anh" o day
    // hoat dong dung (mo file picker, upload that qua uploadMedia).
    if (workflowHasReferenceInput(draftWorkflow)) ensureField('reference_image')
    const usesGptImage2 = draftWorkflow?.nodes.some(
      (node) => node.type === 'image' && String(node.config.model || '').startsWith('openai/gpt-image-2'),
    )
    if (usesGptImage2 && workflowHasReferenceInput(draftWorkflow)) ensureField('mask_image')
    return fields
  }, [draftWorkflow, workflowInputFields])
  const currentNeedsReference = useMemo(() => displayedRunFields.includes('reference_image'), [displayedRunFields])

  const currentRuns = useMemo(
    () => (workflowId ? runs.filter((run) => run.workflowId === workflowId) : []),
    [runs, workflowId],
  )
  const analyticsRuns = useMemo(() => {
    if (analyticsWindow === 'all') return runs
    const now = Date.now()
    const days = analyticsWindow === '7d' ? 7 : 30
    const cutoff = now - days * 24 * 60 * 60 * 1000
    return runs.filter((run) => Date.parse(run.createdAt) >= cutoff)
  }, [analyticsWindow, runs])
  const workflowRunStatsById = useMemo(() => {
    const result = new Map<string, WorkflowRunStatsSummary>()
    for (const run of analyticsRuns) {
      const key = String(run.workflowId || '')
      if (!key) continue
      const current = result.get(key) || {
        total: 0,
        success: 0,
        failed: 0,
        queued: 0,
        running: 0,
        lastRunAt: null,
        finishedCount: 0,
        avgDurationMs: 0,
      }
      current.total += 1
      if (run.status === 'succeeded') current.success += 1
      else if (run.status === 'failed') current.failed += 1
      else if (run.status === 'queued') current.queued += 1
      else if (run.status === 'running') current.running += 1
      const startedAt = Date.parse(run.createdAt)
      const finishedAt = Date.parse(String(run.finishedAt || run.updatedAt || ''))
      if (
        Number.isFinite(startedAt) &&
        Number.isFinite(finishedAt) &&
        finishedAt >= startedAt &&
        (run.status === 'succeeded' || run.status === 'failed')
      ) {
        const totalDuration = current.avgDurationMs * current.finishedCount + (finishedAt - startedAt)
        current.finishedCount += 1
        current.avgDurationMs = totalDuration / current.finishedCount
      }
      if (!current.lastRunAt || Date.parse(run.createdAt) > Date.parse(current.lastRunAt)) current.lastRunAt = run.createdAt
      result.set(key, current)
    }
    return result
  }, [analyticsRuns])

  const selectedRun = useMemo(
    () => (selectedRunId ? currentRuns.find((run) => run.id === selectedRunId) ?? null : currentRuns[0] ?? null),
    [currentRuns, selectedRunId],
  )
  const selectedRunTrace = useMemo(() => {
    const trace = selectedRun?.outputs?.trace
    return Array.isArray(trace) ? trace : []
  }, [selectedRun])
  const selectedTraceItem = useMemo(() => {
    if (selectedTraceNodeId) {
      return selectedRunTrace.find((item) => String(item?.nodeId || '') === selectedTraceNodeId) ?? null
    }
    return selectedRunTrace[0] ?? null
  }, [selectedRunTrace, selectedTraceNodeId])
  const selectedRunState = useMemo(() => {
    const state = selectedRun?.outputs?.state
    return state && typeof state === 'object' ? state : null
  }, [selectedRun])
  const selectedRunTraceStatusByNodeId = useMemo(() => {
    const result = new Map<string, string>()
    for (const item of selectedRunTrace) {
      const nodeId = String(item?.nodeId || '')
      const status = String(item?.status || '')
      if (nodeId) result.set(nodeId, status)
    }
    return result
  }, [selectedRunTrace])
  const hasPendingRuns = useMemo(
    () => runs.some((run) => run.status === 'queued' || run.status === 'running'),
    [runs],
  )

  useEffect(() => {
    if (!hasPendingRuns) return
    const timer = window.setInterval(() => {
      void refreshData(true)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [hasPendingRuns, refreshData])

  useEffect(() => {
    if (currentRuns.length === 0) {
      setSelectedRunId(null)
      setSelectedTraceNodeId(null)
      return
    }
    setSelectedRunId((current) => (currentRuns.some((run) => run.id === current) ? current : currentRuns[0]?.id ?? null))
  }, [currentRuns, setSelectedRunId, setSelectedTraceNodeId])

  useEffect(() => {
    if (selectedRunTrace.length === 0) {
      setSelectedTraceNodeId(null)
      return
    }
    setSelectedTraceNodeId((current) =>
      current && selectedRunTrace.some((item) => String(item?.nodeId || '') === current)
        ? current
        : String(selectedRunTrace[0]?.nodeId || '') || null,
    )
  }, [selectedRunTrace, setSelectedTraceNodeId])

  return {
    currentMode,
    displayedRunFields,
    currentNeedsReference,
    currentRuns,
    workflowRunStatsById,
    selectedRun,
    selectedRunTrace,
    selectedTraceItem,
    selectedRunState,
    selectedRunTraceStatusByNodeId,
  }
}
