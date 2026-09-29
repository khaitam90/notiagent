import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, Clock, Loader2, Plus, RefreshCw, Send, Youtube,
} from 'lucide-react'
import {
  approvePhase4Row,
  createPhase4Job,
  fetchPhase4Rows,
  publishPhase4Row,
  type Phase4Row,
} from '../../lib/phase4Api'
import { fetchSocialAccounts } from '../../lib/api'

const MODEL_OPTIONS = [
  { id: 'hailuo', label: 'Hailuo (Novita)', desc: 'AI video ~$0.25/6s' },
  { id: 'kling-3.0', label: 'Kling 3.0', desc: 'Kie.ai chất lượng cao' },
  { id: 'mpt', label: 'MPT Stock', desc: 'Pexels + TTS + phụ đề' },
]

const STATUS_TABS = [
  { id: 'review', label: 'Chờ duyệt', status: 'Chờ duyệt' },
  { id: 'processing', label: 'Đang render', status: 'Processing' },
  { id: 'queued', label: 'Chờ đăng', status: 'Chờ đăng' },
  { id: 'scheduled', label: 'Chờ MXH', status: 'Chờ đăng TikTok' },
]

export default function StudioAutomaticPanel() {
  const [tab, setTab] = useState('review')
  const [rows, setRows] = useState<Phase4Row[]>([])
  const [configured, setConfigured] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Phase4Row | null>(null)
  const [topic, setTopic] = useState('')
  const [modelVideo, setModelVideo] = useState('hailuo')
  const [caption, setCaption] = useState('')
  const [creating, setCreating] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [social, setSocial] = useState({ tiktok: false, youtube: false })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const statusTab = STATUS_TABS.find((t) => t.id === tab)
      const data = await fetchPhase4Rows(statusTab?.status)
      setRows(data.rows || [])
      setConfigured(data.configured !== false)
      if (!data.configured && data.detail) setError(String(data.detail))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetchSocialAccounts()
      .then((c) => setSocial({ tiktok: !!c.configured?.tiktok, youtube: !!c.configured?.youtube }))
      .catch(() => {})
  }, [])

  const createJob = async () => {
    if (!topic.trim()) return
    setCreating(true)
    setError('')
    try {
      await createPhase4Job({ topic: topic.trim(), model_video: modelVideo, caption: caption.trim() })
      setTopic('')
      setCaption('')
      setTab('queued')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  const approve = async (platform: 'tiktok' | 'youtube' | 'both') => {
    if (!selected?.row_number) return
    setActionLoading(true)
    try {
      await approvePhase4Row(selected.row_number, platform)
      await load()
      setSelected(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const publishNow = async (platform: 'tiktok' | 'youtube') => {
    if (!selected?.row_number) return
    setActionLoading(true)
    try {
      const title = String(selected['Mô tả gốc'] || 'Video Nô Tì').slice(0, 200)
      const cap = String(selected.Caption || selected['Mô tả gốc'] || title)
      await publishPhase4Row(selected.row_number, platform, title, cap)
      await load()
      setSelected(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setActionLoading(false)
    }
  }

  const videoUrl = selected?.['Link Video'] || ''
  const canPreview = videoUrl && !videoUrl.startsWith('TASK_ID:')

  return (
    <div className="sh-auto">
      <header className="sh-auto-head">
        <div>
          <h2>Studio Automatic</h2>
          <p>Pipeline tự động — tạo video → xem trước → duyệt → đăng TikTok / YouTube</p>
        </div>
        <button type="button" className="sh-auto-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </header>

      {!configured && (
        <div className="sh-auto-warn">
          Sheet chưa kết nối — cấu hình <code>GOOGLE_SA_PRIVATE_KEY</code> trong <code>.env.ai</code>
        </div>
      )}

      <section className="sh-auto-create">
        <h3><Plus size={18} /> Tạo job mới</h3>
        <textarea
          className="sh-auto-input"
          placeholder="Mô tả gốc / chủ đề video (vd: SaPa mùa đông tuyết rơi)..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={2}
        />
        <div className="sh-auto-models">
          {MODEL_OPTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`sh-auto-model${modelVideo === m.id ? ' active' : ''}`}
              onClick={() => setModelVideo(m.id)}
            >
              <strong>{m.label}</strong>
              <small>{m.desc}</small>
            </button>
          ))}
        </div>
        <input
          className="sh-auto-caption"
          placeholder="Caption (tuỳ chọn)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <button type="button" className="sh-auto-submit" onClick={createJob} disabled={creating || !topic.trim()}>
          {creating ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          Thêm vào Sheet — Chờ đăng
        </button>
      </section>

      <div className="sh-auto-tabs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`sh-auto-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="sh-auto-error">{error}</div>}

      <div className="sh-auto-body">
        <div className="sh-auto-list">
          {loading && <div className="sh-auto-empty"><Loader2 className="spin" /> Đang tải…</div>}
          {!loading && rows.length === 0 && (
            <div className="sh-auto-empty">Không có dòng nào ở trạng thái này</div>
          )}
          {rows.map((row) => (
            <button
              key={row.row_number}
              type="button"
              className={`sh-auto-row${selected?.row_number === row.row_number ? ' active' : ''}`}
              onClick={() => setSelected(row)}
            >
              <span className="sh-auto-row-num">#{row.row_number}</span>
              <span className="sh-auto-row-title">{row['Mô tả gốc'] || '—'}</span>
              <span className="sh-auto-row-model">{row['Model Video'] || row.Model || 'hailuo'}</span>
              <span className="sh-auto-row-status">{row['Trạng thái']}</span>
            </button>
          ))}
        </div>

        <div className="sh-auto-preview">
          {!selected && (
            <div className="sh-auto-empty">
              <Clock size={32} />
              <p>Chọn dòng để xem preview và duyệt đăng</p>
            </div>
          )}
          {selected && (
            <>
              <h4>{selected['Mô tả gốc']}</h4>
              <p className="sh-auto-meta">
                Model: {selected['Model Video'] || selected.Model || 'hailuo'} · {selected['Trạng thái']}
              </p>
              {canPreview ? (
                <video src={videoUrl} controls playsInline className="sh-auto-video" />
              ) : (
                <div className="sh-auto-empty">
                  <Loader2 className="spin" />
                  <p>{videoUrl.startsWith('TASK_ID:') ? 'Đang render…' : 'Chưa có video'}</p>
                </div>
              )}
              {tab === 'review' && canPreview && (
                <div className="sh-auto-actions">
                  <p className="sh-auto-actions-label">Duyệt và lên lịch đăng:</p>
                  <button type="button" disabled={actionLoading} onClick={() => approve('tiktok')}>
                    <CheckCircle2 size={16} /> Chờ đăng TikTok
                  </button>
                  <button type="button" disabled={actionLoading} onClick={() => approve('youtube')}>
                    <Youtube size={16} /> Chờ đăng YouTube
                  </button>
                  <button type="button" disabled={actionLoading} onClick={() => approve('both')}>
                    Cả hai (TikTok trước)
                  </button>
                </div>
              )}
              {canPreview && (
                <div className="sh-auto-actions sh-auto-publish">
                  <p className="sh-auto-actions-label">Đăng ngay (bỏ qua queue 30 phút):</p>
                  {social.tiktok && (
                    <button type="button" disabled={actionLoading} onClick={() => publishNow('tiktok')}>
                      Đăng TikTok ngay
                    </button>
                  )}
                  {social.youtube && (
                    <button type="button" disabled={actionLoading} onClick={() => publishNow('youtube')}>
                      Đăng YouTube ngay
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="sh-auto-flow">
        Luồng: <strong>Chờ đăng</strong> → Processing → <strong>Chờ duyệt</strong> → Chờ đăng MXH → Đã đăng
      </footer>
    </div>
  )
}
