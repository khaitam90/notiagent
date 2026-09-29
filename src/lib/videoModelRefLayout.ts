import type { VideoModelId } from './videoModels'

/** Bố cục upload ref theo model cấu hình cao */
export type ProRefLayout = 'seedance-mix' | 'kling-keyframes' | 'standard'

const SEEDANCE_MIX_MODELS = new Set<VideoModelId>([
  'seedance-2.0',
  'seedance-2.0-fast',
  'seedance-2.0-mini',
])

// 2026-08-04: 'kling-o3-omni' đã gỡ khỏi catalog (chỉ có trên Fal.ai, đã ngừng dùng).
const KLING_KEYFRAME_MODELS = new Set<VideoModelId>(['kling-2.5-turbo', 'kling-2.6', 'kling-3.0'])

export function getVideoModelRefLayout(modelId: string): ProRefLayout {
  const id = modelId as VideoModelId
  if (KLING_KEYFRAME_MODELS.has(id)) return 'kling-keyframes'
  if (SEEDANCE_MIX_MODELS.has(id)) return 'seedance-mix'
  return 'standard'
}

export function isProRefModel(modelId: string): boolean {
  return getVideoModelRefLayout(modelId) !== 'standard'
}

export const PRO_REF_LAYOUT_META: Record<Exclude<ProRefLayout, 'standard'>, {
  title: string
  hint: string
}> = {
  'seedance-mix': {
    title: 'Tài liệu tham chiếu',
    hint: 'Tải ảnh, video, âm thanh — model tự tạo chuyển động theo giai điệu và nhép miệng',
  },
  'kling-keyframes': {
    title: 'Khung hình tham chiếu',
    hint: 'Khung bắt đầu / kết thúc — Kling nội suy chuyển cảnh cinematic',
  },
}
