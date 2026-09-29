import { useEffect, useMemo, useRef, useState } from 'react'
import { generateId } from '../../lib/uuid'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CirclePlus,
  Copy,
  Download,
  FolderTree,
  Globe,
  LoaderCircle,
  Pencil,
  PlaySquare,
  Trash2,
} from 'lucide-react'
import {
  DEFAULT_WORKFLOW_FOLDER_ID,
  duplicateNodeAsTemplate,
  instantiateWorkflowBlock,
  TEMPLATE_WORKFLOW_FOLDER_ID,
  validateWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowBlockTemplate,
  type WorkflowEdge,
  type WorkflowEdgeBranch,
  type WorkflowNodeType,
  WORKFLOW_BLOCK_LIBRARY,
  WORKFLOW_NODE_LIBRARY,
} from '../../lib/workflows'
import {
  cloneWorkflow,
  createWorkflow,
  createWorkflowFolder,
  deleteWorkflow,
  deleteWorkflowFolder,
  renameWorkflowFolder,
  restoreWorkflowVersion,
  preflightWorkflow,
  runWorkflow,
  updateWorkflow,
} from '../../lib/workflowApi'
import {
  buildWorkflowDefinitionFromWizardPreset,
  COMPONENT_INPUT_FIELD_PRESETS,
  COMPONENT_OUTPUT_SCHEMA_PRESETS,
  STARTER_COLLECTIONS,
  WORKFLOW_WIZARD_PRESETS,
  type WorkflowWizardPreset,
} from './workflowHubPresets'
import {
  buildSuggestedSubflowConfig,
  parseComponentInputSchema,
  parseComponentOutputSchema,
  workflowExportFilename,
  workflowPackageFilename,
} from './workflowHubData'
import {
  isWorkflowFailHigh,
  isWorkflowLowUse,
  isWorkflowSlow,
  isWorkflowStale,
  workflowHealthBadges,
  workflowSuccessRate,
} from './workflowHubAnalytics'
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  NODE_TYPE_COLORS,
  clampPosition,
  defaultRunFieldValue,
  errorMessage,
  formatDurationMs,
  inputFieldLabel,
  inputFieldPlaceholder,
  inputFieldHint,
  isLongTextField,
  mediaLabel,
  mergeWorkflowTags,
  nextConditionBranch,
  nodeCardEstimatedHeight,
  nodeCardWidth,
  nodeIcon,
  nodesInFrame,
  prettyJson,
  previewWorkflowMetadataEntries,
  relativeTime,
  statusClass,
  statusLabel,
  stringifyWorkflowTags,
  validationIssueLines,
} from './workflowHubUtils'
import { inferComponentInputSchema, inferComponentOutputSchema, stringifyComponentInputSchema, stringifyComponentOutputSchema } from './workflowHubData'
import {
  useWorkflowHubLibraryData,
  type WorkflowLibraryFilter,
  type WorkflowSortMode,
} from './useWorkflowHubLibraryData'
import { useWorkflowHubEditorData } from './useWorkflowHubEditorData'
import { useWorkflowHubEditorMutations } from './useWorkflowHubEditorMutations'
import { useWorkflowHubCrudActions } from './useWorkflowHubCrudActions'
import { useWorkflowHubCollectionActions } from './useWorkflowHubCollectionActions'
import { useWorkflowHubTransferActions } from './useWorkflowHubTransferActions'
import { useWorkflowHubCanvasActions } from './useWorkflowHubCanvasActions'
import { useWorkflowHubRunActions } from './useWorkflowHubRunActions'
import { useWorkflowHubRunState } from './useWorkflowHubRunState'
import { useWorkflowHubSelectionState } from './useWorkflowHubSelectionState'
import { useWorkflowHubBootstrapState } from './useWorkflowHubBootstrapState'
import { useWorkflowHubEditorSession } from './useWorkflowHubEditorSession'
import { useWorkflowHubLocalState } from './useWorkflowHubLocalState'
import { WorkflowHubCards } from './WorkflowHubCards'
import { WorkflowHubRunPanels } from './WorkflowHubRunPanels'
import { WorkflowHubEditorPalette } from './WorkflowHubEditorPalette'
import { WorkflowHubEditorHeader } from './WorkflowHubEditorHeader'
import { WorkflowHubEditorCanvas } from './WorkflowHubEditorCanvas'
import { WorkflowHubCopilot } from './WorkflowHubCopilot'
import { WorkflowHubInspectorInfo } from './WorkflowHubInspectorInfo'
import { WorkflowHubInspectorHistory } from './WorkflowHubInspectorHistory'
import { WorkflowHubInspectorEdge } from './WorkflowHubInspectorEdge'
import { WorkflowHubInspectorNode } from './WorkflowHubInspectorNode'
import { WorkflowHubLibraryControls } from './WorkflowHubLibraryControls'
import { WorkflowHubLibraryPreview } from './WorkflowHubLibraryPreview'
import { WorkflowHubImportedWorkflowPreview } from './WorkflowHubImportedWorkflowPreview'
import { WorkflowHubListHeader } from './WorkflowHubListHeader'
import { WorkflowHubLibraryEmptyState } from './WorkflowHubLibraryEmptyState'
import { WorkflowHubLibrarySidebar } from './WorkflowHubLibrarySidebar'
import {
  buildDraftFromPreset,
  buildWorkflowPackage,
  cloneWorkflowDraft,
  normalizeImportedWorkflowDocument,
  parseWorkflowPackageDocument,
  type WorkflowPackageDocument,
} from './workflowHubTransferData'

type ViewMode = 'list' | 'editor'
type FilterFolderId = string | 'all'
type EdgeArmMode = 'idle' | 'source' | 'target'
type WorkflowAnalyticsWindow = 'all' | '7d' | '30d'
type ImportedWorkflowCandidate = {
  fileName: string
  importedAt: string
  workflow: WorkflowDefinition
  packageDocument: WorkflowPackageDocument | null
}

type Props = {
  initialWorkflowId?: string | null
  initialFolderId?: string | null
}

export default function WorkflowHub({ initialWorkflowId = null, initialFolderId = null }: Props) {
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const collectionImportRef = useRef<HTMLInputElement | null>(null)
  const packageImportRef = useRef<HTMLInputElement | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(initialWorkflowId ? 'editor' : 'list')
  // 2026-07-27b: mac dinh mo vao "Workflow cua toi" (DEFAULT_WORKFLOW_FOLDER_ID = 'personal') thay vi
  // "Templates" (40 mau) - Sep phan anh mo Workflow tab toan thay mau la thu, khong thay ngay workflow
  // cua minh dau. Nut "Xem mau" trong sidebar van chuyen sang TEMPLATE_WORKFLOW_FOLDER_ID khi Sep can.
  const [folderId, setFolderId] = useState<FilterFolderId>((initialFolderId as FilterFolderId) || DEFAULT_WORKFLOW_FOLDER_ID)
  // 2026-07-26j: nang state cua popover "+ Them node" len day (component cha) de ca nut tren
  // canvas va nut trong sidebar "Thu vien node" cung mo dung 1 popover, khong con 2 UI trung lap.
  const [isNodeQuickAddOpen, setIsNodeQuickAddOpen] = useState(false)
  // 2026-07-26L: state cho 4 nut moi trong thanh cong cu canvas (Khoa/Sap xep/Hoan tac/Luoi).
  const [showGrid, setShowGrid] = useState(true)
  // 2026-07-27: an/hien panel Thu vien node (trai) va Trinh chinh node (phai) de nguoi dung tu
  // "mo rong khung workflow to ra" khi can - canvas se choan het khoang trong duoc giai phong.
  // 2026-07-30: Sep phan anh nhieu lan giao dien Workflow Hub qua nhieu chi tiet/panel gay roi
  // so voi app tham khao (canvas gon, chi hien toolbar toi thieu, panel phu chi bung ra khi can).
  // Co che an/hien 2 panel trai-phai da co san tu 2026-07-27 (nut PanelLeftClose/PanelRightClose
  // trong WorkflowHubCanvasToolbar) nhung mac dinh la MO (false) nen Sep mo workflow len van thay
  // ca panel Thu vien node/Chay workflow/Lich su ben trai VA panel Thong tin workflow/Trinh chinh
  // node ben phai cung luc - dung nguyen nhan gay roi. Doi mac dinh sang DONG (true): mo workflow
  // len canvas gon nhu anh Sep gui tham khao, bam 2 icon o goc tren-trai canvas de bung tung panel
  // ra khi thuc su can (chinh node, xem thu vien, doc thong tin workflow...). Nut "Chay workflow"
  // rieng duoc dua ra ngay tren toolbar canvas (luon hien, khong nam trong panel bi an) de khong
  // mat chuc nang chay ngay ca khi ca 2 panel dang dong - xem WorkflowHubCanvasToolbar.tsx.
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(true)
  const [canUndo, setCanUndo] = useState(false)
  const historyStackRef = useRef<WorkflowDefinition[]>([])
  const [workflowId, setWorkflowId] = useState<string | null>(initialWorkflowId)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  // 2026-07-27f: Sep bao nut "Huy lien ket" bien mat - root cause that: khong phai bug o nut do,
  // ma panel Inspector ben phai (noi chua no, xem WorkflowHubInspectorEdge) da bi thu gon qua toggle
  // moi them cung ngay (isInspectorCollapsed). Tu mo lai panel ngay khi chon 1 node/edge tren canvas,
  // de Sep luon thay duoc "Trinh chinh node/lien ket" ma khong can tu nho bam lai icon mo panel.
  const [query, setQuery] = useState('')
  const [libraryFilter, setLibraryFilter] = useState<WorkflowLibraryFilter>('all')
  const [libraryTagFilter, setLibraryTagFilter] = useState('')
  const [libraryPreviewWorkflowId, setLibraryPreviewWorkflowId] = useState<string | null>(null)
  const [starterCollectionId, setStarterCollectionId] = useState<(typeof STARTER_COLLECTIONS)[number]['id']>('all')
  const [activeLibraryCollectionId, setActiveLibraryCollectionId] = useState<string>('all')
  const [analyticsWindow, setAnalyticsWindow] = useState<WorkflowAnalyticsWindow>('30d')
  const [selectedWizardPresetId, setSelectedWizardPresetId] = useState<string>(WORKFLOW_WIZARD_PRESETS[0]?.id || '')
  const [importedWorkflowCandidate, setImportedWorkflowCandidate] = useState<ImportedWorkflowCandidate | null>(null)
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([])
  const [libraryPreviewNameDraft, setLibraryPreviewNameDraft] = useState('')
  const [libraryPreviewDescriptionDraft, setLibraryPreviewDescriptionDraft] = useState('')
  const [libraryPreviewTagInput, setLibraryPreviewTagInput] = useState('')
  const [libraryPreviewMetadataDraft, setLibraryPreviewMetadataDraft] = useState('')
  const [workflowSort, setWorkflowSort] = useState<WorkflowSortMode>('updated_desc')
  const [isSaving, setIsSaving] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [runMode, setRunMode] = useState<'image' | 'video'>('image')
  const [runVariablesJson, setRunVariablesJson] = useState('')
  const [runInputValues, setRunInputValues] = useState<Record<string, string>>({})
  const [edgeSourceId, setEdgeSourceId] = useState('')
  const [edgeTargetId, setEdgeTargetId] = useState('')
  const [edgeBranch, setEdgeBranch] = useState<WorkflowEdgeBranch>('always')
  const [edgeArmMode, setEdgeArmMode] = useState<EdgeArmMode>('idle')
  const [canvasCursor, setCanvasCursor] = useState<{ x: number; y: number } | null>(null)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [selectedTraceNodeId, setSelectedTraceNodeId] = useState<string | null>(null)
  const {
    favoriteWorkflowIds,
    setFavoriteWorkflowIds,
    customCollections,
    setCustomCollections,
    localWorkflowPresets,
    setLocalWorkflowPresets,
    selectedLocalPresetId,
    setSelectedLocalPresetId,
  } = useWorkflowHubLocalState()
  const {
    loading,
    syncing,
    error,
    setError,
    folders,
    setFolders,
    workflows,
    setWorkflows,
    runs,
    setRuns,
    refreshData,
  } = useWorkflowHubBootstrapState({ errorMessage })
  const {
    activeWorkflow,
    editorDraft,
    setEditorDraft,
    workflowVersions,
    setWorkflowVersions,
    versionsLoading,
  } = useWorkflowHubEditorSession({
    workflowId,
    workflows,
    errorMessage,
    setError,
  })

  const draftWorkflow = editorDraft
  const [publishPreflight, setPublishPreflight] = useState<Awaited<ReturnType<typeof preflightWorkflow>> | null>(null)
  useEffect(() => {
    let cancelled = false
    if (!draftWorkflow || draftWorkflow.category !== 'custom') {
      setPublishPreflight(null)
      return () => {
        cancelled = true
      }
    }
    void preflightWorkflow(draftWorkflow, false)
      .then((report) => {
        if (!cancelled) setPublishPreflight(report)
      })
      .catch(() => {
        if (!cancelled) setPublishPreflight(null)
      })
    return () => {
      cancelled = true
    }
  }, [draftWorkflow, runs])
  const workflowValidation = useMemo(() => validateWorkflowDefinition(draftWorkflow), [draftWorkflow])
  const workflowValidationErrors = workflowValidation.errors
  const workflowValidationWarnings = workflowValidation.warnings
  const togglePublishedWithPreflight = async () => {
    if (!draftWorkflow) return
    if (draftWorkflow.published) {
      updateDraftWorkflow({ published: false })
      return
    }
    try {
      const report = await preflightWorkflow(draftWorkflow, true)
      const lines = [
        ...report.errors.map((item) => `• Lỗi: ${item}`),
        ...report.warnings.map((item) => `• Cảnh báo: ${item}`),
      ]
      if (!report.publishReady) {
        window.alert(`Workflow chưa thể xuất bản:\n${lines.join('\n') || 'Chưa đạt kiểm tra.'}`)
        return
      }
      if (report.warnings.length > 0 && !window.confirm(`Kiểm tra đạt nhưng còn cảnh báo:\n${lines.join('\n')}\n\nTiếp tục đánh dấu xuất bản?`)) {
        return
      }
      updateDraftWorkflow({ published: true })
      window.alert('Đã vượt qua kiểm tra trước xuất bản. Hãy bấm “Lưu thay đổi” để hoàn tất.')
    } catch (preflightError) {
      window.alert(errorMessage(preflightError))
    }
  }
  // 2026-07-26i: tinh 1 lan, dung chung cho ca palette ben trai va nut "+ Them node" tren canvas -
  // truoc day chi tinh inline rieng cho palette, gio Canvas cung can danh sach nay cho popover moi.
  const nodeLibraryItems = useMemo(
    () =>
      WORKFLOW_NODE_LIBRARY.map((entry) => ({
        type: entry.type,
        label: entry.label,
        description: entry.description,
        color: NODE_TYPE_COLORS[entry.type],
        icon: nodeIcon(entry.type),
      })),
    [],
  )

  // 2026-07-27: canvas tu gian theo bounding box node thuc te thay vi khung 1240x620 co dinh - root
  // cause node "tran ra khoi khung": addNode/addBlock dat x = max(node.x)+260 khong he clamp theo
  // CANVAS_WIDTH, nen tu node thu 5-6 tro di x da vuot 1240 va bi cat/tran qua vien net dut. Thay vi
  // clamp (se lam node chong len nhau), cho khung tu lon ra du de luon bao trong moi node + le 260/220.
  const canvasSize = useMemo(() => {
    const nodes = draftWorkflow?.nodes ?? []
    if (nodes.length === 0) return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
    const maxX = Math.max(...nodes.map((node) => node.x + nodeCardWidth(node.type, node.config.aspect_ratio))) + 80
    const maxY = Math.max(...nodes.map((node) => node.y + nodeCardEstimatedHeight(node.type, node.config.aspect_ratio))) + 80
    return { width: Math.max(CANVAS_WIDTH, maxX), height: Math.max(CANVAS_HEIGHT, maxY) }
  }, [draftWorkflow?.nodes])

  const {
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
  } = useWorkflowHubRunState({
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
  })

  // 2026-07-28h: Sep bao node Anh/Video "khong phai dung de tai anh len va viet prompt o day" -
  // da bo han o nhap/nut chay-thu-rieng-node khoi WorkflowHubNodeMediaPanel (xem file do). Preview
  // tren the node gio lay THAT tu ket qua lan "Chay workflow" gan nhat (selectedRunTrace, be
  // main.py tra output.imageUrl/output.videoUrl dung theo node) - khong con duong nhap lieu gia
  // song song voi node "Dung prompt"/"Dau vao" that nua.
  const latestOutputByNodeId = useMemo(() => {
    const map = new Map<string, { url: string; type: 'image' | 'video' }>()
    for (const item of selectedRunTrace) {
      if (!item || typeof item !== 'object') continue
      const nodeId = String((item as Record<string, unknown>).nodeId || '')
      const nodeType = String((item as Record<string, unknown>).type || '')
      const output = (item as Record<string, unknown>).output as Record<string, unknown> | undefined
      if (!nodeId || !output) continue
      if (nodeType === 'image') {
        const url = String(output.imageUrl || '')
        if (url) map.set(nodeId, { url, type: 'image' })
      } else if (nodeType === 'video') {
        const url = String(output.videoUrl || '')
        if (url) map.set(nodeId, { url, type: 'video' })
      }
    }
    return map
  }, [selectedRunTrace])

  const {
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
  } = useWorkflowHubLibraryData({
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
    draftWorkflowId: draftWorkflow?.id,
    starterCollectionId,
    mediaLabel,
    prettyJson,
    statsFns: {
      isWorkflowFailHigh,
      isWorkflowSlow,
      isWorkflowLowUse,
      isWorkflowStale,
    },
  })

  const {
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
  } = useWorkflowHubSelectionState({
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
  })
  const {
    selectedLocalPreset,
    selectedWizardPreset,
    componentInputSchemaFields,
    componentOutputSchemaMap,
    componentOutputSchemaEntries,
    selectedReusableWorkflow,
    selectedNodeConfigTemplates,
    componentCanvasInfoByNodeId,
  } = useWorkflowHubEditorData({
    localWorkflowPresets,
    selectedLocalPresetId,
    selectedWizardPresetId,
    draftWorkflow,
    selectedNode,
    reusableWorkflowOptions,
    reusableWorkflowById,
  })

  const isEditable = draftWorkflow?.category === 'custom'
  const isInspectorCollapsed = !(selectedNode || selectedEdge || selectedRun || selectedTraceItem)
  const {
    isDirty,
    confirmDiscardChanges,
    updateDraftWorkflow,
    updateDraftNode,
    removeDraftNodeConfigKey,
    applySelectedNodeConfigTemplate,
    updateDraftEdge,
  } = useWorkflowHubEditorMutations({
    activeWorkflow,
    draftWorkflow,
    isEditable,
    selectedNode,
    selectedEdgeId,
    setEditorDraft,
    setSelectedEdgeId,
  })

  useEffect(() => {
    setRunInputValues((current) => {
      const next = { ...current }
      for (const field of displayedRunFields) {
        if (next[field] === undefined) next[field] = defaultRunFieldValue(field)
      }
      return next
    })
  }, [displayedRunFields])

  const {
    saveWorkflowDraft,
    createFolderAction,
    renameFolderAction,
    deleteFolderAction,
    createWorkflowAction,
    createWorkflowFromDefinitionAction,
    createWorkflowFromWizardPresetAction,
    openWorkflow,
    cloneWorkflowAction,
    saveAsStarterAction,
    quickUpdateWorkflowAction,
    saveLibraryPreviewMetaAction,
    saveLibraryPreviewOverviewAction,
  } = useWorkflowHubCrudActions({
    draftWorkflow,
    workflowValidationErrors,
    folderId,
    libraryPreviewNameDraft,
    libraryPreviewDescriptionDraft,
    libraryPreviewTagInput,
    libraryPreviewMetadataDraft,
    setIsSaving,
    setWorkflows,
    setEditorDraft,
    setWorkflowVersions,
    setError,
    setFolders,
    setFolderId,
    setWorkflowId,
    setViewMode,
    setSelectedEdgeId,
    refreshData,
    confirmDiscardChanges,
    errorMessage,
    validationIssueLines,
    cloneWorkflowDraft,
    buildDraftFromPreset,
    mergeWorkflowTags,
    stringifyWorkflowTags,
  })

  const {
    toggleFavoriteWorkflow,
    createCustomCollectionAction,
    renameCustomCollectionAction,
    deleteCustomCollectionAction,
    toggleWorkflowInCollection,
    exportCollectionsAction,
    importCollectionsFile,
    toggleWorkflowSelection,
    selectAllVisibleWorkflowsAction,
    clearWorkflowSelectionAction,
    runBulkWorkflowAction,
    bulkFavoriteSelectionAction,
    bulkSaveStarterSelectionAction,
    bulkUpdateCustomSelectionAction,
    bulkAddSelectionToCurrentCollectionAction,
  } = useWorkflowHubCollectionActions({
    favoriteWorkflowIds,
    customCollections,
    activeLibraryCollectionId,
    selectedVisibleWorkflows,
    selectedVisibleCustomWorkflows,
    sortedVisibleWorkflows,
    setFavoriteWorkflowIds,
    setCustomCollections,
    setActiveLibraryCollectionId,
    setSelectedWorkflowIds,
    setIsBulkUpdating,
    errorMessage,
    saveAsStarterAction,
    quickUpdateWorkflowAction,
  })
  const {
    importPackageAsNewWorkflowFile,
    deleteWorkflowAction,
    exportWorkflowAction,
    exportWorkflowPackageAction,
    importWorkflowFile,
    saveLocalPresetAction,
    applyLocalPresetAction,
    applyWorkflowWizardToEditorAction,
    deleteLocalPresetAction,
    restoreVersionAction,
  } = useWorkflowHubTransferActions({
    folderId,
    workflowId,
    draftWorkflow,
    workflowValidationErrors,
    isDirty,
    setImportedWorkflowCandidate,
    setWorkflows,
    setWorkflowId,
    setEditorDraft,
    setViewMode,
    setSelectedNodeId,
    setSelectedEdgeId,
    setLocalWorkflowPresets,
    setWorkflowVersions,
    setError,
    errorMessage,
    validationIssueLines,
    cloneWorkflowDraft,
    buildDraftFromPreset,
    workflowExportFilename,
    workflowPackageFilename,
    buildWorkflowPackage,
    normalizeImportedWorkflowDocument,
    parseWorkflowPackageDocument,
    relativeTime,
  })

  const {
    addNode: addNodeRaw,
    addBlock: addBlockRaw,
    addComponentWorkflowBlock: addComponentWorkflowBlockRaw,
    moveNode,
    moveNodeTo,
    removeSelectedNode: removeSelectedNodeRaw,
    duplicateNode: duplicateNodeRaw,
    disconnectNode: disconnectNodeRaw,
    removeNode: removeNodeRaw,
    appendEdge: appendEdgeRaw,
    addEdgeAction: addEdgeActionRaw,
    removeSelectedEdge: removeSelectedEdgeRaw,
    addFrame: addFrameRaw,
    updateFrame,
    removeFrame: removeFrameRaw,
    moveFrameBy,
    addNote: addNoteRaw,
    updateNote,
    removeNote: removeNoteRaw,
  } = useWorkflowHubCanvasActions({
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
  })

  // 2026-07-26L: "Hoan tac" - stack snapshot draftWorkflow truoc moi thay doi lon (them/xoa node,
  // them/xoa edge, bat dau keo node, tu sap xep, khoa node). Chi push 1 lan moi hanh dong (khong
  // push moi pixel keo chuot - xem onBeginNodeDrag goi tu WorkflowHubEditorCanvas luc mousedown),
  // gioi han 30 buoc giong app tham khao. Dat sau hook tren de co the wrap lai cac ham addNode/
  // removeSelectedNode/... voi cung ten cu, khong phai sua moi noi da dung props nay.
  const pushHistorySnapshot = () => {
    if (!draftWorkflow) return
    historyStackRef.current.push(draftWorkflow)
    if (historyStackRef.current.length > 30) historyStackRef.current.shift()
    setCanUndo(true)
  }
  const undoLastChange = () => {
    const prev = historyStackRef.current.pop()
    if (!prev) return
    setEditorDraft(prev)
    setCanUndo(historyStackRef.current.length > 0)
  }
  const addNode = (type: WorkflowNodeType) => {
    pushHistorySnapshot()
    addNodeRaw(type)
  }
  const addBlock = (block: WorkflowBlockTemplate) => {
    pushHistorySnapshot()
    addBlockRaw(block)
  }
  const addComponentWorkflowBlock = (workflow: WorkflowDefinition) => {
    pushHistorySnapshot()
    addComponentWorkflowBlockRaw(workflow)
  }
  const removeSelectedNode = () => {
    if (!selectedNode) return
    pushHistorySnapshot()
    removeSelectedNodeRaw()
  }
  const duplicateNode = (nodeId: string) => {
    pushHistorySnapshot()
    duplicateNodeRaw(nodeId)
  }
  const disconnectNode = (nodeId: string) => {
    pushHistorySnapshot()
    disconnectNodeRaw(nodeId)
  }
  const removeNode = (nodeId: string) => {
    pushHistorySnapshot()
    removeNodeRaw(nodeId)
  }
  const removeSelectedEdge = () => {
    if (!selectedEdge) return
    pushHistorySnapshot()
    removeSelectedEdgeRaw()
  }
  const appendEdge = (sourceIdRaw: string, targetIdRaw: string, options?: { silent?: boolean }) => {
    const snapshot = draftWorkflow
    const ok = appendEdgeRaw(sourceIdRaw, targetIdRaw, options)
    if (ok && snapshot) {
      historyStackRef.current.push(snapshot)
      if (historyStackRef.current.length > 30) historyStackRef.current.shift()
      setCanUndo(true)
    }
    return ok
  }
  const addEdgeAction = () => {
    const snapshot = draftWorkflow
    addEdgeActionRaw()
    // addEdgeActionRaw goi appendEdgeRaw goc (khong qua wrapper tren) nen tu push o day; khong the
    // biet no thanh cong hay khong tu day nen push truoc, chap nhan 1 snapshot du neu that bai
    // (vo hai - Hoan tac se chi phuc hoi dung trang thai hien tai).
    if (snapshot) {
      historyStackRef.current.push(snapshot)
      if (historyStackRef.current.length > 30) historyStackRef.current.shift()
      setCanUndo(true)
    }
  }
  const addFrame = () => {
    pushHistorySnapshot()
    addFrameRaw()
  }
  const removeFrame = (frameId: string) => {
    pushHistorySnapshot()
    removeFrameRaw(frameId)
  }
  const addNote = (x: number, y: number) => {
    pushHistorySnapshot()
    return addNoteRaw(x, y)
  }
  const removeNote = (noteId: string) => {
    pushHistorySnapshot()
    removeNoteRaw(noteId)
  }
  // 2026-08-02: "Lưu khung dưới dạng mẫu" - tai su dung dung co che Preset cuc bo da co san
  // (localWorkflowPresets/setLocalWorkflowPresets), chi khac o CHI luu node/edge nam trong khung
  // (tinh bang nodesInFrame) thay vi ca workflow. Khong lam duoc "chay doc lap tung khung" o dot
  // nay (can thiet ke lai co che thuc thi subgraph phia backend) - Khung hien tai la tinh nang
  // TO CHUC/DI CHUYEN THI GIAC + luu mau, chua phai don vi thuc thi rieng.
  const saveFrameAsPresetAction = (frame: { id: string; label: string }) => {
    if (!draftWorkflow) return
    const memberNodes = nodesInFrame(draftWorkflow.frames?.find((f) => f.id === frame.id) ?? { x: 0, y: 0, width: 0, height: 0 }, draftWorkflow.nodes)
    if (memberNodes.length === 0) {
      window.alert('Khung này chưa chứa node nào để lưu thành mẫu.')
      return
    }
    const memberIds = new Set(memberNodes.map((node) => node.id))
    const memberEdges = draftWorkflow.edges.filter((edge) => memberIds.has(edge.source) && memberIds.has(edge.target))
    const nextPreset = {
      id: generateId(),
      name: frame.label,
      description: `Lưu từ khung "${frame.label}" (${memberNodes.length} node)`,
      savedAt: new Date().toISOString(),
      workflow: cloneWorkflowDraft({ ...draftWorkflow, nodes: memberNodes, edges: memberEdges, frames: [], notes: [] }),
    }
    setLocalWorkflowPresets((current) => [nextPreset, ...current].slice(0, 40))
    window.alert(`Đã lưu khung "${frame.label}" (${memberNodes.length} node) vào Preset cục bộ.`)
  }
  const [isPlacingNote, setIsPlacingNote] = useState(false)
  const handleCanvasPlaceNote = (x: number, y: number) => {
    const noteId = addNote(x, y)
    setIsPlacingNote(false)
    return noteId
  }
  const toggleSelectedNodeLock = () => {
    if (!selectedNode) return
    pushHistorySnapshot()
    updateDraftNode(selectedNode.id, { locked: !selectedNode.locked })
  }
  const autoArrangeNodes = () => {
    if (!draftWorkflow || draftWorkflow.category !== 'custom' || draftWorkflow.nodes.length === 0) return
    pushHistorySnapshot()
    const cols = 4
    const gapX = 300
    const gapY = 200
    const nextNodes = draftWorkflow.nodes.map((nodeItem, index) => ({
      ...nodeItem,
      x: 80 + (index % cols) * gapX,
      y: 80 + Math.floor(index / cols) * gapY,
    }))
    updateDraftWorkflow({ nodes: nextNodes })
  }
  const toggleGrid = () => setShowGrid((current) => !current)

  const { runWorkflowAction } = useWorkflowHubRunActions({
    draftWorkflow,
    workflowValidationErrors,
    runVariablesJson,
    runInputValues,
    currentMode,
    currentNeedsReference,
    runMode,
    setIsRunning,
    setRuns,
    setSelectedRunId,
    setSelectedTraceNodeId,
    setError,
    errorMessage,
    validationIssueLines,
    isDirty,
    saveWorkflowDraft,
  })

  const workflowCards = (
    <WorkflowHubCards
      workflows={sortedVisibleWorkflows}
      workflowRunStatsById={workflowRunStatsById}
      selectedWorkflowIds={selectedWorkflowIds}
      favoriteWorkflowIds={favoriteWorkflowIds}
      mediaLabel={mediaLabel}
      relativeTime={relativeTime}
      formatDurationMs={formatDurationMs}
      getSuccessRate={workflowSuccessRate}
      getHealthBadges={workflowHealthBadges}
      onOpenWorkflow={openWorkflow}
      onToggleWorkflowSelection={toggleWorkflowSelection}
      onToggleFavoriteWorkflow={toggleFavoriteWorkflow}
      onPreviewWorkflow={setLibraryPreviewWorkflowId}
      onSaveStarter={saveAsStarterAction}
      onCloneWorkflow={cloneWorkflowAction}
      onQuickUpdateWorkflow={quickUpdateWorkflowAction}
      onDeleteWorkflow={deleteWorkflowAction}
    />
  )

  if (loading) {
    return (
      <div className="wf-root">
        <div className="wf-loading">
          <LoaderCircle size={18} className="spin" />
          Đang tải workflow...
        </div>
      </div>
    )
  }

  if (viewMode === 'editor' && draftWorkflow) {
    return (
      <div className="wf-root wf-editor-shell">
        {error && (
          <div className="wf-banner wf-banner-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <WorkflowHubEditorHeader
          draftWorkflow={draftWorkflow}
          isEditable={isEditable}
          importInputRef={importInputRef}
          confirmDiscardChanges={confirmDiscardChanges}
          setViewMode={setViewMode}
          importWorkflowFile={importWorkflowFile}
          exportWorkflowAction={exportWorkflowAction}
          exportWorkflowPackageAction={exportWorkflowPackageAction}
          cloneWorkflowAction={cloneWorkflowAction}
          updateDraftWorkflow={updateDraftWorkflow}
          onTogglePublished={togglePublishedWithPreflight}
          publishGateReady={Boolean(draftWorkflow.published || publishPreflight?.publishReady)}
          publishGateMessage={
            draftWorkflow.environment === 'sandbox'
              ? 'Workflow thử nghiệm chưa thể xuất bản trực tiếp. Sau khi đạt đủ gate, hãy dùng bản ứng viên trong Workflow của tôi.'
              : publishPreflight?.warnings.join(' ') || publishPreflight?.errors.join(' ') || 'Đang kiểm tra điều kiện xuất bản.'
          }
        />

        <div
          className={`wf-editor-layout${isPaletteCollapsed ? ' is-palette-collapsed' : ''}${isInspectorCollapsed ? ' is-inspector-collapsed' : ''}`}
        >
          <WorkflowHubEditorPalette
            isEditable={isEditable}
            mediaLabel={mediaLabel}
            nodeLibraryItems={nodeLibraryItems}
            onAddNode={addNode}
            onOpenNodeQuickAdd={() => setIsNodeQuickAddOpen(true)}
            groupedWorkflowBlocks={groupedWorkflowBlocks}
            onAddBlock={addBlock}
            componentWorkflowOptions={componentWorkflowOptions}
            onAddComponentWorkflowBlock={addComponentWorkflowBlock}
            parseComponentInputSchema={parseComponentInputSchema}
            parseComponentOutputSchema={parseComponentOutputSchema}
            onSaveLocalPreset={saveLocalPresetAction}
            localWorkflowPresets={localWorkflowPresets}
            selectedLocalPresetId={selectedLocalPreset?.id || null}
            onSelectLocalPreset={setSelectedLocalPresetId}
            onApplyLocalPreset={applyLocalPresetAction}
            onDeleteLocalPreset={deleteLocalPresetAction}
            relativeTime={relativeTime}
            previewWorkflowMetadataEntries={previewWorkflowMetadataEntries}
            draftWorkflow={draftWorkflow}
            currentMode={currentMode}
            displayedRunFields={displayedRunFields}
            runInputValues={runInputValues}
            setRunInputValues={setRunInputValues}
            runVariablesJson={runVariablesJson}
            setRunVariablesJson={setRunVariablesJson}
            runMode={runMode}
            setRunMode={setRunMode}
            runWorkflowAction={runWorkflowAction}
            isRunning={isRunning}
            workflowValidationErrors={workflowValidationErrors}
            workflowValidationWarnings={workflowValidationWarnings}
            currentRuns={currentRuns}
            selectedRunId={selectedRun?.id ?? null}
            setSelectedRunId={setSelectedRunId}
            setSelectedTraceNodeId={setSelectedTraceNodeId}
            inputFieldLabel={inputFieldLabel}
            inputFieldHint={inputFieldHint}
            isLongTextField={isLongTextField}
            inputFieldPlaceholder={inputFieldPlaceholder}
            statusClass={statusClass}
            statusLabel={statusLabel}
            prettyJson={prettyJson}
          />

          <WorkflowHubEditorCanvas
            draftWorkflow={draftWorkflow}
            mediaLabel={mediaLabel}
            workflowValidationErrorsCount={workflowValidationErrors.length}
            workflowValidationWarningsCount={workflowValidationWarnings.length}
            syncing={syncing}
            edgeArmMode={edgeArmMode}
            armedSourceNode={armedSourceNode}
            armedTargetNode={armedTargetNode}
            isEditable={isEditable}
            onCancelEdgeArm={() => {
              setEdgeArmMode('idle')
              setCanvasCursor(null)
            }}
            saveWorkflowDraft={saveWorkflowDraft}
            isDirty={isDirty}
            isSaving={isSaving}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            canvasCursor={canvasCursor}
            setCanvasCursor={setCanvasCursor}
            selectedEdgeId={selectedEdgeId}
            setSelectedEdgeId={setSelectedEdgeId}
            selectedNodeId={selectedNodeId}
            setSelectedNodeId={setSelectedNodeId}
            selectedTraceNodeId={selectedTraceNodeId}
            setSelectedTraceNodeId={setSelectedTraceNodeId}
            selectedRunTraceStatusByNodeId={selectedRunTraceStatusByNodeId}
            latestOutputByNodeId={latestOutputByNodeId}
            edgeSourceId={edgeSourceId}
            edgeTargetId={edgeTargetId}
            setEdgeSourceId={setEdgeSourceId}
            setEdgeTargetId={setEdgeTargetId}
            setEdgeArmMode={setEdgeArmMode}
            appendEdge={appendEdge}
            moveNodeTo={moveNodeTo}
            componentCanvasInfoByNodeId={componentCanvasInfoByNodeId}
            nodeTypeColors={NODE_TYPE_COLORS}
            nodeIcon={nodeIcon}
            updateDraftNode={updateDraftNode}
            nodeLibraryItems={nodeLibraryItems}
            onAddNode={addNode}
            isNodeQuickAddOpen={isNodeQuickAddOpen}
            onOpenNodeQuickAdd={() => setIsNodeQuickAddOpen(true)}
            onCloseNodeQuickAdd={() => setIsNodeQuickAddOpen(false)}
            showGrid={showGrid}
            onToggleGrid={toggleGrid}
            canUndo={canUndo}
            onUndo={undoLastChange}
            onAutoArrange={autoArrangeNodes}
            onToggleLock={toggleSelectedNodeLock}
            onBeginNodeDrag={pushHistorySnapshot}
            onDuplicateNode={duplicateNode}
            onDisconnectNode={disconnectNode}
            onRemoveNode={removeNode}
            isPaletteCollapsed={isPaletteCollapsed}
            onTogglePalette={() => setIsPaletteCollapsed((current) => !current)}
            runInputValues={runInputValues}
            setRunInputValues={setRunInputValues}
            inputFieldLabel={inputFieldLabel}
            inputFieldPlaceholder={inputFieldPlaceholder}
            isLongTextField={isLongTextField}
            runWorkflowAction={runWorkflowAction}
            isRunning={isRunning}
            frames={draftWorkflow.frames ?? []}
            onAddFrame={addFrame}
            onUpdateFrame={updateFrame}
            onRemoveFrame={removeFrame}
            onMoveFrameBy={moveFrameBy}
            onSaveFrameAsPreset={saveFrameAsPresetAction}
            notes={draftWorkflow.notes ?? []}
            isPlacingNote={isPlacingNote}
            onToggleNotePlacement={() => setIsPlacingNote((current) => !current)}
            onPlaceNote={handleCanvasPlaceNote}
            onUpdateNote={updateNote}
            onRemoveNote={removeNote}
          />

          <aside className="wf-inspector">
            <WorkflowHubInspectorInfo
              draftWorkflow={draftWorkflow}
              isEditable={isEditable}
              folders={folders}
              componentInputSchemaFields={componentInputSchemaFields}
              componentOutputSchemaMap={componentOutputSchemaMap}
              componentOutputSchemaEntries={componentOutputSchemaEntries}
              updateDraftWorkflow={updateDraftWorkflow}
              inferComponentInputSchema={inferComponentInputSchema}
              inferComponentOutputSchema={inferComponentOutputSchema}
              inputFieldLabel={inputFieldLabel}
              inputFieldPlaceholder={inputFieldPlaceholder}
              defaultRunFieldValue={defaultRunFieldValue}
              stringifyWorkflowTags={stringifyWorkflowTags}
              mergeWorkflowTags={mergeWorkflowTags}
            />

            <WorkflowHubInspectorNode
              draftWorkflow={draftWorkflow}
              selectedNode={selectedNode}
              isEditable={isEditable}
              selectedNodeConfigTemplates={selectedNodeConfigTemplates}
              selectedConditionEdges={selectedConditionEdges}
              reusableWorkflowOptions={reusableWorkflowOptions}
              selectedReusableWorkflow={selectedReusableWorkflow}
              applySelectedNodeConfigTemplate={applySelectedNodeConfigTemplate}
              updateDraftNode={updateDraftNode}
              removeDraftNodeConfigKey={removeDraftNodeConfigKey}
              updateDraftEdge={updateDraftEdge}
              openWorkflow={openWorkflow}
              moveNode={moveNode}
              removeSelectedNode={removeSelectedNode}
            />

            <WorkflowHubInspectorEdge
              draftWorkflow={draftWorkflow}
              selectedEdge={selectedEdge}
              selectedEdgeSourceNode={selectedEdgeSourceNode}
              selectedEdgeTargetNode={selectedEdgeTargetNode}
              edgeFormSourceNode={edgeFormSourceNode}
              edgeFormTargetNode={edgeFormTargetNode}
              edgeSourceId={edgeSourceId}
              edgeTargetId={edgeTargetId}
              edgeBranch={edgeBranch}
              isEditable={isEditable}
              updateDraftEdge={updateDraftEdge}
              removeSelectedEdge={removeSelectedEdge}
              setEdgeSourceId={setEdgeSourceId}
              setEdgeTargetId={setEdgeTargetId}
              setEdgeBranch={setEdgeBranch}
              addEdgeAction={addEdgeAction}
            />

            <WorkflowHubInspectorHistory
              draftWorkflow={draftWorkflow}
              isEditable={isEditable}
              versionsLoading={versionsLoading}
              workflowVersions={workflowVersions}
              relativeTime={relativeTime}
              restoreVersionAction={restoreVersionAction}
              selectedRun={selectedRun}
              selectedRunTrace={selectedRunTrace}
              selectedTraceNodeId={selectedTraceNodeId}
              setSelectedTraceNodeId={setSelectedTraceNodeId}
              setSelectedNodeId={setSelectedNodeId}
              selectedTraceItem={selectedTraceItem}
              selectedRunState={selectedRunState}
              statusClass={statusClass}
              statusLabel={statusLabel}
              prettyJson={prettyJson}
            />
          </aside>
        </div>
        <WorkflowHubCopilot workflow={draftWorkflow} isEditable={isEditable} onAddNode={addNode} />
      </div>
    )
  }

  return (
    <div className="wf-root">
      {error && (
        <div className="wf-banner wf-banner-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <WorkflowHubListHeader
        collectionImportRef={collectionImportRef}
        packageImportRef={packageImportRef}
        importCollectionsFile={importCollectionsFile}
        importPackageAsNewWorkflowFile={importPackageAsNewWorkflowFile}
        createFolderAction={createFolderAction}
        createWorkflowAction={createWorkflowAction}
      />

      {importedWorkflowCandidate && (
        <WorkflowHubImportedWorkflowPreview
          importedWorkflowCandidate={importedWorkflowCandidate}
          mediaLabel={mediaLabel}
          createWorkflowFromDefinitionAction={createWorkflowFromDefinitionAction}
          clearImportedWorkflowCandidate={() => setImportedWorkflowCandidate(null)}
          relativeTime={relativeTime}
          prettyJson={prettyJson}
        />
      )}

      <div className="wf-list-layout">
        <WorkflowHubLibrarySidebar
          folderId={folderId}
          workflows={workflows}
          folders={folders}
          setFolderId={setFolderId}
          createFolderAction={createFolderAction}
          renameFolderAction={renameFolderAction}
          deleteFolderAction={deleteFolderAction}
          activeLibraryCollectionId={activeLibraryCollectionId}
          setActiveLibraryCollectionId={setActiveLibraryCollectionId}
          favoriteWorkflowIds={favoriteWorkflowIds}
          customCollections={customCollections}
          createCustomCollectionAction={createCustomCollectionAction}
          renameCustomCollectionAction={renameCustomCollectionAction}
          deleteCustomCollectionAction={deleteCustomCollectionAction}
          exportCollectionsAction={exportCollectionsAction}
          onImportCollectionsClick={() => collectionImportRef.current?.click()}
          selectedWizardPresetId={selectedWizardPreset?.id || null}
          setSelectedWizardPresetId={setSelectedWizardPresetId}
          createWorkflowFromWizardPresetAction={createWorkflowFromWizardPresetAction}
          mediaLabel={mediaLabel}
          localWorkflowPresets={localWorkflowPresets}
          selectedLocalPresetId={selectedLocalPreset?.id || null}
          setSelectedLocalPresetId={setSelectedLocalPresetId}
          createWorkflowFromDefinitionAction={createWorkflowFromDefinitionAction}
          relativeTime={relativeTime}
          previewWorkflowMetadataEntries={previewWorkflowMetadataEntries}
        />

        <section className="wf-list-main">
          <WorkflowHubLibraryControls
            folderLabel={folderLabel}
            activeLibraryCollectionLabel={activeLibraryCollectionLabel}
            activeLibraryFilterLabel={activeLibraryFilterLabel}
            analyticsWindowLabel={analyticsWindowLabel}
            libraryTagFilter={libraryTagFilter}
            libraryDashboardStats={libraryDashboardStats}
            formatDurationMs={formatDurationMs}
            selectedVisibleWorkflowsCount={selectedVisibleWorkflows.length}
            selectedVisibleCustomWorkflowsCount={selectedVisibleCustomWorkflows.length}
            selectAllVisibleWorkflowsAction={selectAllVisibleWorkflowsAction}
            clearWorkflowSelectionAction={clearWorkflowSelectionAction}
            bulkFavoriteSelectionAction={bulkFavoriteSelectionAction}
            isBulkUpdating={isBulkUpdating}
            bulkSaveStarterSelectionAction={bulkSaveStarterSelectionAction}
            activeLibraryCollectionId={activeLibraryCollectionId}
            bulkAddSelectionToCurrentCollectionAction={bulkAddSelectionToCurrentCollectionAction}
            bulkUpdateCustomSelectionAction={bulkUpdateCustomSelectionAction}
            query={query}
            setQuery={setQuery}
            visibleWorkflowCount={sortedVisibleWorkflows.length}
            analyticsWindow={analyticsWindow}
            setAnalyticsWindow={setAnalyticsWindow}
            workflowSort={workflowSort}
            setWorkflowSort={setWorkflowSort}
            libraryFilter={libraryFilter}
            setLibraryFilter={setLibraryFilter}
            workflowTagOptions={workflowTagOptions}
            setLibraryTagFilter={setLibraryTagFilter}
          />

          {selectedLibraryWorkflow && (
            <WorkflowHubLibraryPreview
              selectedLibraryWorkflow={selectedLibraryWorkflow}
              mediaLabel={mediaLabel}
              libraryPreviewNameDraft={libraryPreviewNameDraft}
              setLibraryPreviewNameDraft={setLibraryPreviewNameDraft}
              libraryPreviewDescriptionDraft={libraryPreviewDescriptionDraft}
              setLibraryPreviewDescriptionDraft={setLibraryPreviewDescriptionDraft}
              toggleFavoriteWorkflow={toggleFavoriteWorkflow}
              favoriteWorkflowIds={favoriteWorkflowIds}
              openWorkflow={openWorkflow}
              quickUpdateWorkflowAction={quickUpdateWorkflowAction}
              saveLibraryPreviewOverviewAction={saveLibraryPreviewOverviewAction}
              saveAsStarterAction={saveAsStarterAction}
              cloneWorkflowAction={cloneWorkflowAction}
              relativeTime={relativeTime}
              healthBadges={workflowHealthBadges(
                selectedLibraryWorkflow,
                workflowRunStatsById.get(selectedLibraryWorkflow.id),
              )}
              runStats={workflowRunStatsById.get(selectedLibraryWorkflow.id)}
              formatDurationMs={formatDurationMs}
              libraryPreviewTagInput={libraryPreviewTagInput}
              setLibraryPreviewTagInput={setLibraryPreviewTagInput}
              stringifyWorkflowTags={stringifyWorkflowTags}
              mergeWorkflowTags={mergeWorkflowTags}
              libraryPreviewMetadataDraft={libraryPreviewMetadataDraft}
              setLibraryPreviewMetadataDraft={setLibraryPreviewMetadataDraft}
              saveLibraryPreviewMetaAction={saveLibraryPreviewMetaAction}
              customCollections={customCollections}
              toggleWorkflowInCollection={toggleWorkflowInCollection}
              libraryTagFilter={libraryTagFilter}
              setLibraryTagFilter={setLibraryTagFilter}
              prettyJson={prettyJson}
              onClose={() => setLibraryPreviewWorkflowId(null)}
              onDelete={() => void deleteWorkflowAction(selectedLibraryWorkflow)}
            />
          )}

          {sortedVisibleWorkflows.length === 0 ? (
            <WorkflowHubLibraryEmptyState
              onShowTemplates={() => setFolderId(TEMPLATE_WORKFLOW_FOLDER_ID)}
              onCreateWorkflow={createWorkflowAction}
            />
          ) : (
            workflowCards
          )}
        </section>
      </div>
    </div>
  )
}
