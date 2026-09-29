import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react'
import type { WorkflowDefinition, WorkflowEdge, WorkflowFolder, WorkflowNode } from '../../lib/workflows'
import { parseWorkflowTags } from './workflowHubData'
import type { WorkflowCollection, WorkflowLibraryFilter } from './useWorkflowHubLibraryData'

type EdgeArmMode = 'idle' | 'source' | 'target'
type WorkflowAnalyticsWindow = 'all' | '7d' | '30d'

type Params = {
  draftWorkflow: WorkflowDefinition | null
  selectedNodeId: string | null
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  selectedEdgeId: string | null
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
  edgeSourceId: string
  setEdgeSourceId: Dispatch<SetStateAction<string>>
  edgeTargetId: string
  setEdgeTargetId: Dispatch<SetStateAction<string>>
  edgeArmMode: EdgeArmMode
  setEdgeArmMode: Dispatch<SetStateAction<EdgeArmMode>>
  setCanvasCursor: Dispatch<SetStateAction<{ x: number; y: number } | null>>
  sortedVisibleWorkflows: WorkflowDefinition[]
  setLibraryPreviewWorkflowId: Dispatch<SetStateAction<string | null>>
  setSelectedWorkflowIds: Dispatch<SetStateAction<string[]>>
  selectedLibraryWorkflow: WorkflowDefinition | null
  setLibraryPreviewNameDraft: Dispatch<SetStateAction<string>>
  setLibraryPreviewDescriptionDraft: Dispatch<SetStateAction<string>>
  setLibraryPreviewTagInput: Dispatch<SetStateAction<string>>
  setLibraryPreviewMetadataDraft: Dispatch<SetStateAction<string>>
  folderId: string | 'all'
  folders: WorkflowFolder[]
  activeLibraryCollectionId: string
  customCollections: WorkflowCollection[]
  libraryFilter: WorkflowLibraryFilter
  analyticsWindow: WorkflowAnalyticsWindow
}

export function useWorkflowHubSelectionState({
  draftWorkflow,
  selectedNodeId,
  setSelectedNodeId,
  selectedEdgeId,
  setSelectedEdgeId,
  edgeSourceId,
  setEdgeSourceId,
  edgeTargetId,
  setEdgeTargetId,
  edgeArmMode,
  setEdgeArmMode,
  setCanvasCursor,
  sortedVisibleWorkflows,
  setLibraryPreviewWorkflowId,
  setSelectedWorkflowIds,
  selectedLibraryWorkflow,
  setLibraryPreviewNameDraft,
  setLibraryPreviewDescriptionDraft,
  setLibraryPreviewTagInput,
  setLibraryPreviewMetadataDraft,
  folderId,
  folders,
  activeLibraryCollectionId,
  customCollections,
  libraryFilter,
  analyticsWindow,
}: Params) {
  useEffect(() => {
    if (!draftWorkflow) {
      setSelectedNodeId(null)
      setSelectedEdgeId(null)
      setEdgeSourceId('')
      setEdgeTargetId('')
      setEdgeArmMode('idle')
      setCanvasCursor(null)
      return
    }
    // 2026-07-30: TRUOC DAY effect nay luon tu chon san NODE DAU TIEN moi khi mo/doi workflow
    // (fallback ve draftWorkflow.nodes[0]?.id). Day la root cause that su khien panel phai
    // "Trinh chinh node" LUON tu bung ra ngay khi mo workflow, du WorkflowHub.tsx da doi mac dinh
    // isInspectorCollapsed=true (xem ghi chu o do) - vi co effect KHAC o WorkflowHub.tsx tu mo lai
    // panel ngay khi selectedNodeId khac null, va node dau tien luon bi tu chon nen dieu kien do
    // luon dung tu dau. Sep phan anh nhieu lan giao dien qua nhieu chi tiet so voi app tham khao -
    // app tham khao KHONG highlight san node nao khi vua mo workflow. Fix dung: neu chua co lua
    // chon hop le, GIU NULL (khong node nao duoc chon) thay vi ep chon node dau tien - canvas mo
    // len gon gang dung nhu mong doi, nguoi dung tu bam vao node can sua thi panel moi bung ra.
    setSelectedNodeId((current) => {
      if (current && draftWorkflow.nodes.some((node) => node.id === current)) return current
      return null
    })
    setSelectedEdgeId((current) => {
      if (current && draftWorkflow.edges.some((edge) => edge.id === current)) return current
      return null
    })
    setEdgeSourceId((current) => {
      if (current && draftWorkflow.nodes.some((node) => node.id === current)) return current
      return draftWorkflow.nodes[0]?.id ?? ''
    })
    setEdgeTargetId((current) => {
      if (current && draftWorkflow.nodes.some((node) => node.id === current) && current !== (draftWorkflow.nodes[0]?.id ?? '')) {
        return current
      }
      return draftWorkflow.nodes[1]?.id ?? draftWorkflow.nodes[0]?.id ?? ''
    })
  }, [
    draftWorkflow,
    setCanvasCursor,
    setEdgeArmMode,
    setEdgeSourceId,
    setEdgeTargetId,
    setSelectedEdgeId,
    setSelectedNodeId,
  ])

  const selectedNode = useMemo(
    () => draftWorkflow?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [draftWorkflow, selectedNodeId],
  )

  useEffect(() => {
    if (sortedVisibleWorkflows.length === 0) {
      setLibraryPreviewWorkflowId(null)
      return
    }
    setLibraryPreviewWorkflowId((current) => {
      if (current && sortedVisibleWorkflows.some((workflow) => workflow.id === current)) return current
      return sortedVisibleWorkflows[0].id
    })
  }, [setLibraryPreviewWorkflowId, sortedVisibleWorkflows])

  useEffect(() => {
    const visibleIds = new Set(sortedVisibleWorkflows.map((workflow) => workflow.id))
    setSelectedWorkflowIds((current) => current.filter((workflowIdItem) => visibleIds.has(workflowIdItem)))
  }, [setSelectedWorkflowIds, sortedVisibleWorkflows])

  useEffect(() => {
    setLibraryPreviewNameDraft(selectedLibraryWorkflow?.name || '')
    setLibraryPreviewDescriptionDraft(selectedLibraryWorkflow?.description || '')
    setLibraryPreviewTagInput(selectedLibraryWorkflow ? parseWorkflowTags(selectedLibraryWorkflow).join(', ') : '')
    setLibraryPreviewMetadataDraft(selectedLibraryWorkflow ? String(selectedLibraryWorkflow.metadataJson || '') : '')
  }, [
    selectedLibraryWorkflow,
    setLibraryPreviewDescriptionDraft,
    setLibraryPreviewMetadataDraft,
    setLibraryPreviewNameDraft,
    setLibraryPreviewTagInput,
  ])

  const selectedEdge = useMemo(
    () => draftWorkflow?.edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [draftWorkflow, selectedEdgeId],
  )
  const selectedConditionEdges = useMemo(() => {
    if (!draftWorkflow || !selectedNode || selectedNode.type !== 'condition') return [] as WorkflowEdge[]
    return draftWorkflow.edges.filter((edge) => edge.source === selectedNode.id)
  }, [draftWorkflow, selectedNode])
  const selectedEdgeSourceNode = useMemo(
    () => draftWorkflow?.nodes.find((node) => node.id === selectedEdge?.source) ?? null,
    [draftWorkflow, selectedEdge],
  )
  const selectedEdgeTargetNode = useMemo(
    () => draftWorkflow?.nodes.find((node) => node.id === selectedEdge?.target) ?? null,
    [draftWorkflow, selectedEdge],
  )
  const edgeFormSourceNode = useMemo(
    () => draftWorkflow?.nodes.find((node) => node.id === edgeSourceId) ?? null,
    [draftWorkflow, edgeSourceId],
  )
  const edgeFormTargetNode = useMemo(
    () => draftWorkflow?.nodes.find((node) => node.id === edgeTargetId) ?? null,
    [draftWorkflow, edgeTargetId],
  )
  const armedSourceNode = useMemo<WorkflowNode | null>(
    () => (edgeArmMode === 'source' ? edgeFormSourceNode : null),
    [edgeArmMode, edgeFormSourceNode],
  )
  const armedTargetNode = useMemo<WorkflowNode | null>(
    () => (edgeArmMode === 'target' ? edgeFormTargetNode : null),
    [edgeArmMode, edgeFormTargetNode],
  )

  const folderLabel = useMemo(() => {
    return folders.find((folder) => folder.id === folderId)?.name ?? 'Workflow'
  }, [folderId, folders])
  const activeLibraryCollectionLabel = useMemo(() => {
    if (activeLibraryCollectionId === 'all') return 'Tất cả bộ sưu tập'
    if (activeLibraryCollectionId === 'favorites') return 'Yêu thích'
    return customCollections.find((collection) => collection.id === activeLibraryCollectionId)?.name ?? 'Bộ sưu tập'
  }, [activeLibraryCollectionId, customCollections])
  const activeLibraryFilterLabel = useMemo(() => {
    switch (libraryFilter) {
      case 'templates':
        return 'Mẫu'
      case 'published':
        return 'Đã xuất bản'
      case 'components':
        return 'Thành phần'
      case 'image':
        return 'Ảnh'
      case 'video':
        return 'Video'
      case 'automation':
        return 'Tự động hóa'
      case 'run_heavy':
        return 'Chạy nhiều'
      case 'fail_high':
        return 'Lỗi cao'
      case 'slow':
        return 'Chậm'
      case 'stale':
        return 'Cũ'
      case 'low_use':
        return 'Ít dùng'
      default:
        return 'Tất cả'
    }
  }, [libraryFilter])
  const analyticsWindowLabel = useMemo(() => {
    if (analyticsWindow === 'all') return 'Toàn bộ'
    if (analyticsWindow === '7d') return '7 ngày'
    return '30 ngày'
  }, [analyticsWindow])

  return {
    selectedNode,
    selectedEdge,
    selectedConditionEdges,
    selectedEdgeSourceNode,
    selectedEdgeTargetNode,
    edgeFormSourceNode,
    edgeFormTargetNode,
    armedSourceNode,
    armedTargetNode,
    folderLabel,
    activeLibraryCollectionLabel,
    activeLibraryFilterLabel,
    analyticsWindowLabel,
  }
}
