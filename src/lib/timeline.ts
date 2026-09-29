export type ClipType = 'video' | 'audio' | 'image'

export type ClipTransforms = {
  scale: number
  opacity: number
  position: [number, number]
}

export type TimelineClip = {
  id: string
  type: ClipType
  track: 'video' | 'audio' | 'text'
  label: string
  src: string
  startSec: number
  durationSec: number
  materialId?: string
  sourceStartSec?: number
  transforms?: ClipTransforms
  volume?: number
  fontSize?: number
  color?: string
}

export type AssetItem = {
  id: string
  type: ClipType
  name: string
  src: string
  thumbnail?: string
}

export function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function clipsAtTime(clips: TimelineClip[], t: number, track: TimelineClip['track']) {
  return clips.filter((c) => c.track === track && t >= c.startSec && t < c.startSec + c.durationSec)
}

export function totalDuration(clips: TimelineClip[], fallback = 5) {
  if (!clips.length) return fallback
  return Math.max(...clips.map((c) => c.startSec + c.durationSec), fallback)
}

export function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function canSplitClip(clip: TimelineClip | undefined, playhead: number) {
  if (!clip) return false
  return playhead > clip.startSec + 0.05 && playhead < clip.startSec + clip.durationSec - 0.05
}

export function splitClipAtPlayhead(clips: TimelineClip[], clipId: string, playhead: number): TimelineClip[] {
  const clip = clips.find((c) => c.id === clipId)
  if (!clip || !canSplitClip(clip, playhead)) return clips
  const rel = playhead - clip.startSec
  const first: TimelineClip = { ...clip, id: uid(), durationSec: rel }
  const second: TimelineClip = {
    ...clip,
    id: uid(),
    startSec: playhead,
    durationSec: clip.durationSec - rel,
    sourceStartSec: (clip.sourceStartSec ?? 0) + rel,
    label: clip.label.includes('(2)') ? clip.label : `${clip.label.slice(0, 20)} (2)`,
  }
  return clips.flatMap((c) => (c.id === clipId ? [first, second] : [c]))
}

export function exportProject(clips: TimelineClip[], assets: AssetItem[]) {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), clips, assets }, null, 2)
}
