import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Clock, Clapperboard, History, Loader2, Mic, Pause, Play, Plus, Sparkles, Upload, UserPlus, Volume2, Waves,
} from 'lucide-react'
import { studioAsr } from '../../lib/studioCloud'
import {
  cloneVoice,
  createDubbingJob,
  fetchElevenLabsCapabilities,
  pollDubbingJob,
  type ElevenLabsCapabilities,
} from '../../lib/studioElevenLabs'
import { fetchTtsCatalog, studioTts, type TtsProviderOption } from '../../lib/studioTts'
import type { TimelineClip } from '../../lib/timeline'

type Props = {
  selectedClip?: TimelineClip
  onTtsReady: (audio: { url: string; durationSec: number; label: string }) => void
  onVideoReady?: (video: { url: string; durationSec: number; label: string }) => void
  onAsrText?: (text: string) => void
}

type Section = 'speech' | 'dubbing' | 'clone' | 'voices' | 'history'

type HistoryItem = {
  id: string
  url: string
  durationSec: number
  label: string
  text: string
  voice: string
  provider: string
  createdAt: number
}

const VOICE_GRADIENTS = [
  'linear-gradient(135deg,#f9b778,#e273d5,#7294e3)',
  'linear-gradient(135deg,#6ee7b1,#4ec7e0,#7294e3)',
  'linear-gradient(135deg,#f58633,#eb524b,#d65cc8)',
  'linear-gradient(135deg,#37c8b5,#5d79df,#e273d5)',
  'linear-gradient(135deg,#efde44,#f58633,#eb524b)',
  'linear-gradient(135deg,#adeaf4,#6ee7b1,#7294e3)',
  'linear-gradient(135deg,#fcd5ac,#f9b778,#e273d5)',
]

const NAV: { id: Section; label: string; short: string; icon: typeof Volume2 }[] = [
  { id: 'speech', label: 'Text to Speech', short: 'TTS', icon: Volume2 },
  { id: 'dubbing', label: 'Dubbing / Lip-sync', short: 'Dub', icon: Clapperboard },
  { id: 'clone', label: 'Voice Clone', short: 'Clone', icon: UserPlus },
  { id: 'voices', label: 'Voice Library', short: 'Voices', icon: Waves },
  { id: 'history', label: 'History', short: 'History', icon: History },
]

function voiceGradient(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h + id.charCodeAt(i) * 17) % VOICE_GRADIENTS.length
  return VOICE_GRADIENTS[h]
}

function voiceInitial(label: string) {
  return (label.trim()[0] || '?').toUpperCase()
}

export default function ElevenLabsWorkspace({ selectedClip, onTtsReady, onVideoReady, onAsrText }: Props) {
  const [section, setSection] = useState<Section>('speech')
  const [catalog, setCatalog] = useState<TtsProviderOption[]>([])
  const [providerId, setProviderId] = useState('elevenlabs')
  const [modelId, setModelId] = useState('multilingual-v2')
  const [voice, setVoice] = useState('Rachel')
  const [languageCode, setLanguageCode] = useState('vi')
  const [ttsText, setTtsText] = useState('')
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsInfo, setTtsInfo] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [asrLoading, setAsrLoading] = useState(false)
  const [asrResult, setAsrResult] = useState('')
  const [caps, setCaps] = useState<ElevenLabsCapabilities | null>(null)
  const [dubFile, setDubFile] = useState<File | null>(null)
  const [dubAudioFile, setDubAudioFile] = useState<File | null>(null)
  const [dubLang, setDubLang] = useState('vi')
  const [dubLoading, setDubLoading] = useState(false)
  const [dubProgress, setDubProgress] = useState(0)
  const [dubStatus, setDubStatus] = useState('')
  const [dubOutputUrl, setDubOutputUrl] = useState<string | null>(null)
  const [cloneName, setCloneName] = useState('')
  const [cloneFiles, setCloneFiles] = useState<File[]>([])
  const [cloneLoading, setCloneLoading] = useState(false)
  const [cloneResult, setCloneResult] = useState('')

  const audioRef = useRef<HTMLAudioElement>(null)
  const dubInputRef = useRef<HTMLInputElement>(null)
  const dubAudioInputRef = useRef<HTMLInputElement>(null)
  const cloneInputRef = useRef<HTMLInputElement>(null)

  const provider = useMemo(
    () => catalog.find((p) => p.id === providerId) ?? catalog[0],
    [catalog, providerId],
  )

  const selectedVoiceLabel = useMemo(
    () => provider?.voices.find((v) => v.id === voice)?.label ?? voice,
    [provider, voice],
  )

  const charCount = ttsText.length
  const elevenConfigured = catalog.find((p) => p.id === 'elevenlabs')?.configured ?? false
  const elevenDirect = caps?.elevenlabs_direct ?? false
  const replicateLipsync = caps?.replicate_lipsync ?? caps?.dubbing ?? false
  const audioClip = selectedClip?.track === 'audio' && selectedClip.src ? selectedClip : undefined

  useEffect(() => {
    fetchTtsCatalog()
      .then((c) => {
        setCatalog(c.providers)
        const el = c.providers.find((p) => p.id === 'elevenlabs')
        const edge = c.providers.find((p) => p.id === 'edge')
        if (el?.configured) {
          setProviderId('elevenlabs')
        } else if (edge) {
          setProviderId('edge')
        }
      })
      .catch(() => setCatalog([]))
    fetchElevenLabsCapabilities().then(setCaps).catch(() => setCaps(null))
  }, [])

  useEffect(() => {
    if (!provider) return
    if (provider.id === 'elevenlabs') {
      setModelId(provider.default_model ?? provider.models?.[0]?.id ?? 'multilingual-v2')
      setVoice(provider.default_voice ?? provider.voices[0]?.id ?? 'Rachel')
      setLanguageCode(provider.default_language_code ?? 'vi')
    } else {
      setVoice(provider.voices[0]?.id ?? 'vi-VN-HoaiMyNeural')
    }
  }, [provider?.id])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (previewPlaying && previewUrl) {
      el.play().catch(() => setPreviewPlaying(false))
    } else {
      el.pause()
    }
  }, [previewPlaying, previewUrl])

  const pushHistory = (item: Omit<HistoryItem, 'id' | 'createdAt'>) => {
    const entry: HistoryItem = { ...item, id: `${Date.now()}`, createdAt: Date.now() }
    setHistory((prev) => [entry, ...prev].slice(0, 24))
    return entry
  }

  const runTts = async () => {
    const text = ttsText.trim()
    if (!text || !provider) return
    if (provider.id === 'elevenlabs' && !provider.configured) {
      setTtsInfo('FAL_KEY chưa cấu hình — chuyển sang Edge TTS hoặc cấu hình Fal')
      return
    }
    setTtsLoading(true)
    setTtsInfo('')
    try {
      const res = await studioTts(text, {
        provider: provider.id,
        voice,
        model: provider.id === 'elevenlabs' ? modelId : undefined,
        language_code: provider.id === 'elevenlabs' ? languageCode : undefined,
      })
      const label = res.text_preview.slice(0, 32)
      const providerLabel = res.provider === 'elevenlabs'
        ? `ElevenLabs · ${res.model ?? modelId}`
        : res.stub ? `Stub (${res.provider})` : 'Edge TTS'
      setTtsInfo(`${providerLabel} · ${res.duration_sec.toFixed(1)}s`)
      setPreviewUrl(res.audio_url)
      setPreviewPlaying(false)
      pushHistory({
        url: res.audio_url,
        durationSec: res.duration_sec,
        label,
        text,
        voice,
        provider: res.provider,
      })
      onTtsReady({ url: res.audio_url, durationSec: res.duration_sec, label })
    } catch (e) {
      setTtsInfo(e instanceof Error ? e.message : 'TTS lỗi')
    } finally {
      setTtsLoading(false)
    }
  }

  const runAsr = async () => {
    if (!audioClip?.src) return
    setAsrLoading(true)
    setAsrResult('')
    try {
      const res = await studioAsr(audioClip.src)
      setAsrResult(res.text)
      setTtsText(res.text)
      onAsrText?.(res.text)
    } catch (e) {
      setAsrResult(e instanceof Error ? e.message : 'ASR lỗi')
    } finally {
      setAsrLoading(false)
    }
  }

  const playPreview = (url: string) => {
    if (previewUrl === url && previewPlaying) {
      setPreviewPlaying(false)
      return
    }
    setPreviewUrl(url)
    setPreviewPlaying(true)
  }

  const runDubbing = async () => {
    if (!dubFile) return
    const fallbackAudioUrl = dubAudioFile ? undefined : (previewUrl || audioClip?.src || undefined)
    if (!dubAudioFile && !fallbackAudioUrl) {
      setDubStatus('Cần audio thay thế: tải file audio hoặc tạo/chọn audio trước khi lipsync.')
      return
    }
    if (!replicateLipsync) {
      setDubStatus('Chưa có Replicate token cho lipsync runtime.')
      return
    }
    setDubLoading(true)
    setDubProgress(5)
    setDubStatus('Đang gửi video + audio lên Replicate lipsync…')
    setDubOutputUrl(null)
    try {
      const created = await createDubbingJob(dubFile, {
        targetLang: dubLang,
        name: dubFile.name,
        audioFile: dubAudioFile,
        audioUrl: fallbackAudioUrl,
        provider: 'heygen/lipsync-speed',
      })
      const done = await pollDubbingJob(created.job_id, (j) => {
        setDubProgress(j.progress ?? 10)
        setDubStatus(j.message || `Đang xử lý… ${j.eleven_status ?? j.status}`)
      })
      if (done.status !== 'success' || !done.output_url) {
        throw new Error(done.error || 'Dubbing thất bại')
      }
      setDubOutputUrl(done.output_url)
      setDubProgress(100)
      setDubStatus(`Hoàn tất · ${(done.duration_sec ?? 0).toFixed(1)}s · lipsync ${dubLang.toUpperCase()}`)
      const label = `Dub ${dubFile.name.slice(0, 20)}`
      onVideoReady?.({
        url: done.output_url,
        durationSec: done.duration_sec ?? 10,
        label,
      })
    } catch (e) {
      setDubStatus(e instanceof Error ? e.message : 'Dubbing lỗi')
    } finally {
      setDubLoading(false)
    }
  }

  const runClone = async () => {
    if (!cloneName.trim() || cloneFiles.length === 0) return
    if (!elevenDirect) {
      setCloneResult('Cần ELEVENLABS_API_KEY — Voice Clone cần key trực tiếp')
      return
    }
    setCloneLoading(true)
    setCloneResult('')
    try {
      const res = await cloneVoice(cloneName.trim(), cloneFiles)
      setCloneResult(`Đã tạo giọng «${res.name}» · ID ${res.voice_id.slice(0, 12)}…`)
      setVoice(res.voice_id)
      setProviderId('elevenlabs')
      setSection('speech')
      const refreshed = await fetchTtsCatalog(true)
      setCatalog(refreshed.providers)
    } catch (e) {
      setCloneResult(e instanceof Error ? e.message : 'Clone lỗi')
    } finally {
      setCloneLoading(false)
    }
  }

  return (
    <div className="el-workspace">
      <audio
        ref={audioRef}
        src={previewUrl ?? undefined}
        hidden
        onEnded={() => setPreviewPlaying(false)}
      />

      <aside className="el-nav">
        <div className="el-brand">
          <span className="el-brand-mark" aria-hidden>11</span>
          <div>
            <strong>ElevenLabs</strong>
            <span>trong Nô Tì Studio</span>
          </div>
        </div>

        <nav className="el-nav-list">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`el-nav-item${section === item.id ? ' active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              <item.icon size={18} strokeWidth={1.75} />
              <span className="el-nav-label">{item.label}</span>
              <span className="el-nav-short">{item.short}</span>
            </button>
          ))}
        </nav>

        <div className="el-nav-foot">
          <label className="el-kicker">Nhà cung cấp</label>
          <div className="el-provider-toggle">
            {catalog.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`el-provider-pill${providerId === p.id ? ' active' : ''}`}
                disabled={p.id === 'elevenlabs' && !p.configured}
                onClick={() => setProviderId(p.id)}
                title={p.id === 'elevenlabs' && !p.configured ? 'Cần FAL_KEY' : p.hint}
              >
                {p.label}
              </button>
            ))}
          </div>
          {!elevenConfigured && (
            <p className="el-nav-hint">ElevenLabs TTS cần Fal.ai — đang dùng Edge TTS</p>
          )}
          {elevenConfigured && !elevenDirect && (
            <p className="el-nav-hint">Voice Clone vẫn cần ELEVENLABS_API_KEY trực tiếp</p>
          )}
        </div>
      </aside>

      <main className="el-main">
        {section === 'speech' && (
          <div className="el-speech">
            <header className="el-hero">
              <span className="el-kicker">Text to Speech</span>
              <h1>Giọng nói AI chất lượng cao, giống người thật</h1>
              <p>Nhập văn bản, chọn giọng và thêm thẳng vào timeline audio.</p>
            </header>

            <div className="el-pill-row">
              {provider?.id === 'elevenlabs' && provider.models && (
                <label className="el-pill">
                  <span>Model</span>
                  <select value={modelId} onChange={(e) => setModelId(e.target.value)}>
                    {provider.models.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {provider?.id === 'elevenlabs' && provider.language_codes && (
                <label className="el-pill">
                  <span>Ngôn ngữ</span>
                  <select value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
                    {provider.language_codes.map((lc) => (
                      <option key={lc.id} value={lc.id}>{lc.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="el-pill el-pill-voice">
                <span>Giọng</span>
                <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                  {(provider?.voices ?? []).map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="el-composer">
              <textarea
                className="el-composer-input"
                rows={7}
                placeholder="Nhập hoặc dán văn bản cần đọc…"
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
              />
              <div className="el-composer-bar">
                <div className="el-composer-meta">
                  <span>{charCount} ký tự</span>
                  <span className="el-dot" />
                  <span>{selectedVoiceLabel}</span>
                </div>
                <button
                  type="button"
                  className="el-btn-primary"
                  disabled={ttsLoading || !ttsText.trim()}
                  onClick={runTts}
                >
                  {ttsLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                  Generate speech
                </button>
              </div>
            </div>

            {ttsInfo && <p className="el-status">{ttsInfo}</p>}

            {previewUrl && (
              <div className="el-result-card">
                <button
                  type="button"
                  className="el-result-play"
                  onClick={() => playPreview(previewUrl)}
                  aria-label={previewPlaying ? 'Pause' : 'Play'}
                >
                  {previewPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </button>
                <div className="el-result-copy">
                  <strong>Audio vừa tạo</strong>
                  <span>Đã thêm vào timeline · bấm play để nghe lại</span>
                </div>
                <button
                  type="button"
                  className="el-btn-ghost"
                  onClick={() => onTtsReady({
                    url: previewUrl,
                    durationSec: history[0]?.durationSec ?? 3,
                    label: history[0]?.label ?? 'TTS',
                  })}
                >
                  <Plus size={14} /> Timeline
                </button>
              </div>
            )}

            <section className="el-asr-block">
              <div className="el-asr-head">
                <Mic size={15} />
                <div>
                  <strong>Speech to Text</strong>
                  <span>Chọn clip audio trên timeline để chuyển thành văn bản</span>
                </div>
              </div>
              <button
                type="button"
                className="el-btn-outline"
                disabled={asrLoading || !audioClip}
                onClick={runAsr}
              >
                {asrLoading ? <Loader2 size={14} className="spin" /> : <Mic size={14} />}
                Nhận dạng giọng nói
              </button>
              {asrResult && <pre className="el-asr-result">{asrResult}</pre>}
            </section>
          </div>
        )}

        {section === 'dubbing' && (
          <div className="el-dubbing">
            <header className="el-hero">
              <span className="el-kicker">Dubbing · Lip-sync</span>
              <h1>Video lipsync với audio thay thế</h1>
              <p>Tải video nguồn và cung cấp audio mới — runtime sẽ ghép khẩu hình bằng Replicate.</p>
              {caps?.dubbing_v2_note && <small className="el-dub-note">{caps.dubbing_v2_note}</small>}
            </header>

            <div className="el-pill-row">
              <label className="el-pill">
                <span>Ngôn ngữ đích</span>
                <select value={dubLang} onChange={(e) => setDubLang(e.target.value)}>
                  {(caps?.languages ?? [{ id: 'vi', label: 'Tiếng Việt' }]).map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <input
              ref={dubInputRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => setDubFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="el-dub-drop"
              onClick={() => dubInputRef.current?.click()}
            >
              <Upload size={22} />
              <div>
                <strong>{dubFile ? dubFile.name : 'Chọn video nguồn'}</strong>
                <span>MP4 · MOV · WebM</span>
              </div>
            </button>

            <input
              ref={dubAudioInputRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => setDubAudioFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="el-dub-drop"
              onClick={() => dubAudioInputRef.current?.click()}
            >
              <Mic size={22} />
              <div>
                <strong>{dubAudioFile ? dubAudioFile.name : 'Chọn audio thay thế (tuỳ chọn)'}</strong>
                <span>{previewUrl ? 'Hoặc dùng audio vừa tạo ở tab TTS' : 'Nếu không chọn, app sẽ dùng audio đã tạo/chọn sẵn'}</span>
              </div>
            </button>

            <button
              type="button"
              className="el-btn-primary el-dub-run"
              disabled={dubLoading || !dubFile || !replicateLipsync}
              onClick={runDubbing}
            >
              {dubLoading ? <Loader2 size={16} className="spin" /> : <Clapperboard size={16} />}
              Chạy lipsync
            </button>

            {dubLoading && (
              <div className="el-dub-progress">
                <div className="el-dub-progress-bar" style={{ width: `${dubProgress}%` }} />
              </div>
            )}
            {dubStatus && <p className="el-status">{dubStatus}</p>}

            {dubOutputUrl && (
              <div className="el-result-card el-dub-result">
                <video src={dubOutputUrl} controls className="el-dub-preview" />
                <button
                  type="button"
                  className="el-btn-ghost"
                  onClick={() => onVideoReady?.({
                    url: dubOutputUrl,
                    durationSec: 10,
                    label: dubFile?.name?.slice(0, 24) ?? 'Dubbing',
                  })}
                >
                  <Plus size={14} /> Thêm vào timeline
                </button>
              </div>
            )}
          </div>
        )}

        {section === 'clone' && (
          <div className="el-clone">
            <header className="el-hero">
              <span className="el-kicker">Voice Clone</span>
              <h1>Nhân bản giọng từ mẫu audio</h1>
              <p>Upload 1–3 clip giọng rõ (~30s) — dùng ngay trong TTS ElevenLabs.</p>
            </header>

            <label className="el-pill el-pill-wide">
              <span>Tên giọng</span>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="VD: Giọng MC Sếp"
              />
            </label>

            <input
              ref={cloneInputRef}
              type="file"
              accept="audio/*"
              multiple
              hidden
              onChange={(e) => setCloneFiles(Array.from(e.target.files ?? []))}
            />
            <button type="button" className="el-dub-drop" onClick={() => cloneInputRef.current?.click()}>
              <Mic size={22} />
              <div>
                <strong>{cloneFiles.length ? `${cloneFiles.length} file đã chọn` : 'Chọn mẫu audio'}</strong>
                <span>MP3 · WAV · M4A — giọng rõ, ít tạp âm</span>
              </div>
            </button>

            <button
              type="button"
              className="el-btn-primary"
              disabled={cloneLoading || !cloneName.trim() || cloneFiles.length === 0 || !elevenDirect}
              onClick={runClone}
            >
              {cloneLoading ? <Loader2 size={16} className="spin" /> : <UserPlus size={16} />}
              Tạo voice clone
            </button>
            {cloneResult && <p className="el-status">{cloneResult}</p>}
          </div>
        )}

        {section === 'voices' && (
          <div className="el-voices">
            <header className="el-hero">
              <span className="el-kicker">Voice Library</span>
              <h1>Chọn giọng đọc</h1>
              <p>{provider?.label} · {(provider?.voices ?? []).length} giọng</p>
            </header>
            <div className="el-voice-grid">
              {(provider?.voices ?? []).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`el-voice-card${voice === v.id ? ' active' : ''}`}
                  onClick={() => {
                    setVoice(v.id)
                    setSection('speech')
                  }}
                >
                  <div
                    className="el-voice-avatar"
                    style={{ background: voiceGradient(v.id) }}
                  >
                    {voiceInitial(v.label)}
                  </div>
                  <div className="el-voice-card-body">
                    <strong>{v.label.split('(')[0].trim()}</strong>
                    <span>{v.hint || v.label.match(/\(([^)]+)\)/)?.[1] || v.id}</span>
                  </div>
                  {voice === v.id && <span className="el-voice-selected">Đang chọn</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {section === 'history' && (
          <div className="el-history">
            <header className="el-hero">
              <span className="el-kicker">History</span>
              <h1>Lịch sử tạo giọng</h1>
              <p>{history.length} mục trong phiên này</p>
            </header>
            {history.length === 0 ? (
              <div className="el-empty">
                <Clock size={28} />
                <p>Chưa có audio — tạo từ tab Text to Speech</p>
              </div>
            ) : (
              <ul className="el-history-list">
                {history.map((h) => (
                  <li key={h.id} className="el-history-item">
                    <button
                      type="button"
                      className="el-history-play"
                      onClick={() => playPreview(h.url)}
                      aria-label="Play"
                    >
                      {previewUrl === h.url && previewPlaying
                        ? <Pause size={14} fill="currentColor" />
                        : <Play size={14} fill="currentColor" />}
                    </button>
                    <div className="el-history-copy">
                      <strong>{h.label}</strong>
                      <span>{h.voice} · {h.durationSec.toFixed(1)}s · {h.provider}</span>
                    </div>
                    <button
                      type="button"
                      className="el-btn-ghost"
                      onClick={() => onTtsReady({ url: h.url, durationSec: h.durationSec, label: h.label })}
                    >
                      <Plus size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
