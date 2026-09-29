import { useCallback, type Dispatch, type SetStateAction } from 'react'
import {
  buildWorkflowEdgeId,
  duplicateNodeAsTemplate,
  instantiateWorkflowBlock,
  type WorkflowBlockTemplate,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowEdgeBranch,
  type WorkflowFrame,
  type WorkflowNode,
  type WorkflowNodeType,
  type WorkflowNote,
} from '../../lib/workflows'
import { generateId } from '../../lib/uuid'
import { nodeCardEstimatedHeight, nodeCardWidth } from './workflowHubUtils'

type EdgeArmMode = 'idle' | 'source' | 'target'

/**
 * Mirrors the "Quy tắc nối node" rules shown statically in WorkflowHubCopilot:
 * Input chỉ nên đứng đầu luồng; Output nên là điểm kết thúc luồng.
 * Kept separate from validateWorkflowDefinition (post-save check) so a bad
 * connection is rejected immediately at drag time instead of after saving.
 */
function findInvalidConnectionReason(sourceNode: WorkflowNode, targetNode: WorkflowNode): string | null {
  if (targetNode.type === 'input') {
    return 'Node "Input" không nên nhận kết nối đến — Input chỉ nên đứng đầu luồng.'
  }
  if (sourceNode.type === 'output') {
    return 'Node "Output" không nên là nguồn của kết nối khác — Output nên là điểm kết thúc luồng.'
  }
  return null
}

type UseWorkflowHubCanvasActionsParams = {
  draftWorkflow: WorkflowDefinition | null
  selectedNode: WorkflowNode | null
  selectedEdge: WorkflowEdge | null
  edgeBranch: WorkflowEdgeBranch | undefined
  edgeSourceId: string
  edgeTargetId: string
  setEditorDraft: Dispatch<SetStateAction<WorkflowDefinition | null>>
  setSelectedNodeId: Dispatch<SetStateAction<string | null>>
  setSelectedEdgeId: Dispatch<SetStateAction<string | null>>
  setEdgeSourceId: Dispatch<SetStateAction<string>>
  setEdgeTargetId: Dispatch<SetStateAction<string>>
  setEdgeArmMode: Dispatch<SetStateAction<EdgeArmMode>>
  updateDraftNode: (nodeId: string, patch: Partial<WorkflowNode>) => void
  buildSuggestedSubflowConfig: (workflow: WorkflowDefinition) => Record<string, string>
  nextConditionBranch: (edges: WorkflowEdge[], sourceId: string) => WorkflowEdgeBranch
  clampPosition: (x: number, y: number) => { x: number; y: number }
}

export function useWorkflowHubCanvasActions({
  draftWorkflow,
  selectedNode,
  selectedEdge,
  edgeBranch,
  edgeSourceId,
  edgeTargetId,
  setEditorDraft,
  setSelectedNodeId,
  setSelectedEdgeId,
  setEdgeSourceId,
  setEdgeTargetId,
  setEdgeArmMode,
  updateDraftNode,
  buildSuggestedSubflowConfig,
  nextConditionBranch,
  clampPosition,
}: UseWorkflowHubCanvasActionsParams) {
  const addNode = useCallback((type: WorkflowNodeType) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const x = draftWorkflow.nodes.length
      ? Math.max(...draftWorkflow.nodes.map((node) => node.x + nodeCardWidth(node.type, node.config.aspect_ratio))) + 64
      : 80
    const y = selectedNode ? selectedNode.y : 120
    const nextNode = duplicateNodeAsTemplate(type, x, y)
    // 2026-07-26f: node Input moi luon mang config mac dinh giong het node dau tien
    // (fields: "prompt, reference_image") -> panel "Chay workflow" gom cac node Input theo TEN field,
    // nen du them bao nhieu node Input thi cung chi thay dung 2 o (trung ten). Tu node Input thu 2
    // tro di, dat ten field rieng (input_2, input_3...) de moi node co 1 o rieng trong panel test;
    // Sep doi lai ten cho de nho qua o "fields" trong Trinh chinh node ben phai.
    if (type === 'input') {
      const existingInputCount = draftWorkflow.nodes.filter((node) => node.type === 'input').length
      if (existingInputCount > 0) {
        nextNode.config = { fields: `input_${existingInputCount + 1}` }
      }
    }
    // 2026-07-27f: Sep yeu cau bo thiet ke "node moi tu dong noi voi node co san" - truoc day luon
    // tu tao 1 edge tu selectedNode (hoac node cuoi cung) toi node vua them, ngay ca khi Sep chi
    // muon tha 1 node roi tu noi tay sau. Gio node moi luon dung doc lap, khong edge nao duoc tao.
    setEditorDraft({
      ...draftWorkflow,
      nodes: [...draftWorkflow.nodes, nextNode],
      edges: draftWorkflow.edges,
    })
    setSelectedNodeId(nextNode.id)
    setSelectedEdgeId(null)
  }, [draftWorkflow, selectedNode, setEditorDraft, setSelectedEdgeId, setSelectedNodeId])

  const addBlock = useCallback((block: WorkflowBlockTemplate) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const anchorX = draftWorkflow.nodes.length
      ? Math.max(...draftWorkflow.nodes.map((node) => node.x + nodeCardWidth(node.type, node.config.aspect_ratio))) + 64
      : 80
    const anchorY = selectedNode?.y ?? 120
    const blockInstance = instantiateWorkflowBlock(block.id, anchorX, anchorY)
    if (!blockInstance || blockInstance.nodes.length === 0) return

    // 2026-07-27f: bo tu dong noi khoi moi voi node dang chon/node cuoi tren canvas (xem ghi chu
    // trong addNode ben tren) - van giu nguyen cac edge NOI BO trong chinh khoi (blockInstance.edges,
    // vd input->prompt->output cua 1 block co san), chi bo phan tu tao THEM 1 connector ra ngoai.
    const nextEdges = [...draftWorkflow.edges, ...blockInstance.edges]

    setEditorDraft({
      ...draftWorkflow,
      nodes: [...draftWorkflow.nodes, ...blockInstance.nodes],
      edges: nextEdges,
    })
    setSelectedNodeId(blockInstance.nodes[0].id)
    setSelectedEdgeId(blockInstance.edges[0]?.id || null)
  }, [draftWorkflow, selectedNode, setEditorDraft, setSelectedEdgeId, setSelectedNodeId])

  const addComponentWorkflowBlock = useCallback((workflow: WorkflowDefinition) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const x = draftWorkflow.nodes.length
      ? Math.max(...draftWorkflow.nodes.map((node) => node.x + nodeCardWidth(node.type, node.config.aspect_ratio))) + 64
      : 80
    const y = selectedNode?.y ?? 120
    const suggestedConfig = buildSuggestedSubflowConfig(workflow)
    const nextNode: WorkflowNode = {
      id: generateId(),
      type: 'subflow',
      label: workflow.componentName || workflow.name,
      description: `Component nội bộ: ${workflow.componentName || workflow.name}`,
      x,
      y,
      config: suggestedConfig,
    }
    // 2026-07-27f: bo tu dong noi component-block moi voi node dang chon/node cuoi (xem ghi chu addNode).
    setEditorDraft({
      ...draftWorkflow,
      nodes: [...draftWorkflow.nodes, nextNode],
      edges: draftWorkflow.edges,
    })
    setSelectedNodeId(nextNode.id)
    setSelectedEdgeId(null)
  }, [buildSuggestedSubflowConfig, draftWorkflow, selectedNode, setEditorDraft, setSelectedEdgeId, setSelectedNodeId])

  const moveNode = useCallback((dx: number, dy: number) => {
    if (!selectedNode || !draftWorkflow || draftWorkflow.category !== 'custom') return
    const next = clampPosition(selectedNode.x + dx, selectedNode.y + dy)
    updateDraftNode(selectedNode.id, next)
  }, [clampPosition, draftWorkflow, selectedNode, updateDraftNode])

  const moveNodeTo = useCallback((nodeId: string, x: number, y: number) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const next = clampPosition(x, y)
    updateDraftNode(nodeId, next)
  }, [clampPosition, draftWorkflow, updateDraftNode])

  const removeSelectedNode = useCallback(() => {
    if (!selectedNode || !draftWorkflow || draftWorkflow.category !== 'custom') return
    // 2026-07-27f: Sep yeu cau bo han "yeu cau toi thieu 2 node" - truoc day chan cung khong cho
    // xoa node cuoi cung/gan cuoi bang alert, gio xoa tu do, ke ca ve 0 node (workflow rong).
    const nextNodes = draftWorkflow.nodes.filter((nodeItem) => nodeItem.id !== selectedNode.id)
    const incoming = draftWorkflow.edges.find((edgeItem) => edgeItem.target === selectedNode.id)
    const outgoing = draftWorkflow.edges.find((edgeItem) => edgeItem.source === selectedNode.id)
    const nextEdges = draftWorkflow.edges.filter(
      (edgeItem) => edgeItem.source !== selectedNode.id && edgeItem.target !== selectedNode.id,
    )
    if (incoming && outgoing) {
      nextEdges.push({
        id: buildWorkflowEdgeId(incoming.source, outgoing.target),
        source: incoming.source,
        target: outgoing.target,
      })
    }
    setEditorDraft({
      ...draftWorkflow,
      nodes: nextNodes,
      edges: nextEdges,
    })
    setSelectedNodeId(nextNodes[0]?.id ?? null)
  }, [draftWorkflow, selectedNode, setEditorDraft, setSelectedNodeId])

  const duplicateNode = useCallback((nodeId: string) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const source = draftWorkflow.nodes.find((node) => node.id === nodeId)
    if (!source) return
    const nextNode: WorkflowNode = {
      ...source,
      id: generateId(),
      label: `${source.label} bản sao`,
      x: source.x,
      y: source.y + nodeCardEstimatedHeight(source.type, source.config.aspect_ratio) + 48,
      config: { ...source.config },
      locked: false,
    }
    setEditorDraft({
      ...draftWorkflow,
      nodes: [...draftWorkflow.nodes, nextNode],
    })
    setSelectedNodeId(nextNode.id)
    setSelectedEdgeId(null)
  }, [draftWorkflow, setEditorDraft, setSelectedEdgeId, setSelectedNodeId])

  const disconnectNode = useCallback((nodeId: string) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    setEditorDraft({
      ...draftWorkflow,
      edges: draftWorkflow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    })
    setSelectedEdgeId(null)
  }, [draftWorkflow, setEditorDraft, setSelectedEdgeId])

  const removeNode = useCallback((nodeId: string) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const nextNodes = draftWorkflow.nodes.filter((node) => node.id !== nodeId)
    setEditorDraft({
      ...draftWorkflow,
      nodes: nextNodes,
      edges: draftWorkflow.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    })
    setSelectedNodeId((current) => (current === nodeId ? nextNodes[0]?.id ?? null : current))
    setSelectedEdgeId(null)
  }, [draftWorkflow, setEditorDraft, setSelectedEdgeId, setSelectedNodeId])

  const appendEdge = useCallback((sourceRaw: string, targetRaw: string, options?: { silent?: boolean }) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return false
    const source = sourceRaw.trim()
    const target = targetRaw.trim()
    const silent = Boolean(options?.silent)
    const fail = (message: string) => {
      if (!silent) window.alert(message)
      return false
    }
    if (!source || !target) return fail('Chọn đủ node nguồn và node đích trước khi thêm edge.')
    if (source === target) return fail('Edge không được nối node vào chính nó.')
    const sourceNode = draftWorkflow.nodes.find((node) => node.id === source)
    if (!sourceNode) return fail('Node nguồn không còn tồn tại.')
    const targetNode = draftWorkflow.nodes.find((node) => node.id === target)
    if (!targetNode) return fail('Node đích không còn tồn tại.')
    const invalidConnectionReason = findInvalidConnectionReason(sourceNode, targetNode)
    if (invalidConnectionReason) return fail(invalidConnectionReason)
    const branch = sourceNode.type === 'condition' ? edgeBranch : undefined
    const nextEdgeId = buildWorkflowEdgeId(source, target, branch)
    if (draftWorkflow.edges.some((edge) => edge.id === nextEdgeId)) return fail('Edge này đã tồn tại.')
    setEditorDraft({
      ...draftWorkflow,
      edges: [...draftWorkflow.edges, { id: nextEdgeId, source, target, branch }],
    })
    setEdgeSourceId(source)
    setEdgeTargetId(target)
    setSelectedEdgeId(nextEdgeId)
    setEdgeArmMode('idle')
    return true
  }, [draftWorkflow, edgeBranch, setEditorDraft, setEdgeArmMode, setEdgeSourceId, setEdgeTargetId, setSelectedEdgeId])

  const addEdgeAction = useCallback(() => {
    const source = edgeSourceId.trim()
    const target = edgeTargetId.trim()
    if (!source || !target) {
      window.alert('Chọn đủ node nguồn và node đích trước khi thêm edge.')
      return
    }
    if (!appendEdge(source, target)) return
  }, [appendEdge, edgeSourceId, edgeTargetId])

  const removeSelectedEdge = useCallback(() => {
    if (!selectedEdge || !draftWorkflow || draftWorkflow.category !== 'custom') return
    setEditorDraft({
      ...draftWorkflow,
      edges: draftWorkflow.edges.filter((edge) => edge.id !== selectedEdge.id),
    })
    setSelectedEdgeId(null)
  }, [draftWorkflow, selectedEdge, setEditorDraft, setSelectedEdgeId])

  // 2026-08-02: "Khung" (Frame) - tham khao Comfy Cloud ("thêm khung, gom node lại để di chuyển,
  // chạy độc lập, lưu thành mẫu"). Gom node theo VI TRI hinh hoc (xem workflowHubUtils.nodesInFrame),
  // khong luu danh sach id rieng nen keo node ra/vao khung tu dong cap nhat, khong can dong bo tay.
  const addFrame = useCallback(() => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const anchorX = selectedNode?.x ?? (draftWorkflow.nodes[0]?.x ?? 80)
    const anchorY = selectedNode?.y ?? (draftWorkflow.nodes[0]?.y ?? 80)
    const nextFrame: WorkflowFrame = {
      id: generateId(),
      x: Math.max(0, anchorX - 40),
      y: Math.max(0, anchorY - 100),
      width: 560,
      height: 420,
      label: `Khung ${(draftWorkflow.frames?.length ?? 0) + 1}`,
    }
    setEditorDraft({ ...draftWorkflow, frames: [...(draftWorkflow.frames ?? []), nextFrame] })
  }, [draftWorkflow, selectedNode, setEditorDraft])

  const updateFrame = useCallback((frameId: string, patch: Partial<WorkflowFrame>) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    setEditorDraft({
      ...draftWorkflow,
      frames: (draftWorkflow.frames ?? []).map((frame) => (frame.id === frameId ? { ...frame, ...patch } : frame)),
    })
  }, [draftWorkflow, setEditorDraft])

  const removeFrame = useCallback((frameId: string) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    setEditorDraft({ ...draftWorkflow, frames: (draftWorkflow.frames ?? []).filter((frame) => frame.id !== frameId) })
  }, [draftWorkflow, setEditorDraft])

  // 2026-08-02: keo header khung -> doi vi tri khung VA doi luon vi tri toan bo node dang nam trong
  // khung (cung 1 do dich dx/dy) de "di chuyen ca cum" giong hanh vi Comfy Cloud, khong chi doi
  // rieng khung roi bo lai node cu.
  const moveFrameBy = useCallback((frameId: string, dx: number, dy: number, memberNodeIds: string[]) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    setEditorDraft({
      ...draftWorkflow,
      frames: (draftWorkflow.frames ?? []).map((frame) =>
        frame.id === frameId ? { ...frame, x: frame.x + dx, y: frame.y + dy } : frame,
      ),
      nodes: draftWorkflow.nodes.map((node) =>
        memberNodeIds.includes(node.id) ? { ...node, x: node.x + dx, y: node.y + dy } : node,
      ),
    })
  }, [draftWorkflow, setEditorDraft])

  // 2026-08-02: "Ghi chu" (Note) - dat tu do tren canvas, khong gan node nao (tham khao Comfy Cloud).
  const addNote = useCallback((x: number, y: number) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    const nextNote: WorkflowNote = { id: generateId(), x, y, text: '' }
    setEditorDraft({ ...draftWorkflow, notes: [...(draftWorkflow.notes ?? []), nextNote] })
    return nextNote.id
  }, [draftWorkflow, setEditorDraft])

  const updateNote = useCallback((noteId: string, patch: Partial<WorkflowNote>) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    setEditorDraft({
      ...draftWorkflow,
      notes: (draftWorkflow.notes ?? []).map((note) => (note.id === noteId ? { ...note, ...patch } : note)),
    })
  }, [draftWorkflow, setEditorDraft])

  const removeNote = useCallback((noteId: string) => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom') return
    setEditorDraft({ ...draftWorkflow, notes: (draftWorkflow.notes ?? []).filter((note) => note.id !== noteId) })
  }, [draftWorkflow, setEditorDraft])

  return {
    addNode,
    addBlock,
    addComponentWorkflowBlock,
    moveNode,
    moveNodeTo,
    removeSelectedNode,
    duplicateNode,
    disconnectNode,
    removeNode,
    appendEdge,
    addEdgeAction,
    removeSelectedEdge,
    addFrame,
    updateFrame,
    removeFrame,
    moveFrameBy,
    addNote,
    updateNote,
    removeNote,
  }
}
