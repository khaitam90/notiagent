import { generateId } from './uuid'
export type StudioAssetKind = 'image' | 'video' | 'link'

export type StudioAsset = {
  id: string
  kind: StudioAssetKind
  name: string
  url: string
  preview?: string
  /** null/undefined = Studio chung; có id = thuộc không gian dự án */
  projectId?: string | null
  createdAt: string
}

const STORAGE_KEY = 'noti-studio-assets-v1'
/** Tab「Đã tải lên」— chỉ upload thủ công qua uploadMedia(), không lưu sản phẩm AI */
const LEGACY_SESSION_KEY = 'noti-studio-assets-v1'
const MAX_ASSETS = 300

export const STUDIO_ASSETS_EVENT = 'noti-studio-assets-changed'

function emitAssetsChanged() {
  window.dispatchEvent(new CustomEvent(STUDIO_ASSETS_EVENT))
}

function readRaw(): StudioAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StudioAsset[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function migrateFromSessionStorage() {
  try {
    const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY)
    if (!legacy) return
    const parsed = JSON.parse(legacy) as StudioAsset[]
    if (!Array.isArray(parsed) || !parsed.length) {
      sessionStorage.removeItem(LEGACY_SESSION_KEY)
      return
    }
    const merged = [...parsed, ...readRaw()]
    const byUrl = new Map<string, StudioAsset>()
    for (const a of merged) {
      if (!a?.url?.startsWith('http')) continue
      const prev = byUrl.get(a.url)
      if (!prev || a.createdAt >= prev.createdAt) byUrl.set(a.url, a)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(
      Array.from(byUrl.values()).sort((x, y) => y.createdAt.localeCompare(x.createdAt)).slice(0, MAX_ASSETS),
    ))
    sessionStorage.removeItem(LEGACY_SESSION_KEY)
    emitAssetsChanged()
  } catch {
    /* ignore */
  }
}

migrateFromSessionStorage()

export function loadStudioAssets(): StudioAsset[] {
  return readRaw()
    .filter((a) => a?.url?.startsWith('http'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function saveStudioAssets(list: StudioAsset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ASSETS)))
  emitAssetsChanged()
}

export function loadStudioAssetsForProject(projectId: string): StudioAsset[] {
  return loadStudioAssets().filter((a) => a.projectId === projectId)
}

export function countAssetsForProject(projectId: string): number {
  return loadStudioAssetsForProject(projectId).length
}

export function registerStudioUpload(input: {
  kind: StudioAssetKind
  name: string
  url: string
  preview?: string
  projectId?: string | null
}): StudioAsset {
  if (!input.url.startsWith('http')) {
    throw new Error('Chỉ lưu URL CDN http(s)')
  }
  const cleanName = input.name.replace(/\.[^.]+$/, '').slice(0, 48) || (input.kind === 'video' ? 'Video' : 'Ảnh')
  const list = loadStudioAssets()
  const existing = list.find((a) => a.url === input.url)
  if (existing) {
    const updated: StudioAsset = {
      ...existing,
      name: cleanName,
      kind: input.kind,
      preview: input.preview ?? existing.preview ?? (input.kind === 'image' ? input.url : undefined),
      createdAt: new Date().toISOString(),
    }
    saveStudioAssets([updated, ...list.filter((a) => a.id !== existing.id)])
    return updated
  }
  const asset: StudioAsset = {
    id: generateId(),
    kind: input.kind,
    name: cleanName,
    url: input.url,
    preview: input.preview ?? (input.kind === 'image' ? input.url : undefined),
    projectId: input.projectId ?? null,
    createdAt: new Date().toISOString(),
  }
  saveStudioAssets([asset, ...list])
  return asset
}

/** @deprecated dùng registerStudioUpload — giữ tương thích @mention */
export function addStudioAsset(input: {
  kind: StudioAssetKind
  name: string
  url: string
  preview?: string
}): StudioAsset {
  return registerStudioUpload(input)
}

export function removeStudioAsset(id: string) {
  saveStudioAssets(loadStudioAssets().filter((a) => a.id !== id))
}

export function clearStudioAssets() {
  localStorage.removeItem(STORAGE_KEY)
  emitAssetsChanged()
}

export function findStudioAsset(id: string): StudioAsset | undefined {
  return loadStudioAssets().find((a) => a.id === id)
}

export function parseMentionIds(text: string): string[] {
  const ids: string[] = []
  const re = /@\[([^\]]+)\]\(asset:([a-f0-9-]+)\)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) ids.push(m[2])
  return ids
}

export function mentionToken(asset: StudioAsset): string {
  return `@${asset.name}`
}

export function mentionInsertText(asset: StudioAsset): string {
  return `@[${asset.name}](asset:${asset.id}) `
}
