/**
 * Ước tính chi phí USD trước khi tạo ảnh/video — giúp Sếp thấy giá trước khi bấm Tạo.
 * Số liệu lấy từ trang giá công khai của Fal.ai / Together AI / Novita AI (06/2026).
 * Đây là ƯỚC TÍNH — giá thực tế nhà cung cấp có thể thay đổi hoặc chênh lệch nhỏ.
 */

// ── Ảnh — USD / ảnh (trừ khi ghi chú khác) ──
type ImagePriceRule =
  | { kind: 'flat'; usd: number }
  | { kind: 'flat_4k_double'; usd1k2k: number; usd4k: number }
  | { kind: 'per_megapixel'; usdPerMp: number }
  | { kind: 'resolution_steps'; usd1k: number; usd2k: number; usd4k: number }
  | { kind: 'tiered_megapixel'; firstMp: number; additionalMp: number }
  | { kind: 'gpt_image_2' }

const IMAGE_PRICE: Record<string, ImagePriceRule> = {
  'seedream-5.0-lite': { kind: 'flat', usd: 0.035 },
  'seedream-5.0-pro': { kind: 'resolution_steps', usd1k: 0.0675, usd2k: 0.135, usd4k: 0.135 },
  'nano-banana-2': { kind: 'resolution_steps', usd1k: 0.08, usd2k: 0.12, usd4k: 0.16 },
  'nano-banana-2-lite': { kind: 'flat', usd: 0.02 },
  'nano-banana-pro': { kind: 'flat_4k_double', usd1k2k: 0.15, usd4k: 0.3 },
  'imagen-4-ultra': { kind: 'flat', usd: 0.06 },
  'grok-imagine-image': { kind: 'flat_4k_double', usd1k2k: 0.02, usd4k: 0.04 },
  'flux-2-max': { kind: 'tiered_megapixel', firstMp: 0.07, additionalMp: 0.03 },
  'flux-2-pro': { kind: 'tiered_megapixel', firstMp: 0.03, additionalMp: 0.015 },
  'gpt-image-2': { kind: 'gpt_image_2' },
  'seedream-4.5': { kind: 'flat', usd: 0.04 },
  // 2026-09-29: gia THAT xac minh qua docs Together.ai (id khop dung voi ImageModel.id trong
  // imageModels.ts, KHONG phai id chung 'flux-2-pro' o tren - Together dung id rieng vi day la
  // dung provider khac, thue that qua TOGETHER_API_KEY tren may nay).
  'flux-2-pro-together': { kind: 'per_megapixel', usdPerMp: 0.03 },
  'flux-2-dev-together': { kind: 'per_megapixel', usdPerMp: 0.0154 },
}

export function estimateImageCostUsd(
  modelId: string,
  opts: { width: number; height: number; resolutionLabel: string; numImages: number; quality?: string },
): number {
  const rule = IMAGE_PRICE[modelId]
  if (!rule) return 0
  const megapixels = Math.max(1, (opts.width * opts.height) / 1_000_000)
  const per = rule.kind === 'flat'
    ? rule.usd
    : rule.kind === 'flat_4k_double'
      ? (opts.resolutionLabel === '4K' ? rule.usd4k : rule.usd1k2k)
      : rule.kind === 'resolution_steps'
        ? (opts.resolutionLabel === '4K' ? rule.usd4k : opts.resolutionLabel === '2K' ? rule.usd2k : rule.usd1k)
        : rule.kind === 'per_megapixel'
          ? rule.usdPerMp * megapixels
          : rule.kind === 'tiered_megapixel'
            ? rule.firstMp + Math.max(0, Math.ceil(megapixels) - 1) * rule.additionalMp
            : gptImage2Estimate(opts.width, opts.height, opts.quality)
  return per * Math.max(1, opts.numImages)
}

function gptImage2Estimate(width: number, height: number, quality = 'high'): number {
  const table = {
    low: { base: 0.006, fourK: 0.012 },
    medium: { base: 0.053, fourK: 0.101 },
    high: { base: 0.211, fourK: 0.401 },
  }
  const selected = table[quality as keyof typeof table] || table.high
  const pixels = Math.max(1, width * height)
  const basePixels = 1024 * 1024
  const fourKPixels = 3840 * 2160
  const progress = Math.min(1, Math.max(0, (pixels - basePixels) / (fourKPixels - basePixels)))
  return selected.base + (selected.fourK - selected.base) * progress
}

// ── Video — USD / giây theo đúng endpoint Fal/Replicate đang dùng ──
type VideoPriceRule = {
  silent: number
  audio?: number
  byQuality?: Partial<Record<string, { silent: number; audio?: number }>>
}

const VIDEO_PRICE: Record<string, VideoPriceRule> = {
  'kling-2.5-turbo': { silent: 0.07 },
  'kling-2.6': { silent: 0.07, audio: 0.14 },
  'kling-3.0': { silent: 0.112, audio: 0.168 },
  'kling-o3-omni': { silent: 0.112, audio: 0.14 },
  'grok-imagine-video': {
    silent: 0.07,
    byQuality: {
      '480p': { silent: 0.05 },
      '720p': { silent: 0.07 },
    },
  },
  'veo-3.1-lite': { silent: 0.05 },
  'veo-3.1-lower': {
    silent: 0.10,
    audio: 0.15,
    byQuality: {
      '4k': { silent: 0.30, audio: 0.35 },
    },
  },
  'veo-3.1-omni': {
    silent: 0.20,
    audio: 0.40,
    byQuality: {
      '4k': { silent: 0.40, audio: 0.60 },
    },
  },
  'veo-3.1-quality': {
    silent: 0.20,
    audio: 0.40,
    byQuality: {
      '4k': { silent: 0.40, audio: 0.60 },
    },
  },
  'seedance-2.0': { silent: 0.042 },
  'seedance-2.0-fast': { silent: 0.02 },
  'seedance-2.0-mini': { silent: 0.015 },
  // 2026-09-29: gia THAT da xac minh qua web search khi them model (khong bia) - dreamactor tinh
  // theo giay (BytePlus cong bo $0.05/s), kling motion control tinh theo giay 720p (EvoLink/BeatAPI
  // cong bo $0.1134/s). Con seedance-2.5/gemini-omni-flash/minimax-h3 CHUA tim duoc gia cong khai
  // luc them - co tinh khong dua vao day, de hasVideoPriceData() bao "chua co bang gia" trung thuc
  // thay vi doan bang gia mac dinh chung.
  'dreamactor-m2-replicate': { silent: 0.05 },
  'kling-3.0-motion-control-replicate': { silent: 0.1134 },
}

/** True neu co gia THAT cho model nay (khong phai gia mac dinh doan chung $0.08/s). */
export function hasVideoPriceData(modelId: string): boolean {
  return modelId in VIDEO_PRICE
}

/** True neu co gia THAT cho model anh nay (khong tra ve 0 am tham). */
export function hasImagePriceData(modelId: string): boolean {
  return modelId in IMAGE_PRICE
}

export function estimateVideoCostUsd(
  modelId: string,
  durationSec: number,
  quality?: '480p' | '720p' | '1080p' | string,
  generateAudio = false,
): number {
  const rule = VIDEO_PRICE[modelId] ?? { silent: 0.08 }
  const qualityRule = rule.byQuality?.[String(quality || '').toLowerCase()]
  const selected = qualityRule || rule
  const perSec = generateAudio && selected.audio !== undefined ? selected.audio : selected.silent
  return perSec * Math.max(1, durationSec)
}

/** 1 credit ≈ $0.01 — quy đổi hiển thị kiểu CapCut/Kling */
export const USD_PER_CREDIT = 0.01

export function usdToCredits(usd: number): number {
  if (usd <= 0) return 0
  // Trừ epsilon để các giá trị thập phân chính xác theo bảng giá (ví dụ 0.112 × 5 = 0.56)
  // không bị sai thành 57 credit do biểu diễn floating-point 56.00000000000001.
  return Math.max(1, Math.ceil(usd / USD_PER_CREDIT - 1e-9))
}

export function formatCredits(usd: number): string {
  const n = usdToCredits(usd)
  return `${n} credit`
}

export function formatCreditsWithUsd(usd: number): string {
  return `${formatCredits(usd)} (${formatUsd(usd)})`
}

export type ImageCostBreakdown = {
  usd: number
  credits: number
  perImageCredits: number
  hint: string
}

export function imageCostBreakdown(
  modelId: string,
  opts: { width: number; height: number; resolutionLabel: string; numImages: number; ratio?: string; quality?: string },
): ImageCostBreakdown {
  const usd = estimateImageCostUsd(modelId, opts)
  const credits = usdToCredits(usd)
  const perUsd = estimateImageCostUsd(modelId, { ...opts, numImages: 1 })
  const perImageCredits = usdToCredits(perUsd)
  const parts = [
    opts.numImages > 1 ? `${opts.numImages} biến thể` : null,
    opts.resolutionLabel,
    opts.ratio,
  ].filter(Boolean)
  return {
    usd,
    credits,
    perImageCredits,
    hint: parts.join(' · ') || 'Ước tính khi gửi',
  }
}

export type VideoCostBreakdown = {
  usd: number
  credits: number
  hint: string
}

export function videoCostBreakdown(
  modelId: string,
  durationSec: number,
  quality?: string,
  ratio?: string,
  generateAudio = false,
): VideoCostBreakdown {
  const usd = estimateVideoCostUsd(modelId, durationSec, quality, generateAudio)
  const credits = usdToCredits(usd)
  const parts = [
    `${durationSec}s`,
    quality,
    ratio,
    generateAudio ? 'có âm thanh' : 'không âm thanh',
  ].filter(Boolean)
  return {
    usd,
    credits,
    hint: parts.join(' · '),
  }
}

export function formatUsd(usd: number): string {
  if (usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(usd < 1 ? 3 : 2)}`
}
