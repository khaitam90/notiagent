import { useEffect, useMemo, useState } from 'react'
import { Loader2, Mic, Volume2 } from 'lucide-react'
import { studioAsr } from '../../lib/studioCloud'
import { fetchTtsCatalog, studioTts, type TtsProviderOption } from '../../lib/studioTts'
import type { TimelineClip } from '../../lib/timeline'

type Props = {
  selectedClip?: TimelineClip
  onTtsReady: (audio: { url: string; durationSec: number; label: string }) => void
  onAsrText?: (text: string) => void
}

export default function StudioVoicePanel({ selectedClip, onTtsReady, onAsrText }: Props) {
  const [catalog, setCatalog] = useState<TtsProviderOption[]>([])
  const [providerId, setProviderId] = useState('edge')
  const [modelId, setModelId] = useState('multilingual-v2')
  const [voice, setVoice] = useState('vi-VN-HoaiMyNeural')
  const [languageCode, setLanguageCode] = useState('vi')
  const [ttsText, setTtsText] = useState('')
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsInfo, setTtsInfo] = useState('')
  const [asrLoading, setAsrLoading] = useState(false)
  const [asrResult, setAsrResult] = useState('')

  const provider = useMemo(
    () => catalog.find((p) => p.id === providerId) ?? catalog[0],
    [catalog, providerId],
  )

  useEffect(() => {
    fetchTtsCatalog()
      .then((c) => setCatalog(c.providers))
      .catch(() => setCatalog([]))
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

  const audioClip = selectedClip?.track === 'audio' && selectedClip.src ? selectedClip : undefined

  const runTts = async () => {
    const text = ttsText.trim()
    if (!text || !provider) return
    if (provider.id === 'elevenlabs' && !provider.configured) {
      setTtsInfo('FAL_KEY chưa cấu hình — không thể dùng ElevenLabs')
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
      const label = `TTS ${res.text_preview.slice(0, 24)}`
      const providerLabel = res.provider === 'elevenlabs'
        ? `ElevenLabs ${res.model ?? ''}`.trim()
        : res.stub ? `Stub (${res.provider})` : 'Edge TTS'
      setTtsInfo(`${providerLabel} — ${res.duration_sec.toFixed(1)}s`)
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
      onAsrText?.(res.text)
    } catch (e) {
      setAsrResult(e instanceof Error ? e.message : 'ASR lỗi')
    } finally {
      setAsrLoading(false)
    }
  }

  return (
    <div className="cc-voice-panel">
      <section className="cc-voice-block">
        <div className="cc-voice-head">
          <Volume2 size={16} />
          <h3>TTS — Text to Speech</h3>
          <span className="cc-voice-badge">Edge + ElevenLabs</span>
        </div>
        <textarea
          className="cc-textarea"
          rows={4}
          placeholder="Nhập lời thoại…"
          value={ttsText}
          onChange={(e) => setTtsText(e.target.value)}
        />
        <label className="cc-voice-field-label">Nhà cung cấp giọng</label>
        <select
          className="cc-input"
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
        >
          {catalog.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === 'elevenlabs' && !p.configured}>
              {p.label}{p.id === 'elevenlabs' && !p.configured ? ' (chưa cấu hình Fal)' : ''}
            </option>
          ))}
        </select>
        {provider?.hint && <p className="cc-voice-hint">{provider.hint}</p>}
        {provider?.id === 'elevenlabs' && provider.models && (
          <>
            <label className="cc-voice-field-label">Model ElevenLabs</label>
            <select className="cc-input" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}{m.hint ? ` — ${m.hint}` : ''}</option>
              ))}
            </select>
            <label className="cc-voice-field-label">Ngôn ngữ</label>
            <select className="cc-input" value={languageCode} onChange={(e) => setLanguageCode(e.target.value)}>
              {(provider.language_codes ?? []).map((lc) => (
                <option key={lc.id} value={lc.id}>{lc.label}</option>
              ))}
            </select>
          </>
        )}
        <label className="cc-voice-field-label">Giọng đọc</label>
        <select className="cc-input" value={voice} onChange={(e) => setVoice(e.target.value)}>
          {(provider?.voices ?? []).map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <button type="button" className="cc-btn-secondary cc-voice-btn" disabled={ttsLoading || !ttsText.trim()} onClick={runTts}>
          {ttsLoading ? <Loader2 size={14} className="spin" /> : <Volume2 size={14} />}
          Tạo giọng nói
        </button>
        {ttsInfo && <p className="cc-voice-hint">{ttsInfo}</p>}
      </section>

      <section className="cc-voice-block">
        <div className="cc-voice-head">
          <Mic size={16} />
          <h3>ASR — Speech to Text</h3>
          <span className="cc-voice-badge stub">stub</span>
        </div>
        {audioClip ? (
          <p className="cc-voice-hint">Clip audio: {audioClip.label || 'Audio'}</p>
        ) : (
          <p className="cc-voice-hint">Chọn clip audio trên timeline để chạy ASR</p>
        )}
        <button
          type="button"
          className="cc-btn-secondary cc-voice-btn"
          disabled={asrLoading || !audioClip}
          onClick={runAsr}
        >
          {asrLoading ? <Loader2 size={14} className="spin" /> : <Mic size={14} />}
          Nhận dạng giọng nói
        </button>
        {asrResult && <pre className="cc-asr-result">{asrResult}</pre>}
      </section>
    </div>
  )
}
