/** Motion Control — theo Kling VIDEO 2.6 / 3.0 user guide */

export type MotionCharacterOrientation = 'match_video' | 'match_image'

export type MotionQualityMode = 'standard' | 'professional'

export const MOTION_VIDEO_MIN_SEC = 3
export const MOTION_VIDEO_MAX_SEC = 30
export const MOTION_VIDEO_MIN_EDGE_PX = 340
export const MOTION_VIDEO_MAX_EDGE_PX = 3850

export const MOTION_ORIENTATION_OPTIONS: {
  id: MotionCharacterOrientation
  label: string
  hint: string
}[] = [
  {
    id: 'match_video',
    label: 'Theo video chuyển động',
    hint: 'Mặc định — hướng nhân vật, biểu cảm và camera theo video ref',
  },
  {
    id: 'match_image',
    label: 'Theo ảnh nhân vật',
    hint: 'Giữ hướng nhân vật như ảnh ref — hỗ trợ zoom/pan qua prompt',
  },
]

export const MOTION_TIPS = [
  'Khớp tỷ lệ cơ thể: ảnh half-body ↔ video half-body, full-body ↔ full-body.',
  'Video chuyển động: một nhân vật, một cảnh liên tục — tránh cắt cảnh hoặc camera di chuyển.',
  'Chuyển động vừa phải, tốc độ ổn định — tránh quá nhanh.',
  'Thời lượng video ref: 3–30 giây — video output sẽ khớp độ dài video tải lên.',
  'Prompt (tuỳ chọn): mô tả nền, trang phục, chi tiết cảnh — không thay chuyển động.',
] as const

export const MOTION_DEFAULT_PROMPT =
  'Motion control: nhân vật thực hiện chuyển động theo video reference, giữ identity khuôn mặt và cơ thể'

export function motionOrientationPromptSuffix(orientation: MotionCharacterOrientation): string {
  if (orientation === 'match_image') {
    return ' Character orientation matches reference image; camera may zoom or pan as described in prompt.'
  }
  return ''
}

export function estimateMotionCostUsd(durationSec: number, mode: MotionQualityMode): number {
  const perSec = mode === 'professional' ? 0.112 : 0.07
  return perSec * Math.max(MOTION_VIDEO_MIN_SEC, Math.round(durationSec))
}
