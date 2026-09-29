const KEY = 'noti-studio-storage-settings-v1'
export const STUDIO_STORAGE_SETTINGS_EVENT = 'noti-studio-storage-settings-changed'

export type StudioStorageSettings = {
  /** Tự lưu ảnh/video AI vào tab「Tài sản」khi render xong */
  autoSaveOutputs: boolean
  /** Lưu từng biến thể ảnh (2–4) thành mục riêng trong「Tài sản」 */
  saveAllVariants: boolean
  /** Đồng bộ metadata「Tài sản」lên VPS (studio_sync) */
  cloudSyncEnabled: boolean
  /** Push cloud ngay sau mỗi lần lưu sản phẩm */
  cloudSyncOnSave: boolean
}

export const STUDIO_STORAGE_DEFAULTS: StudioStorageSettings = {
  autoSaveOutputs: true,
  saveAllVariants: true,
  cloudSyncEnabled: true,
  cloudSyncOnSave: true,
}

/** Thông tin cố định — mirror backend / docker mount */
export const STUDIO_STORAGE_PATHS = {
  vpsUploads: '/root/codex-workspace/deploy/notiagent-api/data/uploads',
  vpsCloudSync: '/root/codex-workspace/deploy/notiagent-api/data/sync',
  cdnPublicBase: 'https://notiagent.ai.vn/api-proxy/api/media',
  browserProductsKey: 'noti-studio-products-v1',
  browserAssetsKey: 'noti-studio-assets-v1',
} as const

export function loadStudioStorageSettings(): StudioStorageSettings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...STUDIO_STORAGE_DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<StudioStorageSettings>
    return {
      autoSaveOutputs: parsed.autoSaveOutputs ?? STUDIO_STORAGE_DEFAULTS.autoSaveOutputs,
      saveAllVariants: parsed.saveAllVariants ?? STUDIO_STORAGE_DEFAULTS.saveAllVariants,
      cloudSyncEnabled: parsed.cloudSyncEnabled ?? STUDIO_STORAGE_DEFAULTS.cloudSyncEnabled,
      cloudSyncOnSave: parsed.cloudSyncOnSave ?? STUDIO_STORAGE_DEFAULTS.cloudSyncOnSave,
    }
  } catch {
    return { ...STUDIO_STORAGE_DEFAULTS }
  }
}

export function saveStudioStorageSettings(data: StudioStorageSettings) {
  localStorage.setItem(KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(STUDIO_STORAGE_SETTINGS_EVENT))
}

export function storageLayerSummary(settings: StudioStorageSettings): string {
  const layers: string[] = ['Trình duyệt']
  if (settings.cloudSyncEnabled) layers.push('Cloud VPS')
  layers.push('CDN provider (Fal/Kie)')
  return layers.join(' · ')
}
