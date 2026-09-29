import { useCallback, useEffect, useState } from 'react'
import { Cloud, CloudOff, HardDrive, Loader2, RefreshCw, Settings2 } from 'lucide-react'
import {
  STUDIO_STORAGE_PATHS,
  STUDIO_STORAGE_SETTINGS_EVENT,
  loadStudioStorageSettings,
  saveStudioStorageSettings,
  storageLayerSummary,
  type StudioStorageSettings,
} from '../../lib/studioStorageSettings'
import { pullStudioCloud, pushStudioCloud } from '../../lib/studioSync'

type Props = {
  compact?: boolean
}

export default function StudioStorageSettingsPanel({ compact = false }: Props) {
  const [settings, setSettings] = useState<StudioStorageSettings>(() => loadStudioStorageSettings())
  const [open, setOpen] = useState(!compact)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  const refresh = useCallback(() => setSettings(loadStudioStorageSettings()), [])

  useEffect(() => {
    const onChange = () => refresh()
    window.addEventListener(STUDIO_STORAGE_SETTINGS_EVENT, onChange)
    return () => window.removeEventListener(STUDIO_STORAGE_SETTINGS_EVENT, onChange)
  }, [refresh])

  const patch = (partial: Partial<StudioStorageSettings>) => {
    const next = { ...settings, ...partial }
    setSettings(next)
    saveStudioStorageSettings(next)
  }

  const syncNow = async (mode: 'pull' | 'push') => {
    setSyncing(true)
    setSyncMsg(null)
    try {
      if (mode === 'pull') await pullStudioCloud()
      else await pushStudioCloud()
      setSyncMsg(mode === 'pull' ? 'Đã kéo cloud → trình duyệt' : 'Đã đẩy trình duyệt → cloud')
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  return (
    <section className={`sh-storage${compact ? ' compact' : ''}`}>
      <button
        type="button"
        className="sh-storage-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Settings2 size={16} />
        <span>Cấu hình lưu trữ「Tài sản」</span>
        <small>{storageLayerSummary(settings)}</small>
      </button>

      {open && (
        <div className="sh-storage-body">
          <div className="sh-storage-layers">
            <div className="sh-storage-layer">
              <HardDrive size={18} />
              <div>
                <strong>Tab「Tài sản」</strong>
                <p>Ảnh/video AI render xong — metadata trình duyệt</p>
                <code>{STUDIO_STORAGE_PATHS.browserProductsKey}</code>
              </div>
            </div>
            <div className="sh-storage-layer">
              <HardDrive size={18} />
              <div>
                <strong>Tab「Đã tải lên」</strong>
                <p>Chỉ file bạn upload thủ công (ref, tài liệu) — tách biệt sản phẩm AI</p>
                <code>{STUDIO_STORAGE_PATHS.browserAssetsKey}</code>
              </div>
            </div>
            <div className="sh-storage-layer">
              {settings.cloudSyncEnabled ? <Cloud size={18} /> : <CloudOff size={18} />}
              <div>
                <strong>Cloud VPS —「Tài sản」</strong>
                <p>Đồng bộ sản phẩm AI PC ↔ mobile (không sync upload ref)</p>
                <code>{STUDIO_STORAGE_PATHS.vpsCloudSync}</code>
              </div>
            </div>
            <div className="sh-storage-layer">
              <HardDrive size={18} />
              <div>
                <strong>File upload (VPS CDN)</strong>
                <p>Ảnh/video ref lưu vật lý khi bạn tải lên</p>
                <code>{STUDIO_STORAGE_PATHS.cdnPublicBase}</code>
              </div>
            </div>
          </div>

          <div className="sh-storage-toggles">
            <label className="sh-storage-check">
              <input
                type="checkbox"
                checked={settings.autoSaveOutputs}
                onChange={(e) => patch({ autoSaveOutputs: e.target.checked })}
              />
              <span>Tự lưu sản phẩm AI vào「Tài sản」khi render xong</span>
            </label>
            <label className="sh-storage-check">
              <input
                type="checkbox"
                checked={settings.saveAllVariants}
                disabled={!settings.autoSaveOutputs}
                onChange={(e) => patch({ saveAllVariants: e.target.checked })}
              />
              <span>Lưu từng biến thể ảnh (2–4) riêng trong「Tài sản」</span>
            </label>
            <label className="sh-storage-check">
              <input
                type="checkbox"
                checked={settings.cloudSyncEnabled}
                onChange={(e) => patch({ cloudSyncEnabled: e.target.checked })}
              />
              <span>Đồng bộ cloud VPS</span>
            </label>
            <label className="sh-storage-check">
              <input
                type="checkbox"
                checked={settings.cloudSyncOnSave}
                disabled={!settings.cloudSyncEnabled}
                onChange={(e) => patch({ cloudSyncOnSave: e.target.checked })}
              />
              <span>Push cloud ngay sau mỗi lần lưu</span>
            </label>
          </div>

          {settings.cloudSyncEnabled && (
            <div className="sh-storage-sync-actions">
              <button type="button" disabled={syncing} onClick={() => syncNow('pull')}>
                {syncing ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                Kéo từ cloud
              </button>
              <button type="button" disabled={syncing} onClick={() => syncNow('push')}>
                {syncing ? <Loader2 size={14} className="spin" /> : <Cloud size={14} />}
                Đẩy lên cloud
              </button>
            </div>
          )}

          {syncMsg && <p className="sh-storage-sync-msg">{syncMsg}</p>}
        </div>
      )}
    </section>
  )
}
