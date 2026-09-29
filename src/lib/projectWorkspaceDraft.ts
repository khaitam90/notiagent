export type WorkspacePreviewDraft = {
  taskId?: string
  message?: string
  status?: string
  imageUrl?: string
  imageUrls?: string[]
  videoUrl?: string
  /** ISO — khi bắt đầu pending; dùng phát hiện draft treo */
  pendingAt?: string
}

export type WorkspaceDraft = {
  panel?: string
  mode?: string
  toolId?: string
  imagePresetId?: string
  ratio?: string
  duration?: number
  preview?: WorkspacePreviewDraft | null
  updatedAt?: string
}

/** Khớp proxy_read_timeout nginx (300s) + buffer */
export const PREVIEW_PENDING_MAX_MS = 12 * 60 * 1000
const FALSE_STALE_ERROR_RE = /Phiên render đã hết hạn|không có phản hồi/i

const GLOBAL_DRAFT_KEY = 'noti-studio-global-draft-v1'
const PROJECT_DRAFT_PREFIX = 'noti-project-workspace-draft-v1-'

function projectDraftKey(projectId: string) {
  return `${PROJECT_DRAFT_PREFIX}${projectId}`
}

function readRaw(key: string): WorkspaceDraft | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as WorkspaceDraft) : null
  } catch {
    return null
  }
}

function writeRaw(key: string, draft: WorkspaceDraft) {
  localStorage.setItem(
    key,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
  )
}

export function stampPendingPreview(
  preview: Omit<WorkspacePreviewDraft, 'pendingAt'> & { status?: string },
): WorkspacePreviewDraft {
  return { ...preview, status: 'pending', pendingAt: new Date().toISOString() }
}

export function isFalseStaleErrorPreview(preview: WorkspacePreviewDraft | null | undefined): boolean {
  return !!(preview?.status === 'error' && preview.taskId && FALSE_STALE_ERROR_RE.test(preview.message || ''))
}

/** Chuẩn hóa preview pending trước khi app đọc — tránh false-positive stale */
export function normalizePendingPreview(
  preview: WorkspacePreviewDraft | null | undefined,
  draftUpdatedAt?: string,
): WorkspacePreviewDraft | null {
  if (!preview) return null

  // Bundle cũ từng tự chuyển pending -> error sai dù task vẫn còn sống.
  if (isFalseStaleErrorPreview(preview)) {
    return {
      ...preview,
      status: 'pending',
      message: 'Đang render — đang kiểm tra lại tiến độ…',
      pendingAt: preview.pendingAt || draftUpdatedAt || new Date().toISOString(),
    }
  }

  if (preview.status !== 'pending') return preview

  if (!preview.taskId) return null

  if (!preview.pendingAt) {
    return {
      ...preview,
      pendingAt: draftUpdatedAt || new Date().toISOString(),
    }
  }
  return preview
}

export function isStalePendingPreview(preview: WorkspacePreviewDraft | null | undefined): boolean {
  if (!preview || preview.status !== 'pending') return false
  if (!preview.taskId) return true
  const at = preview.pendingAt
  if (!at) return false
  return Date.now() - new Date(at).getTime() > PREVIEW_PENDING_MAX_MS
}

export function stalePendingErrorPreview(preview: WorkspacePreviewDraft): WorkspacePreviewDraft {
  const started = preview.pendingAt ? new Date(preview.pendingAt).getTime() : Date.now()
  const mins = Math.max(1, Math.round((Date.now() - started) / 60_000))
  return {
    status: 'error',
    taskId: preview.taskId,
    message: `Phiên render đã hết hạn (${mins} phút không có phản hồi). Bấm Tạo lại.`,
  }
}

function normalizeDraft(draft: WorkspaceDraft | null): WorkspaceDraft | null {
  if (!draft) return null
  const preview = normalizePendingPreview(draft.preview ?? null, draft.updatedAt)
  if (preview === draft.preview) return draft
  return { ...draft, preview }
}

export function loadGlobalStudioDraft(): WorkspaceDraft | null {
  return normalizeDraft(readRaw(GLOBAL_DRAFT_KEY))
}

export function saveGlobalStudioDraft(draft: WorkspaceDraft) {
  writeRaw(GLOBAL_DRAFT_KEY, draft)
}

export function loadProjectWorkspaceDraft(projectId: string): WorkspaceDraft | null {
  return normalizeDraft(readRaw(projectDraftKey(projectId)))
}

export function saveProjectWorkspaceDraft(projectId: string, draft: WorkspaceDraft) {
  writeRaw(projectDraftKey(projectId), draft)
}

export function listPendingVideoTaskIds(): string[] {
  const ids = new Set<string>()
  const g = loadGlobalStudioDraft()
  if (g?.preview?.status === 'pending' && g.preview.taskId) ids.add(g.preview.taskId)
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith(PROJECT_DRAFT_PREFIX)) continue
      const d = readRaw(key)
      const p = normalizePendingPreview(d?.preview ?? null, d?.updatedAt)
      if (p?.status === 'pending' && p.taskId) ids.add(p.taskId)
    }
  } catch {
    /* ignore */
  }
  return [...ids]
}
