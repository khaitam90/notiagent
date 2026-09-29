/** Tỷ lệ khung hình chuẩn Studio — CapCut style */

export type StudioAspectRatio = {
  id: string
  label: string
  /** Wireframe icon — width : height (px) */
  frameW: number
  frameH: number
}

export const STUDIO_ASPECT_RATIOS: StudioAspectRatio[] = [
  { id: '16:9', label: '16:9', frameW: 36, frameH: 20 },
  { id: '4:3', label: '4:3', frameW: 32, frameH: 24 },
  { id: '1:1', label: '1:1', frameW: 26, frameH: 26 },
  { id: '3:4', label: '3:4', frameW: 24, frameH: 32 },
  { id: '9:16', label: '9:16', frameW: 20, frameH: 36 },
]

export const STUDIO_VARIANT_COUNTS = [1, 2, 3, 4] as const

export type StudioVariantCount = typeof STUDIO_VARIANT_COUNTS[number]

export function ratioToImageSizeId(ratio: string): string {
  const map: Record<string, string> = {
    '16:9': 'landscape',
    '9:16': 'portrait',
    '1:1': 'sq',
    '3:4': '34',
    '4:3': '43',
  }
  return map[ratio] ?? 'sq'
}

export function imageSizeIdToRatio(sizeId: string): string {
  const map: Record<string, string> = {
    landscape: '16:9',
    portrait: '9:16',
    sq: '1:1',
    '34': '3:4',
    '43': '4:3',
  }
  return map[sizeId] ?? '9:16'
}
