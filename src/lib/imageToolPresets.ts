/** Preset công cụ ảnh — Studio Công cụ */
export type ImageToolPreset = {
  id: string
  icon: string
  label: string
  desc: string
  modelId: string
  sizeId: string
  prompt: string
  needsImage?: boolean
  optionalImage?: boolean
  imageLabel?: string
  imageHint?: string
}

export const IMAGE_TOOL_PRESETS: ImageToolPreset[] = [
  {
    id: 'portrait',
    icon: '🖼️',
    label: 'Chân dung',
    desc: 'Portrait 9:16 TikTok',
    // 2026-08-04: 'nano-banana-2-lite' đã gỡ khỏi catalog (chỉ có trên Fal.ai, đã ngừng dùng).
    modelId: 'seedream-5.0-lite',
    sizeId: 'portrait',
    prompt: 'Chân dung chuyên nghiệp, ánh sáng studio, nền mềm, chi tiết khuôn mặt, 8k',
    optionalImage: true,
  },
  {
    id: 'product',
    icon: '🛍️',
    label: 'Sản phẩm',
    desc: 'Product shot thương mại',
    modelId: 'seedream-4.5',
    sizeId: 'sq',
    prompt: 'Ảnh sản phẩm trên nền trắng, ánh sáng studio, shadow nhẹ, e-commerce style',
    optionalImage: true,
  },
  {
    id: 'landscape',
    icon: '🏔️',
    label: 'Phong cảnh',
    desc: 'Landscape 16:9 cinematic',
    modelId: 'seedream-4.5',
    sizeId: 'landscape',
    prompt: 'Phong cảnh Việt Nam cinematic, golden hour, ultra detailed, 8k wallpaper',
  },
  {
    id: 'anime',
    icon: '🎨',
    label: 'Anime / Illustration',
    desc: '2D stylized art',
    // 2026-08-04: 'grok-imagine-image' đã gỡ khỏi catalog (chỉ có trên Fal.ai, đã ngừng dùng).
    modelId: 'seedream-4.5',
    sizeId: 'landscape',
    prompt: 'Illustration anime style, vibrant colors, clean line art, studio ghibli inspired',
  },
  {
    id: 'poster',
    icon: '📢',
    label: 'Poster / Thumbnail',
    desc: 'YouTube thumbnail bold',
    // 2026-08-04: 'nano-banana-pro' đã gỡ khỏi catalog (chỉ có trên Fal.ai, đã ngừng dùng).
    modelId: 'seedream-5.0-lite',
    sizeId: 'landscape',
    prompt: 'YouTube thumbnail bold typography space, high contrast, eye-catching composition',
  },
  {
    id: 'character',
    icon: '🎭',
    label: 'Nhân vật',
    desc: 'Character concept art',
    modelId: 'seedream-5.0-lite',
    sizeId: 'sq',
    prompt: 'Character concept art full body, costume detail, neutral background, game asset style',
    optionalImage: true,
  },
]
