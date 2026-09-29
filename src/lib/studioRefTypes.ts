import type { ImageToolPreset } from './imageToolPresets'
import type { VideoTool } from './videoTools'

export type RefSlotMode = 'required' | 'optional' | 'none'
export type StudioVideoProvider = 'replicate' | 'novita' | 'atlascloud' | 'crazyrouter' | 'together'

export type ToolRefConfig = {
  image: RefSlotMode
  video: RefSlotMode
  imageLabel?: string
  videoLabel?: string
  imageHint?: string
  videoHint?: string
}

const DEFAULT_VIDEO_REFS: ToolRefConfig = {
  image: 'optional',
  video: 'optional',
  imageLabel: 'Ảnh tham chiếu',
  videoLabel: 'Video tham chiếu',
  imageHint: 'Nhân vật, sản phẩm hoặc bối cảnh',
  videoHint: 'Chuyển động / motion reference',
}

export function getVideoToolRefConfig(tool: VideoTool | null, _provider: StudioVideoProvider = 'replicate'): ToolRefConfig {
  if (!tool) return DEFAULT_VIDEO_REFS

  const image: RefSlotMode = tool.needsImage
    ? 'required'
    : tool.optionalImage
      ? 'optional'
      : 'none'
  const video: RefSlotMode = tool.needsVideo ? 'required' : 'none'

  const labels: Record<string, Partial<ToolRefConfig>> = {
    'image2video': {
      imageLabel: 'Ảnh nguồn',
      imageHint: 'Ảnh sẽ được animate thành video',
    },
    'image-ref': {
      imageLabel: 'Ảnh tham chiếu',
      imageHint: 'Nhân vật, phong cách hoặc bối cảnh cần giữ',
    },
    'script-ref': {
      imageLabel: 'Ảnh ref đa phần',
      imageHint: 'Nhân vật, bối cảnh cho multi-shot',
    },
    motion: {
      imageLabel: 'Ảnh nhân vật',
      imageHint: 'Khớp half/full-body với video · tối thiểu 300×300px',
      videoLabel: 'Video chuyển động',
      videoHint: '3–30s · một nhân vật · tránh cắt cảnh',
    },
    character: {
      imageLabel: 'Ảnh nhân vật (tuỳ chọn)',
      imageHint: 'Concept hoặc ref thiết kế',
    },
    ads: {
      imageLabel: 'Ảnh sản phẩm (tuỳ chọn)',
      imageHint: 'Packshot / mockup sản phẩm',
    },
    kol: {
      imageLabel: 'Ảnh KOL (tuỳ chọn)',
      imageHint: 'Khuôn mặt hoặc avatar người quay',
    },
  }

  return { ...DEFAULT_VIDEO_REFS, ...labels[tool.id], image, video }
}

export function getImagePresetRefConfig(preset: ImageToolPreset | null): ToolRefConfig {
  if (!preset) {
    return {
      image: 'optional',
      video: 'none',
      imageLabel: 'Ảnh tham chiếu',
      imageHint: 'Style / layout reference (tuỳ chọn)',
    }
  }
  if (preset.needsImage) {
    return {
      image: 'required',
      video: 'none',
      imageLabel: preset.imageLabel || 'Ảnh tham chiếu',
      imageHint: preset.imageHint || 'Bắt buộc cho công cụ này',
    }
  }
  if (preset.optionalImage) {
    const hints: Record<string, Partial<ToolRefConfig>> = {
      product: { imageLabel: 'Ảnh sản phẩm', imageHint: 'Ảnh packshot gốc — AI chỉnh nền/ánh sáng' },
      character: { imageLabel: 'Sketch / ref nhân vật', imageHint: 'Concept hoặc pose reference' },
      portrait: { imageLabel: 'Ảnh gương mặt', imageHint: 'Giữ likeness khi tạo portrait' },
    }
    return {
      image: 'optional',
      video: 'none',
      imageLabel: 'Ảnh tham chiếu',
      imageHint: 'Tuỳ chọn — cải thiện kết quả',
      ...hints[preset.id],
    }
  }
  return { image: 'none', video: 'none' }
}
