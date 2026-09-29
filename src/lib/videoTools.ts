import type { VideoModelId } from './videoModels'

export type VideoTool = {
  id: string
  icon: string
  label: string
  desc: string
  modelId: VideoModelId
  ratio: string
  duration: number
  quality: '480p' | '720p' | '1080p'
  style: string
  prompt: string
  needsImage?: boolean
  needsVideo?: boolean
  optionalImage?: boolean
  optionalVideo?: boolean
}

/** Công cụ cấu hình sẵn — tham khảo Kling All Tools */
export const VIDEO_TOOLS: VideoTool[] = [
  {
    id: 'short-film',
    icon: '📺',
    label: 'Phim ngắn',
    desc: 'Chân thật, cinematic',
    modelId: 'seedance-2.0',
    ratio: '16:9',
    duration: 10,
    quality: '1080p',
    style: 'cinematic',
    prompt: 'Phim ngắn cinematic Việt Nam, ánh sáng tự nhiên, nhân vật chân thật, storytelling cảm xúc, depth of field, film grain nhẹ',
  },
  {
    id: 'animation',
    icon: '🎬',
    label: 'Hoạt hình',
    desc: 'Anime / 2D / 3D',
    modelId: 'seedance-2.0',
    ratio: '16:9',
    duration: 8,
    quality: '720p',
    style: 'anime',
    prompt: 'Phim hoạt hình anime style, màu sắc sống động, chuyển động mượt, nhân vật biểu cảm, studio ghibli inspired',
  },
  {
    id: 'ads',
    icon: '🛒',
    label: 'Quảng cáo',
    desc: 'Product ad 15s',
    modelId: 'seedance-2.0',
    ratio: '9:16',
    duration: 5,
    quality: '1080p',
    style: 'commercial',
    prompt: 'Video quảng cáo sản phẩm 15 giây, ánh sáng studio, sản phẩm nổi bật, text overlay space, dynamic camera, premium feel',
  },
  {
    id: 'kol',
    icon: '👤',
    label: 'Video KOL',
    desc: 'TikTok / Reels vlog',
    modelId: 'seedance-2.0-fast',
    ratio: '9:16',
    duration: 5,
    quality: '720p',
    style: 'realistic',
    prompt: 'KOL review sản phẩm, góc quay selfie vlog, ánh sáng tự nhiên, nói trực tiếp camera, nền đẹp, TikTok style',
  },
  {
    id: 'character',
    icon: '🎭',
    label: 'Thiết kế nhân vật',
    desc: 'Character design clip',
    modelId: 'seedance-2.0',
    ratio: '1:1',
    duration: 5,
    quality: '1080p',
    style: 'fantasy',
    prompt: 'Character design showcase, nhân vật xoay 360 độ, chi tiết costume và biểu cảm, nền gradient, concept art style',
  },
  {
    id: 'text2video',
    icon: '📝',
    label: 'Văn bản → Video',
    desc: 'Text to video nhanh',
    modelId: 'seedance-2.0-fast',
    ratio: '16:9',
    duration: 5,
    quality: '720p',
    style: 'realistic',
    prompt: 'Mô tả cảnh quay chi tiết từ văn bản — thay nội dung này bằng prompt của Sếp',
  },
  {
    id: 'image2video',
    icon: '🖼️',
    label: 'Ảnh → Video',
    desc: 'Animate từ ảnh',
    modelId: 'seedance-2.0-fast',
    ratio: '9:16',
    duration: 5,
    quality: '720p',
    style: 'realistic',
    prompt: 'Animate ảnh tham chiếu, chuyển động tự nhiên, giữ nguyên phong cách ảnh gốc',
    needsImage: true,
  },
  {
    id: 'image-ref',
    icon: '🎨',
    label: 'Tham chiếu hình ảnh',
    desc: 'Style & identity ref',
    modelId: 'seedance-2.0',
    ratio: '9:16',
    duration: 5,
    quality: '1080p',
    style: 'realistic',
    prompt: 'Tạo video giữ identity nhân vật và phong cách từ ảnh tham chiếu, chuyển động tự nhiên',
    needsImage: true,
  },
  {
    id: 'script-ref',
    icon: '📋',
    label: 'Kịch bản + ảnh ref',
    desc: 'Multi reference',
    modelId: 'seedance-2.0',
    ratio: '16:9',
    duration: 10,
    quality: '1080p',
    style: 'cinematic',
    prompt: 'Theo kịch bản: [mô tả cảnh]. Dùng ảnh tham chiếu cho nhân vật và bối cảnh, multi-shot storytelling',
    needsImage: true,
  },
  {
    id: 'motion',
    icon: '🕺',
    label: 'Motion Control',
    desc: 'Video ref → ảnh nhân vật (Kling)',
    modelId: 'seedance-2.0',
    ratio: '9:16',
    duration: 5,
    quality: '1080p',
    style: 'realistic',
    prompt: 'Motion control: nhân vật thực hiện chuyển động theo video reference, giữ identity khuôn mặt',
    needsImage: true,
    needsVideo: true,
  },
  {
    id: 'knowledge',
    icon: '💡',
    label: 'Kiến thức',
    desc: 'Video giáo dục',
    modelId: 'seedance-2.0-fast',
    ratio: '16:9',
    duration: 8,
    quality: '1080p',
    style: 'documentary',
    prompt: 'Video giáo dục ngắn, infographic motion, giọng đọc friendly, minh họa rõ ràng, professional educational style',
  },
]

export const QUICK_CHIPS = VIDEO_TOOLS.slice(0, 5)
