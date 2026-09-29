import { useEffect, useState } from 'react'
import { Loader2, Share2, Youtube } from 'lucide-react'
import {
  fetchSocialAccounts,
  publishSocialVideo,
  type SocialPlatform,
} from '../lib/api'

type Props = {
  videoUrl: string
  defaultTitle?: string
  defaultCaption?: string
}

export default function SocialPublishBar({ videoUrl, defaultTitle = '', defaultCaption = '' }: Props) {
  const [title, setTitle] = useState(defaultTitle)
  const [caption, setCaption] = useState(defaultCaption)
  const [tiktokOk, setTiktokOk] = useState(false)
  const [youtubeOk, setYoutubeOk] = useState(false)
  const [loading, setLoading] = useState<SocialPlatform | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    setTitle(defaultTitle)
    setCaption(defaultCaption || defaultTitle)
  }, [defaultTitle, defaultCaption, videoUrl])

  useEffect(() => {
    fetchSocialAccounts()
      .then((c) => {
        setTiktokOk(!!c.configured?.tiktok)
        setYoutubeOk(!!c.configured?.youtube)
      })
      .catch(() => {})
  }, [])

  const publish = async (platform: SocialPlatform) => {
    if (!videoUrl.trim()) return
    setLoading(platform)
    setErr('')
    setMsg('')
    try {
      const res = await publishSocialVideo({
        video_url: videoUrl,
        platform,
        title: title.trim() || 'Video Nô Tì Agent',
        caption: caption.trim() || title.trim() || 'Video Nô Tì Agent',
      })
      const label = platform === 'tiktok' ? 'TikTok' : 'YouTube'
      setMsg(`${label}: ${res.message || 'Đã gửi đăng'}${res.post_id ? ` (#${res.post_id.slice(0, 8)})` : ''}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="cc-social-publish">
      <div className="cc-social-publish-head">
        <Share2 size={16} />
        <span>Đăng MXH — xem preview ưng ý rồi bấm đăng</span>
      </div>
      <div className="cc-social-publish-fields">
        <input
          className="cc-input"
          placeholder="Tiêu đề (YouTube / TikTok)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="cc-input cc-social-caption"
          placeholder="Mô tả / caption / hashtag"
          rows={2}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      <div className="cc-social-publish-actions">
        <button
          type="button"
          className="cc-social-btn tiktok"
          disabled={!tiktokOk || !!loading}
          onClick={() => publish('tiktok')}
        >
          {loading === 'tiktok' ? <Loader2 size={14} className="spin" /> : null}
          Đăng TikTok
        </button>
        <button
          type="button"
          className="cc-social-btn youtube"
          disabled={!youtubeOk || !!loading}
          onClick={() => publish('youtube')}
        >
          {loading === 'youtube' ? <Loader2 size={14} className="spin" /> : <Youtube size={14} />}
          Đăng YouTube
        </button>
      </div>
      {!tiktokOk && !youtubeOk && (
        <p className="cc-social-hint">Chưa cấu hình UniPost — liên hệ admin.</p>
      )}
      {msg && <p className="cc-social-ok">{msg}</p>}
      {err && <p className="cc-social-err">{err}</p>}
    </div>
  )
}
