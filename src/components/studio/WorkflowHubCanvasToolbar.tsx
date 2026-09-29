import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Frame,
  Grid3x3,
  LayoutGrid,
  LoaderCircle,
  Lock,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  PlaySquare,
  Plus,
  Save,
  Undo2,
  Unlock,
} from 'lucide-react'
import type { WorkflowDefinition, WorkflowNodeType } from '../../lib/workflows'
import { WorkflowHubNodeQuickAdd } from './WorkflowHubNodeQuickAdd'
import type { NodeLibraryItem } from './workflowHubUtils'

type EdgeArmMode = 'idle' | 'source' | 'target'

type WorkflowHubCanvasToolbarProps = {
  draftWorkflow: WorkflowDefinition
  mediaLabel: (media: WorkflowDefinition['media']) => string
  workflowValidationErrorsCount: number
  workflowValidationWarningsCount: number
  syncing: boolean
  edgeArmMode: EdgeArmMode
  armedSourceLabel: string | null
  armedTargetLabel: string | null
  isEditable: boolean
  onCancelEdgeArm: () => void
  saveWorkflowDraft: () => void | Promise<void>
  isDirty: boolean
  isSaving: boolean
  // 2026-07-26k: nut "+ Them node" doi tu absolute noi tren wf-canvas-wrap (mục 16/17) sang nam
  // THAT trong hang nut cua toolbar nay - ly do: khi noi rieng, nut bi de len dung vi tri nut
  // "Luu thay doi" (ca 2 cung neo goc tren-phai cua cung 1 khung wf-canvas-wrap) khien Sep khong
  // thay/khong bam duoc nut them node. Dua vao day de nut nam trong flex-row binh thuong, khong
  // bao gio de len nhau nua, va popover neo dung duoi nut bang position:relative cua wrapper thay
  // vi doan-mo (guess) khoang cach tu vien man hinh nhu truoc.
  nodeLibraryItems: NodeLibraryItem[]
  onAddNode: (type: WorkflowNodeType) => void
  isNodeQuickAddOpen: boolean
  onOpenNodeQuickAdd: () => void
  onCloseNodeQuickAdd: () => void
  // 2026-07-26L: 4 nut moi lay cam hung tu thanh cong cu ben trai cua app tham khao (Khoa/Sap xep/
  // Hoan tac/Luoi) - nhung dat chung vao hang toolbar co san nay (khong dung mo them 1 thanh doc
  // rieng ben trai) vi popover "+ Them node" vua sua xong loi de nut o day, giu moi thu 1 cho cho de
  // kiem soat, dung tinh than "gon" Sep yeu cau thay vi rai nut khap noi.
  showGrid: boolean
  onToggleGrid: () => void
  canUndo: boolean
  onUndo: () => void
  onAutoArrange: () => void
  isNodeSelected: boolean
  isSelectedNodeLocked: boolean
  onToggleLock: () => void
  // 2026-07-27: nut mo rong canvas - an/hien 2 panel trai (thu vien node) va phai (trinh chinh
  // node) de canvas duoc rong ra toi da khi Sep can xem/keo nhieu node cung luc. Dat NGOAI khoi
  // isEditable vi day la tuy chinh CACH XEM, khong phai hanh dong sua workflow - phai hoat dong
  // ca khi dang xem template (chua Nhan ban, isEditable=false).
  isPaletteCollapsed: boolean
  onTogglePalette: () => void
  // 2026-07-30: Sep phan anh giao dien qua nhieu chi tiet so voi app tham khao - da doi mac dinh
  // an ca 2 panel trai/phai (xem WorkflowHub.tsx). Nut "Chay workflow" (truoc gio chi nam trong
  // panel Chay workflow o sidebar trai) can 1 ban LUON HIEN o day, ngoai panel, de khong mat kha
  // nang chay workflow khi panel dang dong - dung tinh than nut "Chay tat ca" luon noi cua app
  // tham khao. Goi thang runWorkflowAction co san (WorkflowHub.tsx), khong tao luong chay moi.
  runWorkflowAction: () => void | Promise<void>
  isRunning: boolean
  // 2026-08-02: 2 nut moi tham khao toolbar Comfy Cloud - "Thêm khung" (gom node de di chuyen/luu
  // mau) va "Ghi chú" (dat ghi chu tu do tren canvas).
  onAddFrame: () => void
  isPlacingNote: boolean
  onToggleNotePlacement: () => void
}

export function WorkflowHubCanvasToolbar({
  draftWorkflow,
  mediaLabel,
  workflowValidationErrorsCount,
  workflowValidationWarningsCount,
  syncing,
  edgeArmMode,
  armedSourceLabel,
  armedTargetLabel,
  isEditable,
  onCancelEdgeArm,
  saveWorkflowDraft,
  isDirty,
  isSaving,
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
  isNodeSelected,
  isSelectedNodeLocked,
  onToggleLock,
  isPaletteCollapsed,
  onTogglePalette,
  runWorkflowAction,
  isRunning,
  onAddFrame,
  isPlacingNote,
  onToggleNotePlacement,
}: WorkflowHubCanvasToolbarProps) {
  // 2026-07-27c: BUG THAT tim ra khi verify tinh nang zoom bang Playwright (khong lien quan zoom) -
  // popover "+ Them node" tu truoc gio thuc ra KHONG chon duoc loai node nao ca. Da thu isolation:
  // isolate + doi z-index (600->-1, 601->99999) deu khong an thua - do dac bang
  // document.elementFromPoint() cho thay: dau tien .wf-node-quickadd-backdrop (position:fixed) luon
  // thoat khoi local stacking context de so sanh o cap ROOT; sau khi bo backdrop, toi luot
  // .wf-palette (sidebar trai, overflow:hidden auto, o CUNG cap voi .wf-canvas-wrap trong
  // .wf-editor-layout) van "de len" panel vi ca 2 deu z-index:auto va khong to tien nao giua chung
  // thiet lap stacking context that su - panel (position:absolute long trong nhieu lop div long
  // nhau) khong the thoat ra de canh tranh z-index cong bang voi 1 sibling o cap cao hon. Fix dung
  // (tranh hoan toan moi van de stacking context): dung React Portal (createPortal) de-render han
  // panel ra ngoai <body>, tinh vi tri bang getBoundingClientRect() cua nut "+ Them node", roi dinh
  // position:fixed dua tren toa do do - panel gio khong con la con chau cua bat ky khung bi
  // clip/che nao nua nen khong the bi "de len" duoc.
  const addNodeWrapRef = useRef<HTMLDivElement | null>(null)
  const addNodePanelRef = useRef<HTMLDivElement | null>(null)
  const [addNodePopoverPos, setAddNodePopoverPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!isNodeQuickAddOpen) {
      setAddNodePopoverPos(null)
      return
    }
    const rect = addNodeWrapRef.current?.getBoundingClientRect()
    if (rect) {
      setAddNodePopoverPos({ top: rect.bottom + 8, left: Math.max(12, rect.right - 320) })
    }
  }, [isNodeQuickAddOpen])

  useEffect(() => {
    if (!isNodeQuickAddOpen) return
    const handleOutsideMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (addNodeWrapRef.current?.contains(target)) return
      if (addNodePanelRef.current?.contains(target)) return
      onCloseNodeQuickAdd()
    }
    document.addEventListener('mousedown', handleOutsideMouseDown)
    return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
  }, [isNodeQuickAddOpen, onCloseNodeQuickAdd])

  return (
    <div className="wf-canvas-toolbar">
      <div className="wf-canvas-toolbar-meta">
        <button
          type="button"
          className={`wf-canvas-toolbar-icon-btn${isPaletteCollapsed ? ' active' : ''}`}
          onClick={onTogglePalette}
          title={isPaletteCollapsed ? 'Hiện lại panel Thư viện node bên trái' : 'Ẩn panel bên trái để canvas rộng hơn'}
        >
          {isPaletteCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <span>{mediaLabel(draftWorkflow.media)}</span>
        <span>{draftWorkflow.nodes.length} node</span>
        <span>{draftWorkflow.edges.length} liên kết</span>
        <span className={`wf-mini-badge${workflowValidationErrorsCount > 0 ? ' is-error' : ''}`}>
          {workflowValidationErrorsCount} lỗi
        </span>
        <span className={`wf-mini-badge${workflowValidationWarningsCount > 0 ? ' is-warning' : ''}`}>
          {workflowValidationWarningsCount} cảnh báo
        </span>
        {syncing && <span>Đang đồng bộ...</span>}
        {edgeArmMode !== 'idle' && (
          <span className="wf-mini-badge is-active">
            {edgeArmMode === 'source'
              ? `Đang nối từ ${armedSourceLabel || 'node nguồn'}`
              : `Đang nối tới ${armedTargetLabel || 'node đích'}`}
          </span>
        )}
      </div>
      <button
        type="button"
        className="wf-primary-btn wf-canvas-toolbar-run-btn"
        onClick={() => void runWorkflowAction()}
        disabled={isRunning || workflowValidationErrorsCount > 0}
        title="Chạy toàn bộ workflow"
      >
        {isRunning ? <LoaderCircle size={14} className="spin" /> : <PlaySquare size={14} />}
        Chạy tất cả
      </button>
      {isEditable && (
        <div className="wf-canvas-toolbar-actions">
          <div className="wf-canvas-add-node-wrap" ref={addNodeWrapRef}>
            <button type="button" className="wf-secondary-btn" onClick={onOpenNodeQuickAdd} title="Thêm node mới vào canvas">
              <Plus size={14} />
              Thêm node
            </button>
            {isNodeQuickAddOpen &&
              addNodePopoverPos &&
              createPortal(
                <div
                  ref={addNodePanelRef}
                  className="wf-node-quickadd-panel wf-node-quickadd-panel-portal"
                  style={{ position: 'fixed', top: addNodePopoverPos.top, left: addNodePopoverPos.left }}
                >
                  <WorkflowHubNodeQuickAdd
                    items={nodeLibraryItems}
                    isEditable={isEditable}
                    onAddNode={onAddNode}
                    variant="popover"
                    onRequestClose={onCloseNodeQuickAdd}
                  />
                </div>,
                document.body,
              )}
          </div>
          <button
            type="button"
            className={`wf-canvas-toolbar-icon-btn${isSelectedNodeLocked ? ' active' : ''}`}
            onClick={onToggleLock}
            disabled={!isNodeSelected}
            title={isNodeSelected ? (isSelectedNodeLocked ? 'Mở khóa node đang chọn' : 'Khóa node đang chọn') : 'Chọn 1 node để khóa'}
          >
            {isSelectedNodeLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button
            type="button"
            className="wf-canvas-toolbar-icon-btn"
            onClick={onAutoArrange}
            disabled={draftWorkflow.nodes.length === 0}
            title="Tự động sắp xếp lại vị trí các node"
          >
            <LayoutGrid size={14} />
          </button>
          <button
            type="button"
            className="wf-canvas-toolbar-icon-btn"
            onClick={onUndo}
            disabled={!canUndo}
            title="Hoàn tác thay đổi gần nhất"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            className={`wf-canvas-toolbar-icon-btn${showGrid ? ' active' : ''}`}
            onClick={onToggleGrid}
            title={showGrid ? 'Ẩn lưới canvas' : 'Hiện lưới canvas'}
          >
            <Grid3x3 size={14} />
          </button>
          <button
            type="button"
            className="wf-canvas-toolbar-icon-btn"
            onClick={onAddFrame}
            title="Thêm khung — gom node lại để di chuyển và lưu thành mẫu"
          >
            <Frame size={14} />
          </button>
          <button
            type="button"
            className={`wf-canvas-toolbar-icon-btn${isPlacingNote ? ' active' : ''}`}
            onClick={onToggleNotePlacement}
            title={isPlacingNote ? 'Đang chờ bấm vào canvas để đặt ghi chú (bấm lại để hủy)' : 'Thêm ghi chú — bấm rồi chọn vị trí trên canvas'}
          >
            <MessageSquarePlus size={14} />
          </button>
          {edgeArmMode !== 'idle' && (
            <button type="button" className="wf-secondary-btn" onClick={onCancelEdgeArm}>
              Hủy nối
            </button>
          )}
          <button
            type="button"
            className="wf-secondary-btn"
            onClick={() => void saveWorkflowDraft()}
            disabled={!isDirty || isSaving || workflowValidationErrorsCount > 0}
          >
            {isSaving ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}
            {isSaving ? 'Đang lưu...' : isDirty ? 'Lưu thay đổi' : 'Đã lưu'}
          </button>
        </div>
      )}
    </div>
  )
}
