import { useEffect, useRef, useState } from 'react'
import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react'
import { Check, Copy, Download, Film, GripVertical, ImagePlus, Layers, Link2Off, Loader2, Lock, Maximize2, Minus, Pencil, Play, Plus, RotateCcw, Save, Sparkles, Trash2, Upload, X } from 'lucide-react'
import type { WorkflowDefinition, WorkflowEdgeBranch, WorkflowFrame, WorkflowMedia, WorkflowNode, WorkflowNodeType, WorkflowNote } from '../../lib/workflows'
import { downloadStudioMedia, studioDownloadFilename, uploadMedia } from '../../lib/api'
import { WorkflowHubCanvasToolbar } from './WorkflowHubCanvasToolbar'
import { WorkflowHubTextModal } from './WorkflowHubTextModal'
import { WorkflowHubNodeMediaPanel } from './WorkflowHubNodeMediaPanel'
import { WorkflowHubNodeAudioPanel } from './WorkflowHubNodeAudioPanel'
import { WorkflowHubAssetPickerPopover } from './WorkflowHubAssetPickerPopover'
import {
  fileAcceptForField,
  isUploadableField,
  nodeCardEstimatedHeight,
  nodeCardWidth,
  nodesInFrame,
  primaryInlineEditableKey,
  uploadKindForField,
  uploadLabelForField,
  type NodeLibraryItem,
} from './workflowHubUtils'

type EdgeArmMode = 'idle' | 'source' | 'target'

function inlineEditorLabel(type: WorkflowNodeType): string {
  if (type === 'input') return 'Trường dữ liệu'
  if (type === 'prompt') return 'Công thức prompt (node)'
  return 'Nội dung'
}

function inlineEditorPlaceholder(type: WorkflowNodeType): string {
  if (type === 'input') return 'vd: topic, script (cách nhau bằng dấu phẩy) — bấm để nhập'
  if (type === 'prompt') return 'Nhập nội dung prompt... dùng {{prompt}} để chèn giá trị — bấm để nhập'
  return 'Nhập nội dung... dùng {{bien}} để chèn giá trị — bấm để nhập'
}

type ComponentCanvasInfo = {
  workflow: WorkflowDefinition
  inputs: string[]
  outputs: Array<[string, string]>
}

type Props = {
  draftWorkflow: WorkflowDefinition
  mediaLabel: (media: WorkflowMedia) => string
  workflowValidationErrorsCount: number
  workflowValidationWarningsCount: number
  syncing: boolean
  edgeArmMode: EdgeArmMode
  armedSourceNode: WorkflowNode | null
  armedTargetNode: WorkflowNode | null
  isEditable: boolean
  onCancelEdgeArm: () => void
  saveWorkflowDraft: () => Promise<void>
  isDirty: boolean
  isSaving: boolean
  canvasWidth: number
  canvasHeight: number
  canvasCursor: { x: number; y: number } | null
  setCanvasCursor: (value: { x: number; y: number } | null) => void
  selectedEdgeId: string | null
  setSelectedEdgeId: (value: string | null) => void
  selectedNodeId: string | null
  setSelectedNodeId: (value: string | null) => void
  selectedTraceNodeId: string | null
  setSelectedTraceNodeId: (value: string | null) => void
  selectedRunTraceStatusByNodeId: Map<string, string>
  latestOutputByNodeId: Map<string, { url: string; type: 'image' | 'video' }>
  edgeSourceId: string
  edgeTargetId: string
  setEdgeSourceId: (value: string) => void
  setEdgeTargetId: (value: string) => void
  setEdgeArmMode: (value: EdgeArmMode) => void
  appendEdge: (sourceRaw: string, targetRaw: string, options?: { silent?: boolean }) => boolean
  moveNodeTo: (nodeId: string, x: number, y: number) => void
  componentCanvasInfoByNodeId: Map<string, ComponentCanvasInfo>
  nodeTypeColors: Record<WorkflowNodeType, string>
  nodeIcon: (type: WorkflowNodeType) => ReactNode
  updateDraftNode: (nodeId: string, updates: Partial<WorkflowNode>) => void
  // 2026-07-26i: nut "+ Them node" noi ngay tren canvas (khong can cuon sang palette ben trai nua).
  nodeLibraryItems: NodeLibraryItem[]
  onAddNode: (type: WorkflowNodeType) => void
  // 2026-07-26j: state cua popover "+ Them node" nay nam o WorkflowHub.tsx (component cha), khong con
  // giu local nua - de nut tuong tu trong sidebar "Thu vien node" (WorkflowHubEditorPalette) co the
  // mo dung popover nay, tranh 2 UI trung lap cung lam 1 viec.
  isNodeQuickAddOpen: boolean
  onOpenNodeQuickAdd: () => void
  onCloseNodeQuickAdd: () => void
  // 2026-07-26L: 4 nut moi trong thanh cong cu canvas - xem WorkflowHubCanvasToolbar.tsx.
  showGrid: boolean
  onToggleGrid: () => void
  canUndo: boolean
  onUndo: () => void
  onAutoArrange: () => void
  onToggleLock: () => void
  onBeginNodeDrag: () => void
  onDuplicateNode: (nodeId: string) => void
  onDisconnectNode: (nodeId: string) => void
  onRemoveNode: (nodeId: string) => void
  // 2026-07-27: an/hien panel trai-phai de canvas rong ra - xem ghi chu trong WorkflowHubCanvasToolbar.tsx.
  isPaletteCollapsed: boolean
  onTogglePalette: () => void
  // 2026-07-27: nhap gia tri that (prompt, url anh...) truc tiep tren node Input ngay tren canvas -
  // dung chung state voi panel "Chay workflow" nen 2 noi luon dong bo, khong tao thanh 1 nguon du lieu moi.
  runInputValues: Record<string, string>
  // 2026-07-30: nut "Chay workflow" luon hien tren toolbar canvas (khong phu thuoc panel trai dang
  // dong/mo) - xem ghi chu o WorkflowHub.tsx cho ly do (mac dinh an 2 panel de canvas gon).
  runWorkflowAction: (targetNodeId?: string) => void | Promise<void>
  isRunning: boolean
  setRunInputValues: Dispatch<SetStateAction<Record<string, string>>>
  inputFieldLabel: (field: string) => string
  inputFieldPlaceholder: (field: string) => string
  isLongTextField: (field: string) => boolean
  // 2026-08-02: "Khung" (Frame) - gom node de di chuyen/luu mau (tham khao Comfy Cloud).
  frames: WorkflowFrame[]
  onAddFrame: () => void
  onUpdateFrame: (frameId: string, patch: Partial<WorkflowFrame>) => void
  onRemoveFrame: (frameId: string) => void
  onMoveFrameBy: (frameId: string, dx: number, dy: number, memberNodeIds: string[]) => void
  onSaveFrameAsPreset: (frame: { id: string; label: string }) => void
  // 2026-08-02: "Ghi chu" (Note) tu do tren canvas (tham khao Comfy Cloud).
  notes: WorkflowNote[]
  isPlacingNote: boolean
  onToggleNotePlacement: () => void
  onPlaceNote: (x: number, y: number) => string | undefined
  onUpdateNote: (noteId: string, patch: Partial<WorkflowNote>) => void
  onRemoveNote: (noteId: string) => void
}

function edgeBranchLabel(branch?: WorkflowEdgeBranch) {
  if (branch === 'true') return 'TRUE'
  if (branch === 'false') return 'FALSE'
  if (branch === 'always') return 'ALWAYS'
  return ''
}

export function WorkflowHubEditorCanvas({
  draftWorkflow,
  mediaLabel,
  workflowValidationErrorsCount,
  workflowValidationWarningsCount,
  syncing,
  edgeArmMode,
  armedSourceNode,
  armedTargetNode,
  isEditable,
  onCancelEdgeArm,
  saveWorkflowDraft,
  isDirty,
  isSaving,
  canvasWidth,
  canvasHeight,
  canvasCursor,
  setCanvasCursor,
  selectedEdgeId,
  setSelectedEdgeId,
  selectedNodeId,
  setSelectedNodeId,
  selectedTraceNodeId,
  setSelectedTraceNodeId,
  selectedRunTraceStatusByNodeId,
  latestOutputByNodeId,
  edgeSourceId,
  edgeTargetId,
  setEdgeSourceId,
  setEdgeTargetId,
  setEdgeArmMode,
  appendEdge,
  moveNodeTo,
  componentCanvasInfoByNodeId,
  nodeTypeColors,
  nodeIcon,
  updateDraftNode,
  nodeLibraryItems,
  onAddNode,
  isNodeQuickAddOpen,
  onOpenNodeQuickAdd,
  onCloseNodeQuickAdd,
  showGrid,
  onToggleGrid,
  canUndo,
  onUndo,
  onAutoArrange,
  onToggleLock,
  onBeginNodeDrag,
  onDuplicateNode,
  onDisconnectNode,
  onRemoveNode,
  isPaletteCollapsed,
  onTogglePalette,
  runInputValues,
  setRunInputValues,
  inputFieldLabel,
  inputFieldPlaceholder,
  isLongTextField,
  runWorkflowAction,
  isRunning,
  frames,
  onAddFrame,
  onUpdateFrame,
  onRemoveFrame,
  onMoveFrameBy,
  onSaveFrameAsPreset,
  notes,
  isPlacingNote,
  onToggleNotePlacement,
  onPlaceNote,
  onUpdateNote,
  onRemoveNote,
}: Props) {
  const armedSourceLabel = armedSourceNode?.label ?? null
  const armedTargetLabel = armedTargetNode?.label ?? null
  // 2026-07-26L: node dang duoc chon that su (object, khong chi id) - dung cho nut "Khoa" biet
  // trang thai locked hien tai va bat/tat duoc khi co/khong co node nao dang chon.
  const selectedNode = draftWorkflow.nodes.find((nodeItem) => nodeItem.id === selectedNodeId) ?? null
  // 2026-07-26g: node nao dang bung o nhap noi dung inline ngay tren canvas (chi 1 node tai 1 thoi diem).
  const [expandedFieldNodeId, setExpandedFieldNodeId] = useState<string | null>(null)
  // 2026-07-26h: noi dung dang go trong o inline duoc luu tam o day (khong ghi thang vao draftWorkflow
  // moi phim go nua) de nut "Dong" co the huy bo thay doi chua luu, giong hanh vi Luu/Dong Sep yeu cau.
  const [inlineDraftValue, setInlineDraftValue] = useState('')
  // 2026-07-26i: mo rong o nhap inline thanh modal toan man hinh - danh cho prompt/noi dung dai, xem
  // ghi chu o nut "Mo rong" trong toolbar cua o inline ben duoi.
  const [isFullModalOpen, setIsFullModalOpen] = useState(false)
  // 2026-07-28i: Sep bao node Dau vao "tôi cần có nút để tải dữ liệu (ảnh/video) lên ở đây" - truoc
  // do o "TRUONG DU LIEU" chi khai bao TEN field (vd "prompt, reference_image") bang chu, khong co
  // cach tai file that. Them nut tai anh/video that ngay tren node Dau vao cho tung field da khai
  // bao la kieu upload (isUploadableField - reference_image/image_url/video_url/audio_url). Key
  // theo `${nodeId}:${field}` de nhieu node Input (hiem khi co nhung van ho tro) khong dam vao nhau.
  const [uploadingFieldKey, setUploadingFieldKey] = useState<string | null>(null)
  const [uploadFieldError, setUploadFieldError] = useState<{ key: string; message: string } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null)
  const [contextFileTarget, setContextFileTarget] = useState<{ nodeId: string; field: string } | null>(null)
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null)
  const [renamingNodeLabel, setRenamingNodeLabel] = useState('')
  const cancelingNodeRenameRef = useRef(false)
  const contextFileInputRef = useRef<HTMLInputElement | null>(null)

  async function handleNodeFieldUpload(nodeItem: WorkflowNode, field: string, file: File | null) {
    if (!file || !isEditable) return
    const fieldKey = `${nodeItem.id}:${field}`
    setUploadingFieldKey(fieldKey)
    setUploadFieldError(null)
    try {
      const result = await uploadMedia(file, uploadKindForField(field))
      updateDraftNode(nodeItem.id, { config: { ...nodeItem.config, [field]: result.url } })
      // Dong bo luon vao runInputValues (gia tri chay workflow that) - de tai anh/video ngay tren
      // node Dau vao la CO tac dung that khi bam "Chay workflow", khong phai vao lai run panel
      // dan URL them 1 lan nua.
      setRunInputValues((current) => ({ ...current, [field]: result.url }))
    } catch (err) {
      setUploadFieldError({ key: fieldKey, message: err instanceof Error ? err.message : 'Tải lên thất bại.' })
    } finally {
      setUploadingFieldKey(null)
    }
  }

  function inputFileField(nodeItem: WorkflowNode) {
    const declaredFields = String(nodeItem.config.fields || '')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
    return declaredFields.find((field) => isUploadableField(field)) || 'reference_image'
  }

  function inputFileUrl(nodeItem: WorkflowNode, field: string) {
    return runInputValues[field] || nodeItem.config[field] || ''
  }

  function renameNode(nodeItem: WorkflowNode) {
    setSelectedNodeId(nodeItem.id)
    setRenamingNodeId(nodeItem.id)
    setRenamingNodeLabel(nodeItem.label)
  }

  function commitNodeRename(nodeItem: WorkflowNode) {
    if (cancelingNodeRenameRef.current) {
      cancelingNodeRenameRef.current = false
      return
    }
    const nextLabel = renamingNodeLabel.trim()
    setRenamingNodeId(null)
    setRenamingNodeLabel('')
    if (nextLabel && nextLabel !== nodeItem.label) updateDraftNode(nodeItem.id, { label: nextLabel })
  }

  function cancelNodeRename() {
    cancelingNodeRenameRef.current = true
    setRenamingNodeId(null)
    setRenamingNodeLabel('')
  }

  function updateMediaNodeConfig(nodeItem: WorkflowNode, patch: Record<string, string>) {
    const nextRatio = patch.aspect_ratio
    if (nextRatio && nextRatio !== nodeItem.config.aspect_ratio) {
      onBeginNodeDrag()
      const gap = 48
      const mediaWidth = nodeCardWidth(nodeItem.type, nextRatio)
      const mediaHeight = nodeCardEstimatedHeight(nodeItem.type, nextRatio)
      const verticallyRelevant = draftWorkflow.nodes.filter((other) => {
        if (other.id === nodeItem.id) return false
        const otherHeight = nodeCardEstimatedHeight(other.type, other.config.aspect_ratio)
        return other.y < nodeItem.y + mediaHeight + gap && other.y + otherHeight + gap > nodeItem.y
      })
      const leftNodes = verticallyRelevant
        .filter((other) => other.x < nodeItem.x)
        .sort((a, b) => b.x - a.x)
      let leftCursor = nodeItem.x - gap
      for (const other of leftNodes) {
        const otherWidth = nodeCardWidth(other.type, other.config.aspect_ratio)
        const nextX = Math.max(20, Math.min(other.x, leftCursor - otherWidth))
        if (nextX !== other.x) moveNodeTo(other.id, nextX, other.y)
        leftCursor = nextX - gap
      }
      const rightBoundary = nodeItem.x + mediaWidth + gap
      const rightNodes = verticallyRelevant
        .filter((other) => other.x >= nodeItem.x)
        .sort((a, b) => a.x - b.x)
      let rightCursor = rightBoundary
      for (const other of rightNodes) {
        const nextX = Math.max(other.x, rightCursor)
        if (nextX !== other.x) moveNodeTo(other.id, nextX, other.y)
        rightCursor = nextX + nodeCardWidth(other.type, other.config.aspect_ratio) + gap
      }
    }
    updateDraftNode(nodeItem.id, { config: { ...nodeItem.config, ...patch } })
  }

  const openInlineEditor = (nodeItem: WorkflowNode, key: string) => {
    setSelectedNodeId(nodeItem.id)
    setInlineDraftValue(nodeItem.config[key] || '')
    setExpandedFieldNodeId(nodeItem.id)
  }
  const openFullEditor = (nodeItem: WorkflowNode, key: string) => {
    openInlineEditor(nodeItem, key)
    setIsFullModalOpen(true)
  }
  const commitInlineEdit = (nodeItem: WorkflowNode, key: string, nextValue = inlineDraftValue) => {
    updateDraftNode(nodeItem.id, { config: { ...nodeItem.config, [key]: nextValue } })
    setExpandedFieldNodeId(null)
    setIsFullModalOpen(false)
  }
  const discardInlineEdit = () => {
    setExpandedFieldNodeId(null)
    setIsFullModalOpen(false)
  }
  const modalNode = isFullModalOpen ? draftWorkflow.nodes.find((node) => node.id === expandedFieldNodeId) ?? null : null
  const modalKey = modalNode ? primaryInlineEditableKey(modalNode.type) : null
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{
    nodeId: string
    offsetX: number
    offsetY: number
    moved: boolean
  } | null>(null)
  const suppressClickNodeIdRef = useRef<string | null>(null)
  // 2026-08-02: keo header "Khung" (Frame) - di chuyen ca khung VA toan bo node dang nam trong no
  // (tinh boi nodesInFrame luc BAT DAU keo, giu nguyen danh sach do trong suot cu keo de tranh
  // "ke di ke o" khi node vua ra khoi bien khung giua chung).
  const frameDragStateRef = useRef<{ frameId: string; startX: number; startY: number; offsetX: number; offsetY: number; memberNodeIds: string[] } | null>(null)
  // 2026-08-02: keo o resize goc duoi-phai cua khung - doi rieng width/height, khong dich chuyen node.
  const frameResizeStateRef = useRef<{ frameId: string; startWidth: number; startHeight: number; startClientX: number; startClientY: number } | null>(null)
  const [renamingFrameId, setRenamingFrameId] = useState<string | null>(null)

  // 2026-07-27: zoom bang con lan chuot - Sep yeu cau "muon tang dien tich khung quy trinh lam
  // viec chi can thao tac con lan chuot" (giong cac app khac). zoomRef giu gia tri moi nhat de
  // handler keo-tha node (dang dang ky 1 lan qua window listener) doc duoc ngay ma khong phai
  // dua zoom vao dependency array cua effect ben duoi (tranh go/dang ky lai listener lien tuc
  // moi lan cuon chuot). zoom (state) chi dung de re-render CSS transform:scale hien thi.
  const zoomRef = useRef(1)
  const [zoom, setZoom] = useState(1)
  const setCanvasZoom = (nextZoom: number) => {
    const normalized = Math.min(1.6, Math.max(0.4, Math.round(nextZoom * 100) / 100))
    zoomRef.current = normalized
    setZoom(normalized)
  }
  const canvasScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const scrollEl = canvasScrollRef.current
    if (!scrollEl) return
    const handleWheel = (event: globalThis.WheelEvent) => {
      // Chan hanh vi cuon trang mac dinh cua trinh duyet - phai dang ky qua addEventListener
      // { passive:false } (khong dung onWheel cua React) vi trinh duyet mac dinh coi wheel
      // listener la passive, goi preventDefault() se bi bo qua/canh bao neu khong khai bao the.
      event.preventDefault()
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      const next = Math.min(1.6, Math.max(0.4, Math.round(zoomRef.current * factor * 100) / 100))
      zoomRef.current = next
      setZoom(next)
    }
    scrollEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => scrollEl.removeEventListener('wheel', handleWheel)
  }, [])

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const drag = dragStateRef.current
      const canvas = canvasRef.current
      if (!drag || !canvas || !isEditable) return
      const rect = canvas.getBoundingClientRect()
      // rect la kich thuoc TREN MAN HINH (da nhan zoom qua transform:scale), con nodeItem.x/y luu
      // o "khong gian mo hinh" (khong nhan zoom) - phai chia lai cho zoomRef.current de quy doi
      // dung, neu khong node se nhay sai vi tri moi khi keo luc dang zoom khac 100%.
      const nextX = (event.clientX - rect.left - drag.offsetX) / zoomRef.current
      const nextY = (event.clientY - rect.top - drag.offsetY) / zoomRef.current
      drag.moved = true
      moveNodeTo(drag.nodeId, nextX, nextY)
    }

    const handleMouseUp = () => {
      const drag = dragStateRef.current
      if (drag?.moved) suppressClickNodeIdRef.current = drag.nodeId
      dragStateRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isEditable, moveNodeTo])

  // 2026-08-02: keo header/resize khung "Khung" (Frame) - tach rieng listener khoi keo node o tren
  // vi 2 hanh dong doc lap (khung khong phai 1 node), cung dung chung nguyen tac chia cho zoomRef.
  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      const frameDrag = frameDragStateRef.current
      const frameResize = frameResizeStateRef.current
      const canvas = canvasRef.current
      if (!canvas || !isEditable) return
      if (frameDrag) {
        const rect = canvas.getBoundingClientRect()
        const nextX = (event.clientX - rect.left - frameDrag.offsetX) / zoomRef.current
        const nextY = (event.clientY - rect.top - frameDrag.offsetY) / zoomRef.current
        const dx = nextX - frameDrag.startX
        const dy = nextY - frameDrag.startY
        onMoveFrameBy(frameDrag.frameId, dx, dy, frameDrag.memberNodeIds)
        frameDrag.startX = nextX
        frameDrag.startY = nextY
      } else if (frameResize) {
        const dx = (event.clientX - frameResize.startClientX) / zoomRef.current
        const dy = (event.clientY - frameResize.startClientY) / zoomRef.current
        onUpdateFrame(frameResize.frameId, {
          width: Math.max(240, Math.round(frameResize.startWidth + dx)),
          height: Math.max(160, Math.round(frameResize.startHeight + dy)),
        })
      }
    }
    const handleMouseUp = () => {
      frameDragStateRef.current = null
      frameResizeStateRef.current = null
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isEditable, onMoveFrameBy, onUpdateFrame])

  useEffect(() => {
    if (!contextMenu) return
    const closeOnPointerDown = (event: globalThis.PointerEvent) => {
      if ((event.target as HTMLElement | null)?.closest('.wf-node-context-menu')) return
      setContextMenu(null)
    }
    const closeOnKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    const closeOnViewportChange = () => setContextMenu(null)
    window.addEventListener('pointerdown', closeOnPointerDown)
    window.addEventListener('keydown', closeOnKeyDown)
    window.addEventListener('resize', closeOnViewportChange)
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown)
      window.removeEventListener('keydown', closeOnKeyDown)
      window.removeEventListener('resize', closeOnViewportChange)
    }
  }, [contextMenu])

  const contextNode = contextMenu
    ? draftWorkflow.nodes.find((node) => node.id === contextMenu.nodeId) ?? null
    : null

  return (
    <section className="wf-canvas-wrap">
      <WorkflowHubCanvasToolbar
        draftWorkflow={draftWorkflow}
        mediaLabel={mediaLabel}
        workflowValidationErrorsCount={workflowValidationErrorsCount}
        workflowValidationWarningsCount={workflowValidationWarningsCount}
        syncing={syncing}
        edgeArmMode={edgeArmMode}
        armedSourceLabel={armedSourceLabel}
        armedTargetLabel={armedTargetLabel}
        isEditable={isEditable}
        onCancelEdgeArm={onCancelEdgeArm}
        saveWorkflowDraft={saveWorkflowDraft}
        isDirty={isDirty}
        isSaving={isSaving}
        nodeLibraryItems={nodeLibraryItems}
        onAddNode={onAddNode}
        isNodeQuickAddOpen={isNodeQuickAddOpen}
        onOpenNodeQuickAdd={onOpenNodeQuickAdd}
        onCloseNodeQuickAdd={onCloseNodeQuickAdd}
        showGrid={showGrid}
        onToggleGrid={onToggleGrid}
        canUndo={canUndo}
        onUndo={onUndo}
        onAutoArrange={onAutoArrange}
        isNodeSelected={!!selectedNode}
        isSelectedNodeLocked={!!selectedNode?.locked}
        onToggleLock={onToggleLock}
        isPaletteCollapsed={isPaletteCollapsed}
        onTogglePalette={onTogglePalette}
        runWorkflowAction={runWorkflowAction}
        isRunning={isRunning}
        onAddFrame={onAddFrame}
        isPlacingNote={isPlacingNote}
        onToggleNotePlacement={onToggleNotePlacement}
      />
      {/* 2026-07-26k: nut "+ Them node" da doi vao trong WorkflowHubCanvasToolbar (hang nut, canh
          "Luu thay doi") de tranh de len nhau - xem ghi chu trong WorkflowHubCanvasToolbar.tsx. */}

      {modalNode && modalKey && (
        <WorkflowHubTextModal
          title={`${modalNode.label} — ${inlineEditorLabel(modalNode.type)}`}
          value={inlineDraftValue}
          placeholder={inlineEditorPlaceholder(modalNode.type)}
          isEditable={isEditable}
          onSave={(nextValue) => commitInlineEdit(modalNode, modalKey, nextValue)}
          onClose={discardInlineEdit}
        />
      )}

      <input
        ref={contextFileInputRef}
        className="wf-node-context-file-input"
        type="file"
        accept={contextFileTarget ? fileAcceptForField(contextFileTarget.field) : 'image/*,video/*,audio/*'}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          const target = contextFileTarget
          const nodeItem = target ? draftWorkflow.nodes.find((node) => node.id === target.nodeId) : null
          if (file && target && nodeItem) void handleNodeFieldUpload(nodeItem, target.field, file)
          event.target.value = ''
          setContextFileTarget(null)
        }}
      />

      {contextMenu && contextNode && (
        <div
          className="wf-node-context-menu"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 232),
            top: Math.min(contextMenu.y, window.innerHeight - 330),
          }}
          role="menu"
          aria-label={`Thao tác với ${contextNode.label}`}
        >
          <div className="wf-node-context-menu-title">{contextNode.label}</div>
          <button type="button" role="menuitem" onClick={() => { onDuplicateNode(contextNode.id); setContextMenu(null) }}>
            <Copy size={15} /> Nhân bản
          </button>
          <button type="button" role="menuitem" onClick={() => { renameNode(contextNode); setContextMenu(null) }}>
            <Pencil size={15} /> Đổi tên
          </button>

          {contextNode.type === 'input' && (() => {
            const field = inputFileField(contextNode)
            const url = inputFileUrl(contextNode, field)
            const kind = field.toLowerCase().includes('video') ? 'video' : 'image'
            return (
              <>
                <button
                  type="button"
                  role="menuitem"
                  disabled={!url}
                  onClick={() => {
                    if (url) void downloadStudioMedia(url, studioDownloadFilename(contextNode.label, kind, url))
                    setContextMenu(null)
                  }}
                >
                  <Download size={15} /> Tải xuống
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    const declaredFields = String(contextNode.config.fields || '').split(',').map((item) => item.trim()).filter(Boolean)
                    if (!declaredFields.includes(field)) {
                      updateDraftNode(contextNode.id, {
                        config: { ...contextNode.config, fields: [...declaredFields, field].join(', ') },
                      })
                    }
                    setContextFileTarget({ nodeId: contextNode.id, field })
                    setContextMenu(null)
                    window.setTimeout(() => contextFileInputRef.current?.click(), 0)
                  }}
                >
                  <Upload size={15} /> Đổi file
                </button>
              </>
            )
          })()}

          {(contextNode.type === 'image' || contextNode.type === 'video' || contextNode.type === 'output') && (
            <button
              type="button"
              role="menuitem"
              disabled={isRunning}
              onClick={() => {
                setSelectedTraceNodeId(contextNode.id)
                void runWorkflowAction(contextNode.id)
                setContextMenu(null)
              }}
            >
              {isRunning ? <Loader2 size={15} className="spin" /> : <Play size={15} />} Chạy node này
            </button>
          )}

          {contextNode.type === 'input' ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => { onRemoveNode(contextNode.id); setContextMenu(null) }}
              >
                <Trash2 size={15} /> Xóa
              </button>
              <button type="button" role="menuitem" onClick={() => { onDisconnectNode(contextNode.id); setContextMenu(null) }}>
                <Link2Off size={15} /> Hủy liên kết
              </button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => { onDisconnectNode(contextNode.id); setContextMenu(null) }}>
                <Link2Off size={15} /> Hủy liên kết
              </button>
              <button
                type="button"
                role="menuitem"
                className="danger"
                onClick={() => { onRemoveNode(contextNode.id); setContextMenu(null) }}
              >
                <Trash2 size={15} /> Xóa
              </button>
            </>
          )}
        </div>
      )}

      <div
        // 2026-07-27d: Sep gui video 0727.mp4 doi chieu app tham khao - o app do cuon chuot chi lam
        // NOI DUNG nho lai trong khi KHUNG (viewport) giu nguyen kich thuoc, nen cam giac "dien tich
        // lam viec tang len". App minh truoc day scale nham vao .wf-canvas - chinh la div co vien
        // net dut + nen luoi cham (xem index.css) - nen khung nhin do TU CO LAI theo zoom cung voi
        // node, dung y het loi Sep chi ra ("node thay doi kich thuoc CUNG VOI khung"). Fix: doi vien
        // net dut + nen luoi cham sang chinh div .wf-canvas-scroll nay (khong bi transform:scale anh
        // huong, luon giu nguyen kich thuoc lap day cot giua cua grid layout) - .wf-canvas ben trong
        // gio chi con la lop noi dung thuan tuy (position:relative de node/svg dinh vi), zoom van
        // scale dung no nhung khung/nen luoi ben ngoai khong con co/gian theo nua.
        className={`wf-canvas-scroll${showGrid ? '' : ' wf-canvas-no-grid'}`}
        ref={canvasScrollRef}
      >
        <div className="wf-minimap" aria-label="Bản đồ thu nhỏ workflow">
          <div className="wf-minimap-head">
            <span>Minimap</span>
            <em>{draftWorkflow.nodes.length}</em>
          </div>
          <div className="wf-minimap-stage">
            {draftWorkflow.nodes.map((nodeItem) => (
              <span
                key={nodeItem.id}
                className="wf-minimap-node"
                style={{
                  left: `${Math.max(2, Math.min(94, (nodeItem.x / canvasWidth) * 100))}%`,
                  top: `${Math.max(4, Math.min(90, (nodeItem.y / canvasHeight) * 100))}%`,
                  background: nodeTypeColors[nodeItem.type],
                }}
              />
            ))}
          </div>
        </div>

        {draftWorkflow.nodes.length === 0 && (
          <div className="wf-canvas-empty-state">
            <div className="wf-canvas-empty-mark"><Sparkles size={26} /></div>
            <h3>Bắt đầu luồng mới</h3>
            <p>Kéo node từ thanh công cụ hoặc chọn một điểm bắt đầu nhanh bên dưới.</p>
            <div className="wf-canvas-starters">
              <button type="button" onClick={() => onAddNode('image')} disabled={!isEditable}>
                <ImagePlus size={18} />
                <span><strong>Tạo ảnh từ văn bản</strong><small>Thêm node tạo ảnh và bắt đầu với prompt.</small></span>
              </button>
              <button type="button" onClick={() => onAddNode('video')} disabled={!isEditable}>
                <Film size={18} />
                <span><strong>Ảnh thành video</strong><small>Tạo chuyển động từ ảnh tham chiếu.</small></span>
              </button>
              <button type="button" onClick={() => onAddNode('prompt')} disabled={!isEditable}>
                <Copy size={18} />
                <span><strong>Dựng prompt sáng tạo</strong><small>Soạn công thức prompt dùng lại nhiều bước.</small></span>
              </button>
              <button type="button" onClick={() => onAddNode('input')} disabled={!isEditable}>
                <Download size={18} />
                <span><strong>Thêm dữ liệu đầu vào</strong><small>Nhận ảnh, video, liên kết hoặc văn bản.</small></span>
              </button>
            </div>
          </div>
        )}

        <div className="wf-canvas-bottom-controls" aria-label="Điều khiển thu phóng">
          <button type="button" onClick={() => setCanvasZoom(zoom - 0.1)} title="Thu nhỏ"><Minus size={15} /></button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setCanvasZoom(zoom + 0.1)} title="Phóng to"><Plus size={15} /></button>
          <i />
          <button type="button" onClick={() => setCanvasZoom(1)} title="Đặt lại 100%"><Maximize2 size={15} /></button>
        </div>

        {/* 2026-07-27: badge zoom - hien % hien tai + nut reset ve 100%, de tinh nang zoom bang
            con lan chuot khong bi "an" hoan toan (Sep khong biet dang zoom bao nhieu / khong co
            duong quay lai neu cuon lo qua nho/qua to). */}
        <div className="wf-canvas-zoom-indicator wf-canvas-zoom-indicator-legacy" title="Cuộn chuột trên canvas để phóng to/thu nhỏ">
          <span>{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => {
              setCanvasZoom(1)
            }}
            title="Đặt lại zoom 100%"
          >
            <RotateCcw size={12} />
          </button>
        </div>
        <div
          ref={canvasRef}
          className={`wf-canvas${edgeArmMode !== 'idle' ? ' is-arming-edge' : ''}`}
          style={{ width: canvasWidth, height: canvasHeight, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect()
            // Cung ly do voi handleMouseMove keo node ben tren: rect da bi transform:scale anh
            // huong (kich thuoc tren man hinh), phai chia cho zoom de canvasCursor tra ve dung
            // "khong gian mo hinh" ma SVG (viewBox goc canvasWidth/canvasHeight) dang dung.
            setCanvasCursor({ x: (event.clientX - rect.left) / zoomRef.current, y: (event.clientY - rect.top) / zoomRef.current })
          }}
          onMouseLeave={() => setCanvasCursor(null)}
          onClick={(event) => {
            // 2026-08-02: che do "dang dat Ghi chu" - bam vao canvas (khong bam trung node/khung
            // nao) se tao 1 ghi chu ngay tai vi tri do va tu thoat che do dat.
            if (!isPlacingNote || !isEditable) return
            if ((event.target as HTMLElement).closest('.wf-node-card, .wf-frame, .wf-note')) return
            const rect = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - rect.left) / zoomRef.current
            const y = (event.clientY - rect.top) / zoomRef.current
            onPlaceNote(x, y)
          }}
        >
          {frames.map((frame) => {
            const memberNodeIds = nodesInFrame(frame, draftWorkflow.nodes).map((node) => node.id)
            return (
              <div
                key={frame.id}
                className="wf-frame"
                style={{ left: frame.x, top: frame.y, width: frame.width, height: frame.height }}
              >
                <div
                  className="wf-frame-header"
                  onMouseDown={(event) => {
                    if (event.button !== 0 || !isEditable) return
                    if ((event.target as HTMLElement).closest('.wf-frame-header-actions, .wf-frame-rename-input')) return
                    const rect = canvasRef.current?.getBoundingClientRect()
                    if (!rect) return
                    const startX = (event.clientX - rect.left) / zoomRef.current
                    const startY = (event.clientY - rect.top) / zoomRef.current
                    frameDragStateRef.current = {
                      frameId: frame.id,
                      startX,
                      startY,
                      offsetX: event.clientX - rect.left - (startX - frame.x) * zoomRef.current,
                      offsetY: event.clientY - rect.top - (startY - frame.y) * zoomRef.current,
                      memberNodeIds,
                    }
                  }}
                >
                  <GripVertical size={13} className="wf-frame-grip" />
                  {renamingFrameId === frame.id ? (
                    <input
                      className="wf-frame-rename-input"
                      autoFocus
                      defaultValue={frame.label}
                      onMouseDown={(event) => event.stopPropagation()}
                      onBlur={(event) => {
                        onUpdateFrame(frame.id, { label: event.target.value.trim() || frame.label })
                        setRenamingFrameId(null)
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') (event.target as HTMLInputElement).blur()
                        if (event.key === 'Escape') setRenamingFrameId(null)
                      }}
                    />
                  ) : (
                    <span
                      className="wf-frame-label"
                      title="Bấm để đổi tên khung"
                      onClick={(event) => {
                        event.stopPropagation()
                        if (isEditable) setRenamingFrameId(frame.id)
                      }}
                    >
                      {frame.label} · {memberNodeIds.length} node
                    </span>
                  )}
                  <span className="wf-frame-header-actions">
                    <button
                      type="button"
                      title="Lưu node trong khung này thành Preset cục bộ"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSaveFrameAsPreset(frame)
                      }}
                    >
                      <Save size={12} />
                    </button>
                    <button
                      type="button"
                      title="Xóa khung (không xóa node bên trong)"
                      onClick={(event) => {
                        event.stopPropagation()
                        onRemoveFrame(frame.id)
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
                <div
                  className="wf-frame-resize-handle"
                  onMouseDown={(event) => {
                    if (event.button !== 0 || !isEditable) return
                    event.stopPropagation()
                    frameResizeStateRef.current = {
                      frameId: frame.id,
                      startWidth: frame.width,
                      startHeight: frame.height,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                    }
                  }}
                />
              </div>
            )
          })}

          <svg className="wf-canvas-lines" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} preserveAspectRatio="none">
            {draftWorkflow.edges.map((edgeItem) => {
              const source = draftWorkflow.nodes.find((nodeItem) => nodeItem.id === edgeItem.source)
              const target = draftWorkflow.nodes.find((nodeItem) => nodeItem.id === edgeItem.target)
              if (!source || !target) return null
              const x1 = source.x + nodeCardWidth(source.type, source.config.aspect_ratio)
              const y1 = source.y + 48
              const x2 = target.x
              // 2026-08-02: node Anh/Video co 2 cham input rieng (Prompt o 35%, Anh/Video o 65% chieu
              // cao the) - duong noi tra ve dung cham gan voi loai node nguon nhat (node Prompt ->
              // cham tren; con lai (Input/nguon khac hay mang anh tham chieu) -> cham duoi), khop voi
              // vi tri CSS .wf-node-handle-in-prompt/-media trong index.css.
              const targetHeight = nodeCardEstimatedHeight(target.type, target.config.aspect_ratio)
              const isTargetMedia = target.type === 'image' || target.type === 'video'
              const y2 = isTargetMedia
                ? target.y + Math.round(targetHeight * (source.type === 'prompt' ? 0.35 : 0.65))
                : target.y + 48
              const midX = Math.round((x1 + x2) / 2)
              const branchLabel = edgeBranchLabel(edgeItem.branch)
              const edgeSelected = selectedEdgeId === edgeItem.id
              return (
                <g key={edgeItem.id}>
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    className={`wf-edge-path${edgeSelected ? ' is-selected' : ''}`}
                    stroke={
                      edgeItem.branch === 'true'
                        ? 'rgba(34, 197, 94, 0.65)'
                        : edgeItem.branch === 'false'
                          ? 'rgba(239, 68, 68, 0.65)'
                          : 'rgba(99, 102, 241, 0.45)'
                    }
                    strokeWidth={edgeSelected ? '5' : '3'}
                    pointerEvents="stroke"
                    onClick={() => setSelectedEdgeId(edgeItem.id)}
                  />
                  {branchLabel && (
                    <text
                      x={midX}
                      y={Math.round((y1 + y2) / 2) - 8}
                      className="wf-edge-label"
                      fill={edgeItem.branch === 'true' ? '#86efac' : '#fca5a5'}
                      fontSize="12"
                      textAnchor="middle"
                      fontWeight="700"
                      onClick={() => setSelectedEdgeId(edgeItem.id)}
                    >
                      {branchLabel}
                    </text>
                  )}
                </g>
              )
            })}
            {canvasCursor && armedSourceNode && (
              <path
                d={`M ${armedSourceNode.x + nodeCardWidth(armedSourceNode.type, armedSourceNode.config.aspect_ratio)} ${armedSourceNode.y + 48} C ${Math.round((armedSourceNode.x + nodeCardWidth(armedSourceNode.type, armedSourceNode.config.aspect_ratio) + canvasCursor.x) / 2)} ${armedSourceNode.y + 48}, ${Math.round((armedSourceNode.x + nodeCardWidth(armedSourceNode.type, armedSourceNode.config.aspect_ratio) + canvasCursor.x) / 2)} ${canvasCursor.y}, ${canvasCursor.x} ${canvasCursor.y}`}
                fill="none"
                className="wf-edge-path is-preview"
                stroke="rgba(56, 189, 248, 0.85)"
                strokeWidth={2.5}
                strokeDasharray="8 6"
              />
            )}
            {canvasCursor && armedTargetNode && (
              <path
                d={`M ${canvasCursor.x} ${canvasCursor.y} C ${Math.round((canvasCursor.x + armedTargetNode.x) / 2)} ${canvasCursor.y}, ${Math.round((canvasCursor.x + armedTargetNode.x) / 2)} ${armedTargetNode.y + 48}, ${armedTargetNode.x} ${armedTargetNode.y + 48}`}
                fill="none"
                className="wf-edge-path is-preview"
                stroke="rgba(52, 211, 153, 0.85)"
                strokeWidth={2.5}
                strokeDasharray="8 6"
              />
            )}
          </svg>

          {draftWorkflow.nodes.map((nodeItem) => {
            const componentInfo = componentCanvasInfoByNodeId.get(nodeItem.id)
            const componentInputPreview = componentInfo?.inputs.slice(0, 4) || []
            const componentOutputPreview = componentInfo?.outputs.slice(0, 3) || []

            const selectQuickEdgeSource = (event: MouseEvent, nodeId: string) => {
              event.stopPropagation()
              event.preventDefault()
              setSelectedNodeId(nodeId)
              setSelectedEdgeId(null)
              setEdgeSourceId(nodeId)
              setEdgeArmMode('source')
              if (!edgeTargetId || edgeTargetId === nodeId) {
                const fallbackTarget = draftWorkflow.nodes.find((node) => node.id !== nodeId)?.id ?? nodeId
                setEdgeTargetId(fallbackTarget)
              }
            }

            const selectQuickEdgeTarget = (event: MouseEvent, nodeId: string) => {
              event.stopPropagation()
              event.preventDefault()
              setSelectedNodeId(nodeId)
              setSelectedEdgeId(null)
              setEdgeTargetId(nodeId)
              setEdgeArmMode('target')
              if (!edgeSourceId || edgeSourceId === nodeId) {
                const fallbackSource = draftWorkflow.nodes.find((node) => node.id !== nodeId)?.id ?? nodeId
                setEdgeSourceId(fallbackSource)
              }
            }

            const inlineEditableKey = primaryInlineEditableKey(nodeItem.type)
            const isInlineExpanded =
              !isFullModalOpen && inlineEditableKey !== null && expandedFieldNodeId === nodeItem.id
            const isMediaOutputNode = nodeItem.type === 'image' || nodeItem.type === 'video'
            const cardWidth = nodeCardWidth(nodeItem.type, nodeItem.config.aspect_ratio)
            const isRenamingThisNode = renamingNodeId === nodeItem.id

            return (
              // 2026-07-26g: doi tu <button> sang <div role="button"> vi node can chua <textarea> nhap
              // noi dung inline khi bung ra - HTML khong cho phep long phan tu tuong tac (textarea/input)
              // ben trong <button>, trinh duyet se tu dong "vo hieu hoa"/di chuyen no ra ngoai va gay loi
              // focus/go chu. Van giu day du hanh vi chon/keo tha nhu truoc, chi doi the.
              <div
                key={nodeItem.id}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    if ((event.target as HTMLElement).closest('.wf-node-inline-editor')) return
                    event.preventDefault()
                    setSelectedNodeId(nodeItem.id)
                  }
                }}
                className={`wf-node-card${selectedNodeId === nodeItem.id ? ' active' : ''}${
                  edgeArmMode === 'source' && edgeSourceId === nodeItem.id ? ' is-edge-source' : ''
                }${
                  edgeArmMode === 'target' && edgeTargetId === nodeItem.id ? ' is-edge-target' : ''
                }${
                  selectedTraceNodeId === nodeItem.id ? ' is-trace-selected' : ''
                }${selectedRunTraceStatusByNodeId.get(nodeItem.id) === 'success' ? ' has-trace-success' : ''}${
                  componentInfo ? ' is-component-block' : ''
                }${componentInfo && nodeItem.type === 'for_each' ? ' is-component-batch' : ''}${nodeItem.locked ? ' is-locked' : ''}${
                  isMediaOutputNode ? ' is-media-output' : ''
                }`}
                style={{ left: nodeItem.x, top: nodeItem.y, borderColor: nodeTypeColors[nodeItem.type], width: cardWidth }}
                onContextMenu={(event) => {
                  if (!['input', 'prompt', 'image', 'video', 'output'].includes(nodeItem.type)) return
                  event.preventDefault()
                  event.stopPropagation()
                  setSelectedNodeId(nodeItem.id)
                  setContextMenu({ nodeId: nodeItem.id, x: event.clientX, y: event.clientY })
                }}
                onMouseDown={(event) => {
                  if (event.button !== 0) return
                  if (!isEditable) return
                  if (nodeItem.locked) return
                  if ((event.target as HTMLElement).closest('.wf-node-handle, .wf-node-component-port')) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  // 2026-07-26L: snapshot "Hoan tac" 1 lan luc BAT DAU keo (khong phai moi pixel di
                  // chuyen - moveNodeTo goi lien tuc trong lang nghe mousemove ben duoi).
                  onBeginNodeDrag()
                  dragStateRef.current = {
                    nodeId: nodeItem.id,
                    offsetX: event.clientX - rect.left,
                    offsetY: event.clientY - rect.top,
                    moved: false,
                  }
                }}
                onMouseUp={() => {
                  if (isEditable && edgeArmMode === 'source' && edgeSourceId && edgeSourceId !== nodeItem.id) {
                    appendEdge(edgeSourceId, nodeItem.id)
                    return
                  }
                  if (isEditable && edgeArmMode === 'target' && edgeTargetId && edgeTargetId !== nodeItem.id) {
                    appendEdge(nodeItem.id, edgeTargetId)
                  }
                }}
                onClick={() => {
                  if (suppressClickNodeIdRef.current === nodeItem.id) {
                    suppressClickNodeIdRef.current = null
                    return
                  }
                  if (isEditable && edgeArmMode === 'source' && edgeSourceId && edgeSourceId !== nodeItem.id) {
                    appendEdge(edgeSourceId, nodeItem.id)
                    return
                  }
                  if (isEditable && edgeArmMode === 'target' && edgeTargetId && edgeTargetId !== nodeItem.id) {
                    appendEdge(nodeItem.id, edgeTargetId)
                    return
                  }
                  setSelectedNodeId(nodeItem.id)
                  setEdgeArmMode('idle')
                  if (selectedRunTraceStatusByNodeId.has(nodeItem.id)) setSelectedTraceNodeId(nodeItem.id)
                }}
              >
                {/* 2026-08-02: Sep phan anh 2 mui ten (tu node Input va tu node Prompt) cung do vao
                    DUNG 1 cham input tren node Anh/Video, nhin roi mat kho biet dau la nguon nao.
                    Backend chay bang context/state DUNG CHUNG cho ca workflow (khong doc theo tung
                    "port" rieng cua edge - xem build_template_context/apply_state_assignments trong
                    main.py), nen ve mat KY THUAT 1 cham hay 2 cham deu chay dung nhu nhau - day la
                    thay doi THI GIAC de de phan biet, khong doi logic thuc thi. Node Anh/Video gio co
                    2 cham input tach rieng vi tri: 1 cho luong "Prompt", 1 cho luong "Ảnh/Video tham
                    chiếu" - node khac van giu nguyen 1 cham nhu cu. */}
                {isMediaOutputNode ? (
                  <>
                    <span
                      className={`wf-node-handle wf-node-handle-in wf-node-handle-in-prompt${edgeArmMode === 'target' && edgeTargetId === nodeItem.id ? ' active' : ''}`}
                      onMouseDown={(event) => selectQuickEdgeTarget(event, nodeItem.id)}
                      onMouseUp={(event) => {
                        event.stopPropagation()
                        if (isEditable && edgeArmMode === 'source' && edgeSourceId && edgeSourceId !== nodeItem.id) {
                          appendEdge(edgeSourceId, nodeItem.id)
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                      title={`Đặt "${nodeItem.label}" làm đích — luồng Prompt`}
                    />
                    <span
                      className={`wf-node-handle wf-node-handle-in wf-node-handle-in-media${edgeArmMode === 'target' && edgeTargetId === nodeItem.id ? ' active' : ''}`}
                      onMouseDown={(event) => selectQuickEdgeTarget(event, nodeItem.id)}
                      onMouseUp={(event) => {
                        event.stopPropagation()
                        if (isEditable && edgeArmMode === 'source' && edgeSourceId && edgeSourceId !== nodeItem.id) {
                          appendEdge(edgeSourceId, nodeItem.id)
                        }
                      }}
                      onClick={(event) => event.stopPropagation()}
                      title={`Đặt "${nodeItem.label}" làm đích — luồng Ảnh/Video tham chiếu`}
                    />
                  </>
                ) : (
                  <span
                    className={`wf-node-handle wf-node-handle-in${edgeArmMode === 'target' && edgeTargetId === nodeItem.id ? ' active' : ''}`}
                    onMouseDown={(event) => selectQuickEdgeTarget(event, nodeItem.id)}
                    onMouseUp={(event) => {
                      event.stopPropagation()
                      if (isEditable && edgeArmMode === 'source' && edgeSourceId && edgeSourceId !== nodeItem.id) {
                        appendEdge(edgeSourceId, nodeItem.id)
                      }
                    }}
                    onClick={(event) => event.stopPropagation()}
                    title={`Đặt "${nodeItem.label}" làm đích`}
                  />
                )}
                <span
                  className={`wf-node-handle wf-node-handle-out${edgeArmMode === 'source' && edgeSourceId === nodeItem.id ? ' active' : ''}`}
                  onMouseDown={(event) => selectQuickEdgeSource(event, nodeItem.id)}
                  onMouseUp={(event) => {
                    event.stopPropagation()
                    if (isEditable && edgeArmMode === 'target' && edgeTargetId && edgeTargetId !== nodeItem.id) {
                      appendEdge(nodeItem.id, edgeTargetId)
                    }
                  }}
                  onClick={(event) => event.stopPropagation()}
                  title={`Đặt "${nodeItem.label}" làm nguồn`}
                />
                <div className="wf-node-card-head">
                  <span className="wf-node-pill" style={{ background: `${nodeTypeColors[nodeItem.type]}20`, color: nodeTypeColors[nodeItem.type] }}>
                    {nodeIcon(nodeItem.type)}
                    {nodeItem.type}
                  </span>
                  {isMediaOutputNode && (
                    isRenamingThisNode ? (
                      <input
                        className="wf-inline-rename-input"
                        value={renamingNodeLabel}
                        autoFocus
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => setRenamingNodeLabel(event.target.value)}
                        onBlur={() => commitNodeRename(nodeItem)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitNodeRename(nodeItem)
                          } else if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelNodeRename()
                          }
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Đổi tên ${nodeItem.label}`}
                      />
                    ) : (
                      <span className="wf-node-media-title">{nodeItem.label}</span>
                    )
                  )}
                  {componentInfo && (
                    <span className="wf-node-component-badge">
                      {nodeItem.type === 'for_each' ? 'Component batch' : 'Component'}
                    </span>
                  )}
                  {/* 2026-07-26L: badge khoa - bao Sep biet node nay dang khong keo/sua duoc. */}
                  {nodeItem.locked && (
                    <span className="wf-node-lock-badge" title="Node đang bị khóa — bấm nút Khóa ở toolbar để mở">
                      <Lock size={11} />
                    </span>
                  )}
                  {/* 2026-07-28: node Anh/Video khong noi ra dau (leaf) = tu dong la diem cuoi
                      workflow, khong can node Dau ra rieng nua - bao ngay tren canvas cho de thay. */}
                  {(nodeItem.type === 'image' || nodeItem.type === 'video') &&
                    !draftWorkflow.edges.some((edgeItem) => edgeItem.source === nodeItem.id) && (
                      <span className="wf-node-leaf-output-badge" title="Node này tự động là điểm kết thúc workflow — không cần thêm node Đầu ra riêng">
                        <Check size={11} />
                        Điểm cuối
                      </span>
                    )}
                  {nodeItem.type === 'prompt' && inlineEditableKey && (
                    <button
                      type="button"
                      className="wf-node-head-expand"
                      title="Mở khung nhập prompt lớn"
                      aria-label={`Mở rộng ${nodeItem.label}`}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                      }}
                      onClick={(event) => {
                        event.stopPropagation()
                        openFullEditor(nodeItem, inlineEditableKey)
                      }}
                    >
                      <Maximize2 size={13} />
                    </button>
                  )}
                </div>
                {!isMediaOutputNode && (
                  isRenamingThisNode ? (
                    <input
                      className="wf-inline-rename-input"
                      value={renamingNodeLabel}
                      autoFocus
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => setRenamingNodeLabel(event.target.value)}
                      onBlur={() => commitNodeRename(nodeItem)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitNodeRename(nodeItem)
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          cancelNodeRename()
                        }
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Đổi tên ${nodeItem.label}`}
                    />
                  ) : (
                    <strong>{nodeItem.label}</strong>
                  )
                )}
                {!isMediaOutputNode && <p>{nodeItem.description}</p>}

                {(nodeItem.type === 'image' || nodeItem.type === 'video') && (
                  <WorkflowHubNodeMediaPanel
                    node={nodeItem}
                    isEditable={isEditable}
                    onUpdateConfig={(patch) => updateMediaNodeConfig(nodeItem, patch)}
                    latestOutputUrl={latestOutputByNodeId.get(nodeItem.id)?.url}
                    latestOutputType={latestOutputByNodeId.get(nodeItem.id)?.type}
                  />
                )}

                {(nodeItem.type === 'tts' || nodeItem.type === 'lipsync') && (
                  <WorkflowHubNodeAudioPanel
                    node={nodeItem}
                    isEditable={isEditable}
                    onUpdateConfig={(patch) => updateMediaNodeConfig(nodeItem, patch)}
                  />
                )}

                {inlineEditableKey && (
                  <div
                    className={`wf-node-inline-editor${isInlineExpanded ? ' is-expanded' : ''}`}
                    onMouseDown={(event) => event.stopPropagation()}
                    onMouseUp={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {isInlineExpanded ? (
                      <>
                        <div className="wf-node-inline-toolbar">
                          <span className="wf-node-inline-label">{inlineEditorLabel(nodeItem.type)}</span>
                          <span className="wf-node-inline-toolbar-actions">
                            {/* 2026-07-26i: mo rong toan man hinh - danh cho prompt/noi dung dai, xem
                                het duoc tong the de biet cho nao sai can sua (Sep yeu cau rieng). */}
                            <button
                              type="button"
                              className="wf-node-inline-expand"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                setIsFullModalOpen(true)
                              }}
                              title="Mở rộng toàn màn hình"
                            >
                              <Maximize2 size={12} /> Mở rộng
                            </button>
                            <button
                              type="button"
                              className="wf-node-inline-save"
                              disabled={!isEditable}
                              // mousedown + preventDefault chay TRUOC khi textarea bi blur, nen giu duoc
                              // focus va tranh onBlur (luu) chay truoc roi moi toi luot nut nay - luu dung
                              // 1 lan, khong xung dot voi hanh vi blur-tu-luu ben duoi.
                              onMouseDown={(event) => {
                                event.preventDefault()
                                commitInlineEdit(nodeItem, inlineEditableKey)
                              }}
                              title="Lưu nội dung"
                            >
                              <Check size={12} /> Lưu
                            </button>
                            <button
                              type="button"
                              className="wf-node-inline-close"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                discardInlineEdit()
                              }}
                              title="Đóng, không lưu thay đổi"
                            >
                              <X size={12} /> Đóng
                            </button>
                          </span>
                        </div>
                        <textarea
                          className="wf-node-inline-textarea"
                          autoFocus
                          disabled={!isEditable}
                          value={inlineDraftValue}
                          placeholder={inlineEditorPlaceholder(nodeItem.type)}
                          onFocus={(event) => event.currentTarget.select()}
                          onChange={(event) => setInlineDraftValue(event.target.value)}
                          onBlur={() => commitInlineEdit(nodeItem, inlineEditableKey)}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              event.preventDefault()
                              discardInlineEdit()
                            }
                          }}
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        className="wf-node-inline-preview"
                        disabled={!isEditable}
                        onClick={() => openInlineEditor(nodeItem, inlineEditableKey)}
                      >
                        <span className="wf-node-inline-label">{inlineEditorLabel(nodeItem.type)}</span>
                        <span className="wf-node-inline-value">
                          {nodeItem.config[inlineEditableKey] || inlineEditorPlaceholder(nodeItem.type)}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {nodeItem.type === 'input' && (() => {
                  const declaredFields = String(nodeItem.config.fields || '')
                    .split(',')
                    .map((field) => field.trim())
                    .filter(Boolean)
                  const uploadableDeclaredFields = declaredFields.filter((field) => isUploadableField(field))
                  if (uploadableDeclaredFields.length === 0) return null
                  return (
                    <div
                      className="wf-node-input-uploads"
                      onMouseDown={(event) => event.stopPropagation()}
                      onMouseUp={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {uploadableDeclaredFields.map((field) => {
                        const fieldKey = `${nodeItem.id}:${field}`
                        const fieldUrl = nodeItem.config[field] || ''
                        const isUploadingThis = uploadingFieldKey === fieldKey
                        return (
                          <div key={field} className="wf-node-input-upload-row">
                            <span className="wf-node-input-upload-label">
                              {uploadLabelForField(field)} ({field})
                            </span>
                            {fieldUrl ? (
                              <div className="wf-node-media-ref-preview">
                                {uploadKindForField(field) === 'video' ? (
                                  <video src={fieldUrl} controls />
                                ) : (
                                  <img src={fieldUrl} alt={field} />
                                )}
                                {isEditable && (
                                  <button
                                    type="button"
                                    onClick={() => updateDraftNode(nodeItem.id, { config: { ...nodeItem.config, [field]: '' } })}
                                    aria-label={`Xóa ${field}`}
                                  >
                                    <X size={11} />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="wf-node-input-upload-actions">
                                <label className="wf-node-media-upload-btn">
                                  {isUploadingThis ? <Loader2 size={12} className="wf-spin" /> : <ImagePlus size={12} />}
                                  {isUploadingThis ? 'Đang tải...' : uploadLabelForField(field)}
                                  <input
                                    type="file"
                                    accept={fileAcceptForField(field)}
                                    className="wf-hidden-file-input"
                                    disabled={!isEditable || isUploadingThis}
                                    onChange={(event) => {
                                      void handleNodeFieldUpload(nodeItem, field, event.target.files?.[0] ?? null)
                                      event.target.value = ''
                                    }}
                                  />
                                </label>
                                {isEditable && (
                                  <WorkflowHubAssetPickerPopover
                                    kind={uploadKindForField(field) === 'video' ? 'video' : 'image'}
                                    onSelect={(asset) => {
                                      updateDraftNode(nodeItem.id, { config: { ...nodeItem.config, [field]: asset.url } })
                                      setRunInputValues((current) => ({ ...current, [field]: asset.url }))
                                    }}
                                  />
                                )}
                              </span>
                            )}
                            {uploadFieldError?.key === fieldKey && (
                              <p className="wf-copilot-chat-error">{uploadFieldError.message}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}

                {componentInfo && (
                  <div className="wf-node-component-meta">
                    <small>{componentInfo.workflow.componentName || componentInfo.workflow.name}</small>
                    <div className="wf-node-component-ports">
                      <div className="wf-node-component-port-group">
                        <span>IN</span>
                        <div className="wf-node-component-port-list">
                          {componentInputPreview.length > 0 ? (
                            componentInputPreview.map((field) => (
                              <em
                                key={`${nodeItem.id}-in-${field}`}
                                className={`wf-node-component-port is-clickable${edgeTargetId === nodeItem.id ? ' is-arm-target' : ''}`}
                                onMouseDown={(event) => selectQuickEdgeTarget(event, nodeItem.id)}
                                onClick={(event) => event.stopPropagation()}
                                title={`Đặt "${nodeItem.label}" làm đích cho edge mới`}
                              >
                                {field}
                              </em>
                            ))
                          ) : (
                            <em className="wf-node-component-port muted">auto</em>
                          )}
                        </div>
                      </div>
                      <div className="wf-node-component-port-group">
                        <span>OUT</span>
                        <div className="wf-node-component-port-list">
                          {componentOutputPreview.length > 0 ? (
                            componentOutputPreview.map(([field]) => (
                              <em
                                key={`${nodeItem.id}-out-${field}`}
                                className={`wf-node-component-port is-clickable${edgeSourceId === nodeItem.id ? ' is-arm-source' : ''}`}
                                onMouseDown={(event) => selectQuickEdgeSource(event, nodeItem.id)}
                                onClick={(event) => event.stopPropagation()}
                                title={`Đặt "${nodeItem.label}" làm nguồn cho edge mới`}
                              >
                                {field}
                              </em>
                            ))
                          ) : (
                            <em className="wf-node-component-port muted">none</em>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {notes.map((note) => (
            <div
              key={note.id}
              className="wf-note"
              style={{ left: note.x, top: note.y }}
              onMouseDown={(event) => {
                if (event.button !== 0 || !isEditable) return
                if ((event.target as HTMLElement).closest('.wf-note-text, .wf-note-remove')) return
                const rect = canvasRef.current?.getBoundingClientRect()
                if (!rect) return
                const offsetX = event.clientX - rect.left - note.x * zoomRef.current
                const offsetY = event.clientY - rect.top - note.y * zoomRef.current
                const handleMove = (moveEvent: globalThis.MouseEvent) => {
                  const nextX = (moveEvent.clientX - rect.left - offsetX) / zoomRef.current
                  const nextY = (moveEvent.clientY - rect.top - offsetY) / zoomRef.current
                  onUpdateNote(note.id, { x: nextX, y: nextY })
                }
                const handleUp = () => {
                  window.removeEventListener('mousemove', handleMove)
                  window.removeEventListener('mouseup', handleUp)
                }
                window.addEventListener('mousemove', handleMove)
                window.addEventListener('mouseup', handleUp)
              }}
            >
              <button
                type="button"
                className="wf-note-remove"
                title="Xóa ghi chú"
                onClick={() => onRemoveNote(note.id)}
              >
                <X size={11} />
              </button>
              <textarea
                className="wf-note-text"
                placeholder="Ghi chú..."
                defaultValue={note.text}
                disabled={!isEditable}
                onMouseDown={(event) => event.stopPropagation()}
                onBlur={(event) => onUpdateNote(note.id, { text: event.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
