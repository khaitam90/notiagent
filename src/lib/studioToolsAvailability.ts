import { IMAGE_TOOL_PRESETS } from './imageToolPresets'

/** Video tools đã có workspace riêng và chạy E2E */
export const LIVE_VIDEO_TOOL_IDS = new Set([
  'text2video',
  'image2video',
  'image-ref',
  'motion',
])

export const LIVE_IMAGE_PRESET_IDS = new Set(IMAGE_TOOL_PRESETS.map((p) => p.id))

export function isVideoToolLive(id: string): boolean {
  return LIVE_VIDEO_TOOL_IDS.has(id)
}

export function isImagePresetLive(id: string): boolean {
  return LIVE_IMAGE_PRESET_IDS.has(id)
}
