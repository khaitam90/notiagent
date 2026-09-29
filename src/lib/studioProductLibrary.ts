import { generateId } from './uuid'
export type StudioProductKind = 'video' | 'image'

export type StudioProductSource = 'create' | 'pro' | 'tools' | 'editor' | 'upload'

export type StudioProduct = {
  id: string
  kind: StudioProductKind
  url: string
  thumbnail?: string
  title: string
  prompt?: string
  model?: string
  ratio?: string
  durationSec?: number
  taskId?: string
  source: StudioProductSource
  createdAt: string
  /** null/undefined = Studio chung; có id = thuộc không gian dự án (tab「Dự án」) */
  projectId?: string | null
}

const STORAGE_KEY = 'noti-studio-products-v1'
const MAX_ITEMS = 200
export const STUDIO_PRODUCTS_EVENT = 'studio-products-updated'

/** Tombstone id đã xóa — dùng để đồng bộ cloud (studioSync.ts) không "sống lại" item đã xóa. */
const DELETED_KEY = 'noti-studio-products-deleted-v1'
const MAX_DELETED = 2000

function notify() {
  window.dispatchEvent(new CustomEvent(STUDIO_PRODUCTS_EVENT))
}

function addTombstone(id: string) {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    const list: string[] = raw ? JSON.parse(raw) : []
    if (!list.includes(id)) list.push(id)
    localStorage.setItem(DELETED_KEY, JSON.stringify(list.slice(-MAX_DELETED)))
  } catch { /* ignore */ }
}

/** Lấy + xoá danh sách id đã xóa chờ đồng bộ lên cloud. Dùng trong studioSync.ts. */
export function popStudioDeletedIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function clearStudioDeletedIds() {
  localStorage.removeItem(DELETED_KEY)
}

/** Đồng bộ thư viện giữa các tab cùng origin (storage) + trong tab (custom event). */
export function subscribeStudioProducts(cb: () => void) {
  const handler = () => cb()
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) handler()
  }
  window.addEventListener(STUDIO_PRODUCTS_EVENT, handler)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(STUDIO_PRODUCTS_EVENT, handler)
    window.removeEventListener('storage', onStorage)
  }
}

export function loadStudioProducts(): StudioProduct[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StudioProduct[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function loadStudioProductsForProject(projectId: string): StudioProduct[] {
  return loadStudioProducts().filter((p) => p.projectId === projectId)
}

export function countProductsForProject(projectId: string): number {
  return loadStudioProductsForProject(projectId).length
}

function save(list: StudioProduct[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)))
  notify()
}

/** Ghi đè toàn bộ danh sách (dùng khi merge cloud trong studioSync.ts). */
export function replaceStudioProducts(list: StudioProduct[]) {
  save(list)
}

export function deleteStudioProduct(id: string) {
  addTombstone(id)
  save(loadStudioProducts().filter((p) => p.id !== id))
}

export function clearStudioProducts() {
  loadStudioProducts().forEach((p) => addTombstone(p.id))
  save([])
}

export function findStudioProduct(id: string): StudioProduct | undefined {
  return loadStudioProducts().find((p) => p.id === id)
}

export type SaveStudioProductInput = {
  kind: StudioProductKind
  url: string
  thumbnail?: string
  title?: string
  prompt?: string
  model?: string
  ratio?: string
  durationSec?: number
  taskId?: string
  source: StudioProductSource
  projectId?: string | null
}

/** Tự lưu sản phẩm AI — dedupe theo URL */
export function saveStudioProduct(input: SaveStudioProductInput): StudioProduct | null {
  const url = input.url?.trim()
  if (!url || url.startsWith('blob:')) return null

  const list = loadStudioProducts()
  const existing = list.find((p) => p.url === url)
  if (existing) {
    const updated: StudioProduct = {
      ...existing,
      title: input.title || existing.title,
      prompt: input.prompt ?? existing.prompt,
      model: input.model ?? existing.model,
      ratio: input.ratio ?? existing.ratio,
      durationSec: input.durationSec ?? existing.durationSec,
      taskId: input.taskId ?? existing.taskId,
      projectId: input.projectId !== undefined ? input.projectId : existing.projectId,
      createdAt: new Date().toISOString(),
    }
    save([updated, ...list.filter((p) => p.id !== existing.id)])
    return updated
  }

  const product: StudioProduct = {
    id: generateId(),
    kind: input.kind,
    url,
    thumbnail: input.thumbnail ?? (input.kind === 'image' ? url : undefined),
    title: input.title?.trim() || defaultTitle(input),
    prompt: input.prompt,
    model: input.model,
    ratio: input.ratio,
    durationSec: input.durationSec,
    taskId: input.taskId,
    source: input.source,
    createdAt: new Date().toISOString(),
    projectId: input.projectId ?? null,
  }
  save([product, ...list])
  return product
}

function defaultTitle(input: SaveStudioProductInput): string {
  const date = new Date().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  if (input.kind === 'video') return `Video AI · ${date}`
  return `Ảnh AI · ${date}`
}

const SOURCE_LABEL: Record<StudioProductSource, string> = {
  create: 'Studio Tạo',
  pro: 'Studio Pro',
  tools: 'Công cụ',
  editor: 'Timeline Editor',
  upload: 'Upload',
}

export function productSourceLabel(source: StudioProductSource): string {
  return SOURCE_LABEL[source] ?? source
}

/** Gọi khi preview render xong từ Studio AI */
export function saveStudioProductFromPreview(
  preview: {
    videoUrl?: string
    imageUrl?: string
    imageUrls?: string[]
    message?: string
    taskId?: string
    status?: string
  },
  meta: {
    source: StudioProductSource
    model?: string
    ratio?: string
    durationSec?: number
    prompt?: string
    resolution?: string
    projectId?: string | null
  },
) {
  if (preview.status === 'error' || preview.status === 'pending' || preview.status === 'timeout') return null
  const imageUrls = preview.imageUrls?.filter((u) => u && !u.startsWith('blob:'))
  if (imageUrls?.length) {
    let last: StudioProduct | null = null
    imageUrls.forEach((url, i) => {
      last = saveStudioProduct({
        kind: 'image',
        url,
        thumbnail: url,
        title: imageUrls.length > 1
          ? `${preview.message?.slice(0, 60) || 'Ảnh AI'} · #${i + 1}`
          : preview.message?.slice(0, 80),
        prompt: meta.prompt,
        model: meta.model,
        ratio: meta.ratio,
        taskId: preview.taskId,
        source: meta.source,
        projectId: meta.projectId,
      })
    })
    return last
  }
  const url = preview.videoUrl || preview.imageUrl
  if (!url) return null
  return saveStudioProduct({
    kind: preview.videoUrl ? 'video' : 'image',
    url,
    thumbnail: preview.imageUrl || undefined,
    title: preview.message?.slice(0, 80),
    prompt: meta.prompt,
    model: meta.model,
    ratio: meta.ratio,
    durationSec: meta.durationSec,
    taskId: preview.taskId,
    source: meta.source,
    projectId: meta.projectId,
  })
}
