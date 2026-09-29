import type { AssetItem, ClipTransforms, TimelineClip } from './timeline'
import { uid } from './timeline'

export type STDraftMaterial = { id: string; path: string }

export type STDraftSegment = {
  id: string
  material_id: string
  target_start: number
  target_duration: number
  source_start: number
  source_duration: number
  transforms?: { scale: number; position: [number, number]; opacity?: number }
  volume?: number
}

export type STDraftTrack = {
  track_id: string
  type: 'video' | 'audio' | 'text'
  segments: STDraftSegment[]
}

export type STDraft = {
  project_id: string
  canvas_ratio: string
  fps: number
  tracks: STDraftTrack[]
  materials: {
    videos: STDraftMaterial[]
    audios: STDraftMaterial[]
    images: STDraftMaterial[]
    texts: STDraftMaterial[]
  }
  meta?: {
    name?: string
    exported_at?: string
    version?: number
  }
}

const MS = 1000

export function secToMs(sec: number) {
  return Math.round(sec * MS)
}

export function msToSec(ms: number) {
  return ms / MS
}

function materialIdForAsset(asset: AssetItem): string {
  return asset.id.startsWith('mat_') ? asset.id : `mat_${asset.id}`
}

function ensureMaterialId(clip: TimelineClip, assets: AssetItem[]): string {
  if (clip.materialId) return clip.materialId
  const match = assets.find((a) => a.src === clip.src)
  return match ? materialIdForAsset(match) : `mat_${clip.id}`
}

function pushMaterial(
  list: STDraftMaterial[],
  id: string,
  path: string,
) {
  if (!path || list.some((m) => m.id === id)) return
  list.push({ id, path })
}

export function projectToStdraft(opts: {
  projectId: string
  name: string
  ratio: string
  fps?: number
  clips: TimelineClip[]
  assets: AssetItem[]
}): STDraft {
  const materials = {
    videos: [] as STDraftMaterial[],
    audios: [] as STDraftMaterial[],
    images: [] as STDraftMaterial[],
    texts: [] as STDraftMaterial[],
  }

  for (const a of opts.assets) {
    const mid = materialIdForAsset(a)
    if (a.type === 'video') pushMaterial(materials.videos, mid, a.src)
    else if (a.type === 'audio') pushMaterial(materials.audios, mid, a.src)
    else pushMaterial(materials.images, mid, a.src)
  }

  for (const clip of opts.clips) {
    if (!clip.src) continue
    const mid = ensureMaterialId(clip, opts.assets)
    if (clip.type === 'video') pushMaterial(materials.videos, mid, clip.src)
    else if (clip.type === 'audio') pushMaterial(materials.audios, mid, clip.src)
    else pushMaterial(materials.images, mid, clip.src)
  }

  const trackTypes: Array<'video' | 'audio' | 'text'> = ['video', 'audio', 'text']
  const tracks: STDraftTrack[] = trackTypes.map((type) => ({
    track_id: `track_${type}_1`,
    type,
    segments: opts.clips
      .filter((c) => c.track === type)
      .sort((a, b) => a.startSec - b.startSec)
      .map((clip) => ({
        id: clip.id,
        material_id: ensureMaterialId(clip, opts.assets),
        target_start: secToMs(clip.startSec),
        target_duration: secToMs(clip.durationSec),
        source_start: secToMs(clip.sourceStartSec ?? 0),
        source_duration: secToMs(clip.durationSec),
        transforms:
          clip.track === 'video' || clip.track === 'text'
            ? {
                scale: clip.transforms?.scale ?? 1,
                position: clip.transforms?.position ?? [0, 0],
                opacity: clip.transforms?.opacity ?? 1,
              }
            : undefined,
        volume: clip.track === 'audio' ? (clip.volume ?? 0.8) : undefined,
      })),
  }))

  return {
    project_id: opts.projectId,
    canvas_ratio: opts.ratio,
    fps: opts.fps ?? 30,
    tracks,
    materials,
    meta: {
      name: opts.name,
      exported_at: new Date().toISOString(),
      version: 1,
    },
  }
}

export function stdraftToTimeline(draft: STDraft): {
  clips: TimelineClip[]
  assets: AssetItem[]
  ratio: string
} {
  const assets: AssetItem[] = []
  const seen = new Set<string>()

  const register = (id: string, type: AssetItem['type'], path: string) => {
    if (!path || seen.has(path)) return
    seen.add(path)
    assets.push({
      id: id.replace(/^mat_/, '') || uid(),
      type,
      name: decodeURIComponent(path.split('/').pop()?.split('?')[0] || id),
      src: path,
      thumbnail: type === 'image' ? path : undefined,
    })
  }

  for (const v of draft.materials.videos) register(v.id, 'video', v.path)
  for (const a of draft.materials.audios) register(a.id, 'audio', a.path)
  for (const i of draft.materials.images ?? []) register(i.id, 'image', i.path)

  const allMaterials = [
    ...draft.materials.videos,
    ...draft.materials.audios,
    ...(draft.materials.images ?? []),
  ]

  const clips: TimelineClip[] = []
  for (const track of draft.tracks) {
    for (const seg of track.segments) {
      const mat = allMaterials.find((m) => m.id === seg.material_id)
      const path = mat?.path ?? ''
      const clipType =
        track.type === 'audio' ? 'audio' : mat && draft.materials.images.some((i) => i.id === seg.material_id) ? 'image' : 'video'
      clips.push({
        id: seg.id || uid(),
        type: clipType,
        track: track.type,
        label: draft.meta?.name || mat?.id || seg.id,
        src: path,
        materialId: seg.material_id,
        startSec: msToSec(seg.target_start),
        durationSec: msToSec(seg.target_duration),
        sourceStartSec: msToSec(seg.source_start),
        transforms: seg.transforms
          ? {
              scale: seg.transforms.scale,
              opacity: seg.transforms.opacity ?? 1,
              position: seg.transforms.position,
            }
          : undefined,
        volume: seg.volume,
      })
    }
  }

  return { clips, assets, ratio: draft.canvas_ratio }
}

export function exportStdraftFile(draft: STDraft, filename?: string) {
  const safe = (draft.meta?.name || 'studio')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'studio'
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename || `${safe}.stdraft.json`
  a.click()
}

export function buildHandoffStdraft(opts: {
  type: 'video' | 'image'
  url: string
  name?: string
  ratio?: string
  durationSec?: number
  projectId?: string
}): STDraft {
  const projectId = opts.projectId ?? `proj_${Date.now()}`
  const dur = opts.durationSec ?? (opts.type === 'video' ? 5 : 3)
  const matId = `mat_handoff_${opts.type}`
  const segment: STDraftSegment = {
    id: `segment_${uid()}`,
    material_id: matId,
    target_start: 0,
    target_duration: secToMs(dur),
    source_start: 0,
    source_duration: secToMs(dur),
    transforms: { scale: 1, position: [0, 0], opacity: 1 },
  }

  const materials =
    opts.type === 'video'
      ? {
          videos: [{ id: matId, path: opts.url }],
          audios: [] as STDraftMaterial[],
          images: [] as STDraftMaterial[],
          texts: [] as STDraftMaterial[],
        }
      : {
          videos: [] as STDraftMaterial[],
          audios: [] as STDraftMaterial[],
          images: [{ id: matId, path: opts.url }],
          texts: [] as STDraftMaterial[],
        }

  const videoSegments = opts.type === 'video' ? [segment] : [segment]

  return {
    project_id: projectId,
    canvas_ratio: opts.ratio ?? '9:16',
    fps: 30,
    tracks: [
      { track_id: 'track_video_1', type: 'video', segments: videoSegments },
      { track_id: 'track_audio_1', type: 'audio', segments: [] },
      { track_id: 'track_text_1', type: 'text', segments: [] },
    ],
    materials,
    meta: {
      name: opts.name || 'Từ Studio AI',
      exported_at: new Date().toISOString(),
      version: 1,
    },
  }
}

export function clipDisplayTransforms(clip: TimelineClip): ClipTransforms {
  return {
    scale: clip.transforms?.scale ?? 1,
    opacity: clip.transforms?.opacity ?? 1,
    position: clip.transforms?.position ?? [0, 0],
  }
}

export function clipDisplayVolume(clip: TimelineClip): number {
  return clip.volume ?? 0.8
}
