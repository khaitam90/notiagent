import type { VideoModelId } from './videoModels'

export type ImageVideoMode = 'image2video' | 'image-ref'

export type ImageVideoToolConfig = {
  mode: ImageVideoMode
  title: string
  subtitle: string
  toolId: string
  defaultModelId: VideoModelId
  defaultRatio: string
  defaultDuration: number
  defaultQuality: '480p' | '720p' | '1080p'
  defaultPrompt: string
  imageLabel: string
  imageHint: string
  steps: string[]
}

export const IMAGE_VIDEO_CONFIG: Record<ImageVideoMode, ImageVideoToolConfig> = {
  image2video: {
    mode: 'image2video',
    title: 'Ảnh → Video',
    subtitle: 'Animate ảnh tĩnh thành video — giữ phong cách ảnh gốc',
    toolId: 'image2video',
    defaultModelId: 'seedance-2.0-fast',
    defaultRatio: '9:16',
    defaultDuration: 5,
    defaultQuality: '720p',
    defaultPrompt: 'Animate ảnh tham chiếu, chuyển động tự nhiên, giữ nguyên phong cách ảnh gốc',
    imageLabel: 'Ảnh nguồn',
    imageHint: 'Ảnh sẽ được animate thành video · JPG/PNG',
    steps: [
      'Tải ảnh nguồn cần animate',
      'Mô tả chuyển động (tuỳ chọn) — Enter gửi',
      'Xem preview khi render xong (~2–4 phút)',
    ],
  },
  'image-ref': {
    mode: 'image-ref',
    title: 'Tham chiếu hình ảnh',
    subtitle: 'Tạo video giữ identity nhân vật và phong cách từ ảnh ref',
    toolId: 'image-ref',
    defaultModelId: 'seedance-2.0',
    defaultRatio: '9:16',
    defaultDuration: 5,
    defaultQuality: '1080p',
    defaultPrompt: 'Tạo video giữ identity nhân vật và phong cách từ ảnh tham chiếu, chuyển động tự nhiên',
    imageLabel: 'Ảnh tham chiếu',
    imageHint: 'Nhân vật, phong cách hoặc bối cảnh cần giữ',
    steps: [
      'Tải ảnh ref (nhân vật / phong cách / bối cảnh)',
      'Mô tả cảnh quay và chuyển động mong muốn',
      'Render — model giữ likeness từ ảnh ref',
    ],
  },
}

export function isImageVideoMode(toolId?: string): toolId is ImageVideoMode {
  return toolId === 'image2video' || toolId === 'image-ref'
}
