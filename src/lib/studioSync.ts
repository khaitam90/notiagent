/** Đồng bộ「Tài sản」(sản phẩm AI + dự án) giữa trình duyệt và cloud VPS (studio_sync.py). */
import {
  loadStudioProducts,
  replaceStudioProducts,
  popStudioDeletedIds,
  clearStudioDeletedIds,
  type StudioProduct,
} from './studioProductLibrary'
import { loadStudioProjects, saveStudioProjects, type StudioProject } from './studioProjects'
import { loadStudioStorageSettings } from './studioStorageSettings'

const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

function itemTime(item: { createdAt?: string; updatedAt?: string }): string {
  return item.updatedAt || item.createdAt || ''
}

/** Gộp local + remote theo id, giữ bản mới hơn (so createdAt/updatedAt). Union theo url để không trùng. */
function mergeById<T extends { id: string; url?: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>()
  const order: string[] = []
  for (const item of [...remote, ...local]) {
    const prev = byId.get(item.id)
    if (!prev) {
      byId.set(item.id, item)
      order.push(item.id)
      continue
    }
    if (itemTime(item as { createdAt?: string }) >= itemTime(prev as { createdAt?: string })) {
      byId.set(item.id, item)
    }
  }
  return order.map((id) => byId.get(id)!).filter(Boolean)
}

/** Kéo dữ liệu cloud VPS về, gộp với local (không mất dữ liệu 2 bên). */
export async function pullStudioCloud(): Promise<{ products: number; projects: number }> {
  const r = await fetch(`${API_BASE}/api/studio/sync/pull`)
  if (!r.ok) throw new Error(await r.text())
  const data = (await r.json()) as { ok: boolean; products?: StudioProduct[]; projects?: StudioProject[] }
  const remoteProducts = data.products ?? []
  const remoteProjects = data.projects ?? []

  const mergedProducts = mergeById(loadStudioProducts(), remoteProducts)
  const mergedProjects = mergeById(
    loadStudioProjects() as (StudioProject & { id: string })[],
    remoteProjects as (StudioProject & { id: string })[],
  )

  replaceStudioProducts(mergedProducts)
  saveStudioProjects(mergedProjects as StudioProject[])
  return { products: mergedProducts.length, projects: mergedProjects.length }
}

/** Đẩy toàn bộ local (+ tombstone id đã xóa) lên cloud VPS. */
export async function pushStudioCloud(): Promise<{ ok: boolean }> {
  const products = loadStudioProducts()
  const projects = loadStudioProjects()
  const deleted = popStudioDeletedIds()

  const r = await fetch(`${API_BASE}/api/studio/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ products, projects, deleted, deleted_urls: [] }),
  })
  if (!r.ok) {
    // Đẩy thất bại — trả lại tombstone để lần sau thử lại, tránh mất dữ liệu xóa.
    deleted.forEach((id) => {
      try {
        const raw = localStorage.getItem('noti-studio-products-deleted-v1')
        const list: string[] = raw ? JSON.parse(raw) : []
        if (!list.includes(id)) list.push(id)
        localStorage.setItem('noti-studio-products-deleted-v1', JSON.stringify(list))
      } catch { /* ignore */ }
    })
    throw new Error(await r.text())
  }
  clearStudioDeletedIds()
  return { ok: true }
}

let pushTimer: number | undefined

/** Gọi sau khi xóa sản phẩm/thư viện — debounce rồi đẩy tombstone lên cloud (nếu bật đồng bộ). */
export function scheduleStudioCloudPushAfterDelete() {
  const settings = loadStudioStorageSettings()
  if (!settings.cloudSyncEnabled) return
  if (pushTimer) window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    void pushStudioCloud().catch(() => { /* thử lại ở lần sync kế tiếp */ })
  }, 1500)
}
