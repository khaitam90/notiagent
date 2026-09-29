/** Chế độ render Studio — Đạo diễn (model cao cấp) vs Tiêu chuẩn (model trung bình). */
export type StudioRenderTier = 'director' | 'standard'

export const STUDIO_RENDER_TIER_OPTIONS: {
  id: StudioRenderTier
  label: string
  desc: string
  hint: string
}[] = [
  {
    id: 'director',
    label: 'Đạo diễn',
    desc: 'AI model cao cấp — chi tiết, chữ rõ, nhất quán nhân vật',
    hint: 'Seedream 5 · Imagen 4 Ultra · Kling 3.0…',
  },
  {
    id: 'standard',
    label: 'Tiêu chuẩn',
    desc: 'AI model trung bình — nhanh, tiết kiệm credit',
    hint: 'Seedream 4.5 · Kling 2.5 Turbo…',
  },
]

export function tierLabel(tier: StudioRenderTier): string {
  return STUDIO_RENDER_TIER_OPTIONS.find((o) => o.id === tier)?.label ?? tier
}

// 2026-08-04: sau khi gỡ Fal.ai, 'seedream-5.0-pro' và 'nano-banana-2-lite' không còn tồn tại
// trong catalog (chỉ có trên Fal, không có provider thay thế) — đổi sang model thật đang dùng
// được: Seedream 5.0 Lite (Novita, cực cao) cho Đạo diễn, Seedream 4.5 (Novita, chuẩn) cho
// Tiêu chuẩn.
export const DEFAULT_IMAGE_MODEL_BY_TIER: Record<StudioRenderTier, string> = {
  director: 'seedream-5.0-lite',
  standard: 'seedream-4.5',
}

export const DEFAULT_VIDEO_MODEL_BY_TIER: Record<StudioRenderTier, string> = {
  director: 'kling-3.0',
  standard: 'kling-2.5-turbo-crazyrouter',
}
