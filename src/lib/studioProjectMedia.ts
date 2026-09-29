import { loadStudioAssetsForProject, type StudioAsset } from './studioAssetLibrary'
import { loadStudioProductsForProject, type StudioProduct } from './studioProductLibrary'

export type ProjectMediaItem = {
  id: string
  kind: 'image' | 'video'
  name: string
  url: string
  preview?: string
  createdAt: string
  source: 'upload' | 'product'
  assetId?: string
  productId?: string
}

function assetToProjectMediaItem(a: StudioAsset): ProjectMediaItem {
  return {
    id: `upload-${a.id}`,
    kind: a.kind as 'image' | 'video',
    name: a.name,
    url: a.url,
    preview: a.preview,
    createdAt: a.createdAt,
    source: 'upload',
    assetId: a.id,
  }
}

function productToProjectMediaItem(p: StudioProduct): ProjectMediaItem {
  return {
    id: `product-${p.id}`,
    kind: p.kind,
    name: p.title,
    url: p.url,
    preview: p.thumbnail,
    createdAt: p.createdAt,
    source: 'product',
    productId: p.id,
  }
}

/** Chỉ tài liệu tải lên thủ công trong dự án — tab「Tải lên」 */
export function loadProjectUploads(projectId: string): ProjectMediaItem[] {
  return loadStudioAssetsForProject(projectId)
    .filter((a) => a.kind === 'image' || a.kind === 'video')
    .map(assetToProjectMediaItem)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Upload + sản phẩm AI — dùng cho bảng chọn「+」trong Studio */
export function loadProjectMedia(projectId: string): ProjectMediaItem[] {
  const uploads = loadProjectUploads(projectId)
  const products = loadStudioProductsForProject(projectId).map(productToProjectMediaItem)

  const byUrl = new Map<string, ProjectMediaItem>()
  for (const item of [...uploads, ...products]) {
    const prev = byUrl.get(item.url)
    if (!prev || item.createdAt >= prev.createdAt) byUrl.set(item.url, item)
  }
  return Array.from(byUrl.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function projectMediaToAsset(item: ProjectMediaItem): StudioAsset {
  return {
    id: item.assetId ?? item.id,
    kind: item.kind,
    name: item.name,
    url: item.url,
    preview: item.preview,
    createdAt: item.createdAt,
  }
}
