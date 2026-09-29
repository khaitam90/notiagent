import {
  AppWindow,
  ArrowRightLeft,
  Boxes,
  Braces,
  FileText,
  GitBranch,
  GitMerge,
  Globe,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  ListOrdered,
  LogIn,
  LogOut,
  Mic,
  Repeat,
  Smile,
  SlidersHorizontal,
  Sparkles,
  Video,
  Wand2,
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { WorkflowDefinition, WorkflowEdge, WorkflowEdgeBranch, WorkflowMedia, WorkflowNodeType, WorkflowRun } from '../../lib/workflows'
import { parseWorkflowMetadata } from './workflowHubData'

// 2026-07-26i: node moi trong danh sach de Sep chon khi them node - dung chung giua
// WorkflowHubEditorPalette va WorkflowHubEditorCanvas (nut "+ Them node" tren canvas).
export type NodeLibraryItem = {
  type: WorkflowNodeType
  label: string
  description: string
  color: string
  icon: ReactNode
}

// 2026-07-26i: nhom node theo nhom chuc nang de lam tab loc trong bang tim-kiem-them-node moi
// (cai tien tu y tuong "add node" cua app tham khao, nhung tu thiet ke nhom rieng khop voi 17
// loai node thuc te cua Noti thay vi copy nguyen catalog cua ho).
export const NODE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'io', label: 'Vào / Ra' },
  { id: 'content', label: 'Nội dung & Prompt' },
  { id: 'data', label: 'Dữ liệu & Biến' },
  { id: 'logic', label: 'Logic & Luồng' },
  { id: 'ai', label: 'AI Sáng tạo' },
  { id: 'integration', label: 'Tích hợp' },
]

export const NODE_TYPE_CATEGORY: Record<WorkflowNodeType, string> = {
  input: 'io',
  output: 'io',
  prompt: 'content',
  template: 'content',
  set: 'data',
  json: 'data',
  array: 'data',
  map: 'data',
  merge: 'data',
  condition: 'logic',
  for_each: 'logic',
  subflow: 'logic',
  browser: 'integration',
  image: 'ai',
  video: 'ai',
  tts: 'ai',
  lipsync: 'ai',
  http: 'integration',
}

// 2026-07-26j: icon rieng cho tung tab-danh-muc trong bang tim-kiem-them-node - doi tu text-chip
// ("Tat ca", "Vao / Ra"...) sang icon-only (kem title tooltip) de gon nhu tham khao nhung van ro nghia
// khi hover, tranh chiem nhieu chieu ngang nhu text-chip cu.
export const NODE_CATEGORY_ICON: Record<string, ReactNode> = {
  all: <LayoutGrid size={14} />,
  io: <LogIn size={14} />,
  content: <FileText size={14} />,
  data: <Braces size={14} />,
  logic: <GitBranch size={14} />,
  ai: <Sparkles size={14} />,
  integration: <Globe size={14} />,
}

// 2026-07-26i: truong config "chinh" cua 1 node - da dung o WorkflowHubEditorCanvas (o nhap inline
// tren khoi node) tu 26/07 buoi truoc, gio dung chung (export tu day) de WorkflowHubInspectorNode
// cung biet ma an truong nay di trong bang config chung, tranh hien trung lap 2 noi cung sua 1 gia tri.
export function primaryInlineEditableKey(type: WorkflowNodeType): string | null {
  if (type === 'prompt') return 'template'
  if (type === 'input') return 'fields'
  if (type === 'template') return 'template'
  return null
}

// 2026-07-28: chieu rong THAT cua khoi node tren canvas theo tung loai - dung chung 1 noi cho
// ca render (WorkflowHubEditorCanvas.tsx) lan cong thuc dat vi tri node moi (useWorkflowHubCanvasActions.ts).
// Truoc day 2 noi tu dinh nghia rieng (canvas hardcode width trong style, con cong thuc dat vi tri
// dung "+260" co dinh gia dinh moi node rong ~196px) - khi node Input duoc mo rong len 264px (muc 14)
// va node Anh/Video len 236px (phien nay) ma khong cap nhat cong thuc dat vi tri, node moi them vao
// bi chong len canh phai cua node truoc (Input 264px > khoang cach 260px danh san), che mat luon
// cham noi canh (.wf-node-handle-out) cua node do - day la nguyen nhan Sep bao "khong tao ket noi
// duoc" (khong phai chi do stopPropagation nhu doan dau, du fix do van dung va giu nguyen).
export function nodeCardWidth(type: WorkflowNodeType, aspectRatio?: string): number {
  if (type === 'input') return 264
  if (type === 'image' || type === 'video') {
    const [rawWidth, rawHeight] = String(aspectRatio || (type === 'video' ? '16:9' : '1:1'))
      .split(':')
      .map(Number)
    const ratio = rawWidth > 0 && rawHeight > 0 ? rawWidth / rawHeight : (type === 'video' ? 16 / 9 : 1)
    if (ratio >= 1.6) return 560
    if (ratio >= 1.15) return 480
    if (ratio >= 0.9) return 420
    return 360
  }
  return 196
}

export function nodeCardEstimatedHeight(type: WorkflowNodeType, aspectRatio?: string): number {
  if (type !== 'image' && type !== 'video') return type === 'input' ? 320 : 220
  const width = nodeCardWidth(type, aspectRatio)
  const [rawWidth, rawHeight] = String(aspectRatio || (type === 'video' ? '16:9' : '1:1'))
    .split(':')
    .map(Number)
  const ratio = rawWidth > 0 && rawHeight > 0 ? rawWidth / rawHeight : (type === 'video' ? 16 / 9 : 1)
  return Math.round(width / ratio) + 170
}

// 2026-08-02: node thuoc 1 "Khung" (Frame) neu DIEM GIUA node nam trong bien khung - tinh dong
// theo vi tri hien tai (khong luu danh sach id rieng), nen keo node ra/vao khung tu dong cap nhat
// thanh vien ma khong can dong bo state o dau khac.
export function nodesInFrame<T extends { x: number; y: number; type: WorkflowNodeType; config: Record<string, string> }>(
  frame: { x: number; y: number; width: number; height: number },
  nodes: T[],
): T[] {
  return nodes.filter((node) => {
    const width = nodeCardWidth(node.type, node.config.aspect_ratio)
    const height = nodeCardEstimatedHeight(node.type, node.config.aspect_ratio)
    const centerX = node.x + width / 2
    const centerY = node.y + height / 2
    return centerX >= frame.x && centerX <= frame.x + frame.width && centerY >= frame.y && centerY <= frame.y + frame.height
  })
}

export const CANVAS_WIDTH = 1240
export const CANVAS_HEIGHT = 620

// 2026-07-27e: Sep phat hien "diem chan vo hinh" khi keo node ra xa sau khi da zoom out (video +
// anh khoanh do 0727) - clampPosition() ben duoi truoc day gioi han cung node.x/y vao dung
// CANVAS_WIDTH-220 / CANVAS_HEIGHT-120 (1020/500), bat ke da zoom ra bao nhieu hay canvasSize
// (xem WorkflowHub.tsx) da tu gian rong theo node thuc te chua - nen dung dung ngay bien vo hinh
// nay du man hinh con trong. Tach rieng 1 cap GIOI HAN KEO THA lon hon nhieu (khong dung chung
// CANVAS_WIDTH/HEIGHT nua, vi 2 hang so do van con duoc dung lam kich thuoc TOI THIEU o noi khac)
// de nguoi dung keo node ra xa thoai mai nhu cac app tham khao, canvasSize se tu gian theo sau.
export const CANVAS_DRAG_MAX_WIDTH = 6000
export const CANVAS_DRAG_MAX_HEIGHT = 4000

export const NODE_TYPE_COLORS: Record<WorkflowNodeType, string> = {
  input: '#38bdf8',
  prompt: '#a78bfa',
  set: '#60a5fa',
  json: '#2dd4bf',
  template: '#c084fc',
  array: '#14b8a6',
  map: '#0ea5e9',
  merge: '#8b5cf6',
  for_each: '#f43f5e',
  image: '#f472b6',
  video: '#f59e0b',
  tts: '#34d399',
  lipsync: '#22d3ee',
  http: '#94a3b8',
  browser: '#0891b2',
  condition: '#fb7185',
  subflow: '#f97316',
  output: '#4ade80',
}

export function mediaLabel(media: WorkflowMedia) {
  switch (media) {
    case 'image':
      return 'Ảnh'
    case 'video':
      return 'Video'
    case 'hybrid':
      return 'Hybrid'
    default:
      return 'Automation'
  }
}

export function relativeTime(iso: string) {
  const diff = Date.now() - Date.parse(iso)
  if (Number.isNaN(diff)) return iso
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return `${days} ngày trước`
}

// 2026-07-26i: truoc chi co 4 icon rieng (image/video/prompt/con lai dung chung Boxes) - kho phan biet
// khi liet ke ca 17 loai node trong bang tim-kiem-them-node moi. Moi loai gio co icon rieng de quet
// mat nhanh hon, dong bo voi nhom NODE_TYPE_CATEGORY o tren.
export function nodeIcon(type: WorkflowNodeType): ReactNode {
  const size = 14
  switch (type) {
    case 'input':
      return <LogIn size={size} />
    case 'output':
      return <LogOut size={size} />
    case 'prompt':
      return <Wand2 size={size} />
    case 'template':
      return <FileText size={size} />
    case 'set':
      return <SlidersHorizontal size={size} />
    case 'json':
      return <Braces size={size} />
    case 'array':
      return <ListOrdered size={size} />
    case 'map':
      return <ArrowRightLeft size={size} />
    case 'merge':
      return <GitMerge size={size} />
    case 'for_each':
      return <Repeat size={size} />
    case 'image':
      return <ImageIcon size={size} />
    case 'video':
      return <Video size={size} />
    case 'tts':
      return <Mic size={size} />
    case 'lipsync':
      return <Smile size={size} />
    case 'http':
      return <Globe size={size} />
    case 'browser':
      return <AppWindow size={size} />
    case 'condition':
      return <GitBranch size={size} />
    case 'subflow':
      return <Layers size={size} />
    default:
      return <Boxes size={size} />
  }
}

export function clampPosition(x: number, y: number) {
  // 2026-07-27e: dung CANVAS_DRAG_MAX_WIDTH/HEIGHT (bien vo hinh o day, xem ghi chu tren dinh nghia)
  // thay vi CANVAS_WIDTH/HEIGHT - workflow nho van hien vua khung mac dinh (canvasSize trong
  // WorkflowHub.tsx tu co lai theo node that), nhung gio keo node ra xa se khong bi chan som nua.
  return {
    x: Math.max(24, Math.min(CANVAS_DRAG_MAX_WIDTH - 220, x)),
    y: Math.max(24, Math.min(CANVAS_DRAG_MAX_HEIGHT - 120, y)),
  }
}

export function statusLabel(status: WorkflowRun['status']) {
  switch (status) {
    case 'queued':
      return 'Đang xếp hàng'
    case 'running':
      return 'Đang chạy'
    case 'succeeded':
      return 'Hoàn tất'
    default:
      return 'Thất bại'
  }
}

export function statusClass(status: WorkflowRun['status']) {
  switch (status) {
    case 'queued':
      return 'is-queued'
    case 'running':
      return 'is-running'
    case 'succeeded':
      return 'is-succeeded'
    default:
      return 'is-failed'
  }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Có lỗi xảy ra'
}

export function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '—'
  if (value < 1000) return `${Math.round(value)}ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`
  return `${(value / 60000).toFixed(1)}m`
}

export function previewWorkflowMetadataEntries(workflow: WorkflowDefinition) {
  return Object.entries(parseWorkflowMetadata(workflow)).map(([key, value]) => [
    key,
    typeof value === 'string' ? value : prettyJson(value),
  ] as [string, string])
}

export function stringifyWorkflowTags(tags: string[]) {
  return tags.map((tag) => String(tag || '').trim()).filter(Boolean)
}

export function mergeWorkflowTags(...groups: Array<string[] | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const group of groups) {
    for (const raw of group || []) {
      const tag = String(raw || '').trim()
      if (!tag || seen.has(tag)) continue
      seen.add(tag)
      result.push(tag)
    }
  }
  return result
}

export function inputFieldLabel(field: string) {
  const labels: Record<string, string> = {
    prompt: 'Nội dung bạn muốn tạo',
    scene_description: 'Scene description',
    reference_image: 'Ảnh tham chiếu',
    mask_image: 'Mask chỉnh sửa',
    image_url: 'URL ảnh',
    video_url: 'URL video',
    audio_url: 'URL audio',
    media_type: 'Media type',
    aspect_ratio: 'Aspect ratio',
    ratio: 'Tỷ lệ',
    duration: 'Duration (giây)',
    camera_angle: 'Camera angle',
    target_language: 'Ngôn ngữ đích',
    topic: 'Topic',
    channel: 'Channel',
    slug: 'Slug',
    tool_id: 'Tool ID',
  }
  return labels[field] || field.replace(/_/g, ' ')
}

export function defaultRunFieldValue(field: string) {
  switch (field) {
    case 'aspect_ratio':
    case 'ratio':
      return '16:9'
    case 'duration':
      return '5'
    case 'media_type':
      return 'image'
    default:
      return ''
  }
}

export function inputFieldPlaceholder(field: string) {
  switch (field) {
    case 'prompt':
      return 'Ví dụ: cô gái tóc dài đứng trên bãi biển lúc hoàng hôn...'
    case 'reference_image':
    case 'mask_image':
    case 'image_url':
    case 'video_url':
    case 'audio_url':
      return 'https://...'
    case 'aspect_ratio':
    case 'ratio':
      return '16:9'
    case 'media_type':
      return 'image hoặc video'
    case 'duration':
      return '5'
    default:
      return ''
  }
}

export function inputFieldHint(field: string) {
  // 2026-07-28: rut gon het muc, bo doan giai thich dai dong (Sep phan anh "thua") - chi con
  // dung 1 dong ngan nhat co the, dung cho ca luc chay thu tung node lan chay ca workflow.
  if (field === 'prompt') {
    return 'Dùng khi bấm "Chạy workflow" (chạy cả chuỗi node).'
  }
  return ''
}

export function isUploadableField(field: string) {
  return field === 'reference_image' || field === 'mask_image' || field === 'image_url' || field === 'video_url' || field === 'audio_url'
}

export function fileAcceptForField(field: string) {
  if (field === 'video_url') return 'video/*'
  if (field === 'audio_url') return 'audio/*'
  return 'image/*'
}

export function uploadKindForField(field: string): 'image' | 'video' {
  return field === 'video_url' ? 'video' : 'image'
}

export function uploadLabelForField(field: string) {
  if (field === 'video_url') return 'Tải video'
  if (field === 'audio_url') return 'Tải audio'
  return 'Tải ảnh'
}

export function isLongTextField(field: string) {
  return ['prompt', 'scene_description', 'negative_prompt'].includes(field)
}

export function nextConditionBranch(edges: WorkflowEdge[], sourceId: string): WorkflowEdgeBranch {
  const branches = edges
    .filter((edge) => edge.source === sourceId)
    .map((edge) => edge.branch)
  if (!branches.includes('true')) return 'true'
  if (!branches.includes('false')) return 'false'
  return 'always'
}

export function validationIssueLines(messages: { message: string }[]) {
  return messages.map((item) => `- ${item.message}`).join('\n')
}
