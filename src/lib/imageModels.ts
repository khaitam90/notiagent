export type ImageProvider = 'novita' | 'replicate' | 'openrouter' | 'together' | 'atlascloud' | 'openai'
export type ImageModelId = string
export type ImageQualityTier = 'cuc_cao' | 'cao' | 'chuan' | 'toc_do'

export type ImageResolutionId = '1K' | '2K' | '4K'

export type ImageModel = {
  id: ImageModelId
  provider: ImageProvider
  apiModel: string
  editApiModel?: string
  supportsFaceId?: boolean
  faceIdApiModel?: string
  label: string
  brand: 'ByteDance' | 'Google' | 'OpenAI' | 'xAI' | 'Stability AI' | 'Black Forest Labs'
  qualityTier: ImageQualityTier
  qualityLabel: string
  desc: string
  strengths: string[]
  capabilities: string[]
  premium?: boolean
  /** Chỉ đặt ready sau khi tạo mới và chỉnh sửa thực tế qua provider đều thành công. */
  status?: 'ready'
  defaultSize: { width: number; height: number }
  /** Độ phân giải xuất tối đa */
  maxResolution: ImageResolutionId
  /**
   * 2026-07-28: Tỷ lệ khung hình THẬT model này hỗ trợ — lấy từ tài liệu API chính thức
   * (fal.ai docs / OpenAI docs), KHÔNG dùng chung 1 danh sách cho mọi model như trước
   * (Sếp yêu cầu: Nano Banana Pro ~10 tỷ lệ, FLUX.2 Pro chỉ 5 khung cố định — số liệu
   * khác nhau thật giữa các model, không phải cùng 1 bộ).
   */
  ratios: string[]
  /**
   * 'tiers' = model có tham số độ phân giải riêng (1K/2K/4K) độc lập với tỷ lệ, chọn được.
   * 'fixed' = model KHÔNG có tham số độ phân giải riêng (API chỉ có các khung cố định
   * square_hd/landscape_4_3/...), độ phân giải đã cố định theo khung — ẩn bộ chọn K trên UI
   * thay vì hiện 1 lựa chọn không có tác dụng thật (đúng nguyên tắc không bịa/không hứa suông).
   */
  resolutionMode: 'tiers' | 'fixed'
}

export const IMAGE_QUALITY_LABELS: Record<ImageQualityTier, string> = {
  cuc_cao: 'Cực cao',
  cao: 'Cao',
  chuan: 'Chuẩn',
  toc_do: 'Tốc độ',
}

// 2026-08-04: Fal.ai bị loại bỏ hoàn toàn (key hỏng + chủ trương không dùng nữa). Đã kiểm tra
// thật tài liệu Novita AI (https://novita.ai/llms.txt): Seedream 4.5 và Seedream 5.0 Lite có
// endpoint đồng bộ tương đương trực tiếp trên Novita (POST /v3/seedream-4.5,
// POST /v3/seedream-5.0-lite — cùng field prompt/size/image mảng đa ảnh ref). Các model ảnh
// Fal khác (Nano Banana 2/Lite/Pro, GPT Image 2, Grok Imagine Image, Stable Diffusion 3.5,
// FLUX.2 Pro/Max + FaceID) KHÔNG có bằng chứng tồn tại trên Novita — đã gỡ khỏi danh mục thay
// vì để lại lựa chọn hỏng. Muốn khôi phục nhóm này cần một provider khác hỗ trợ đúng model đó.
const SEEDREAM_50: ImageModel = {
  id: 'seedream-5.0-lite',
  provider: 'novita',
  apiModel: 'seedream-5.0-lite',
  label: 'Seedream 5.0 Lite',
  brand: 'ByteDance',
  qualityTier: 'cuc_cao',
  qualityLabel: 'Cực cao',
  desc: 'Nhân vật không thay đổi & kiến thức phong phú về thế giới',
  strengths: ['Nhất quán nhân vật', 'Suy luận đa bước', 'Bám sát thực tế'],
  capabilities: ['Text-to-image', 'Chỉnh sửa đa ảnh ref (tối đa 14)', 'Chữ trong ảnh'],
  defaultSize: { width: 1024, height: 1024 },
  // Novita docs: size mặc định 2048x2048, hỗ trợ 2K/3K hoặc WIDTHxHEIGHT tuỳ chỉnh.
  maxResolution: '2K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

const FLUX_2_DEV: ImageModel = {
  id: 'flux-2-dev-together',
  provider: 'together',
  apiModel: 'black-forest-labs/FLUX.2-dev',
  label: 'FLUX.2 Dev (Together.ai)',
  brand: 'Black Forest Labs',
  qualityTier: 'chuan',
  qualityLabel: 'Chuẩn',
  desc: 'Model FLUX rẻ nhất trên Together.ai (~0.0154 USD/megapixel) — provider duy nhất đã có API key thật trên máy này.',
  strengths: ['Chi phí thấp', 'Có key thật sẵn sàng', 'Chất lượng ổn cho bản nháp'],
  capabilities: ['Text-to-image'],
  defaultSize: { width: 1024, height: 1024 },
  maxResolution: '2K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

const FLUX_2_PRO: ImageModel = {
  id: 'flux-2-pro-together',
  provider: 'together',
  apiModel: 'black-forest-labs/FLUX.2-pro',
  label: 'FLUX.2 Pro (Together.ai)',
  brand: 'Black Forest Labs',
  qualityTier: 'cao',
  qualityLabel: 'Cao',
  desc: 'Bản FLUX chất lượng cao hơn trên Together.ai (~0.03 USD/megapixel) — provider duy nhất đã có API key thật trên máy này.',
  strengths: ['Chất lượng cao', 'Có key thật sẵn sàng'],
  capabilities: ['Text-to-image'],
  defaultSize: { width: 1024, height: 1024 },
  maxResolution: '2K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

// 2026-09-29: 5 model duoi day them theo yeu cau Sep, da xac minh THAT qua web search (khong
// bia) - ten model, hang san xuat, endpoint provider that su ton tai. CHUA noi backend that (chi
// co openai/together duoc cai o create_image() trong main.py) - bam vao se bao loi ro rang
// "provider chua duoc ho tro" thay vi gia vo chay duoc, dung nguyen tac da co san trong file nay
// (xem SEEDREAM_50/IMAGEN_4_ULTRA - da la catalog-truoc-backend tu truoc).
const GPT_IMAGE_2: ImageModel = {
  id: 'gpt-image-2',
  provider: 'openai',
  apiModel: 'gpt-image-2',
  label: 'GPT Image 2.0',
  brand: 'OpenAI',
  qualityTier: 'cuc_cao',
  qualityLabel: 'Cực cao',
  desc: 'OpenAI · model ảnh mới nhất (ra mắt 21/4/2026), chữ trong ảnh sắc nét, layout phức tạp.',
  strengths: ['Chữ trong ảnh sắc nét', 'Layout phức tạp', 'Suy luận prompt'],
  capabilities: ['Text-to-image', 'Chỉnh sửa ảnh'],
  premium: true,
  defaultSize: { width: 1024, height: 1024 },
  maxResolution: '2K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

const GPT_IMAGE_25: ImageModel = {
  id: 'gpt-image-2.5',
  provider: 'openai',
  apiModel: 'gpt-image-2.5-flare',
  label: 'GPT Image 2.5',
  brand: 'OpenAI',
  qualityTier: 'cuc_cao',
  qualityLabel: 'Cực cao',
  desc: 'OpenAI · bản nâng cấp (8/9/2026), nhanh hơn GPT Image 2.0 ~50%, có chế độ Sketch-to-image.',
  strengths: ['Tốc độ nhanh hơn 2.0', 'Sketch-to-image', 'Chữ trong ảnh sắc nét'],
  capabilities: ['Text-to-image', 'Chỉnh sửa ảnh'],
  premium: true,
  defaultSize: { width: 1024, height: 1024 },
  maxResolution: '2K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

const NANO_BANANA_PRO: ImageModel = {
  id: 'nano-banana-pro',
  provider: 'atlascloud',
  apiModel: 'google/nano-banana-pro/text-to-image',
  label: 'Nano Banana Pro',
  brand: 'Google',
  qualityTier: 'cuc_cao',
  qualityLabel: 'Cực cao',
  desc: 'Google (Gemini 3 Pro Image) · kiến thức thế giới sâu, giữ thương hiệu/địa phương hoá chính xác — bản cao cấp nhất dòng Nano Banana.',
  strengths: ['Kiến thức thế giới', 'Giữ nhất quán thương hiệu', 'Kiểm soát sáng tạo chi tiết'],
  capabilities: ['Text-to-image', 'Chỉnh sửa ảnh', 'Tới 4K'],
  premium: true,
  defaultSize: { width: 1024, height: 1024 },
  maxResolution: '4K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

const NANO_BANANA_2_LITE: ImageModel = {
  id: 'nano-banana-2-lite',
  provider: 'atlascloud',
  apiModel: 'google/nano-banana-2-lite/text-to-image',
  label: 'Nano Banana 2 Lite',
  brand: 'Google',
  qualityTier: 'chuan',
  qualityLabel: 'Chuẩn',
  desc: 'Google (Gemini 3.1 Flash Image) · bản rẻ/nhanh nhất dòng Nano Banana 2, sinh ảnh 4-8 giây.',
  strengths: ['Rẻ nhất dòng Nano Banana', 'Nhanh (4-8s)'],
  capabilities: ['Text-to-image'],
  defaultSize: { width: 1024, height: 1024 },
  maxResolution: '2K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

const SEEDREAM_5_PRO: ImageModel = {
  id: 'seedream-5.0-pro',
  provider: 'replicate',
  apiModel: 'bytedance/seedream-5-pro',
  label: 'Seedream 5.0 Pro',
  brand: 'ByteDance',
  qualityTier: 'cuc_cao',
  qualityLabel: 'Cực cao',
  desc: 'ByteDance · suy luận không gian/vật lý (đặt vật đúng trọng lượng, kim đồng hồ đúng vị trí), tối đa 10 ảnh tham chiếu.',
  strengths: ['Suy luận không gian/vật lý', 'Đa ảnh ref (tối đa 10)', 'Tách lớp ảnh (layer)'],
  capabilities: ['Text-to-image', 'Chỉnh sửa đa nguồn', 'Tới 2K'],
  premium: true,
  defaultSize: { width: 1024, height: 1024 },
  maxResolution: '2K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

const IMAGEN_4_ULTRA: ImageModel = {
  id: 'imagen-4-ultra',
  provider: 'replicate',
  apiModel: 'google/imagen-4-ultra',
  label: 'Imagen 4 Ultra',
  brand: 'Google',
  qualityTier: 'cuc_cao',
  qualityLabel: 'Cực cao',
  desc: 'Model chính thức của Google trên Replicate, ưu tiên chất lượng cuối cùng, ảnh quảng cáo và photorealism.',
  strengths: ['Ảnh quảng cáo', 'Photorealism', 'Key visual', 'Render cuối'],
  capabilities: ['Text-to-image', 'Tỷ lệ chuẩn', 'Safety filter', 'Không hỗ trợ edit ảnh'],
  premium: true,
  defaultSize: { width: 2048, height: 2048 },
  maxResolution: '2K',
  ratios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
  resolutionMode: 'fixed',
}

const SEEDREAM_45: ImageModel = {
  id: 'seedream-4.5',
  provider: 'novita',
  apiModel: 'seedream-4.5',
  label: 'Seedream 4.5',
  brand: 'ByteDance',
  // 2026-08-04: sau khi gỡ Fal, nhóm 'chuan'/'toc_do' (Tiêu chuẩn) không còn model nào — dời
  // Seedream 4.5 xuống 'chuan' để tier "Tiêu chuẩn" trên UI không hiện danh sách rỗng.
  qualityTier: 'chuan',
  qualityLabel: 'Chuẩn',
  desc: 'Kiến trúc thống nhất — tạo & chỉnh sửa ảnh, chữ rõ, tối đa 4K',
  strengths: ['Chữ trong ảnh sạch', 'Đa ảnh ref (tối đa 14)', 'E-commerce & composite'],
  capabilities: ['Text-to-image', 'Edit đa nguồn', 'Độ phân giải tới 4K', 'Sequential generation'],
  defaultSize: { width: 1024, height: 1024 },
  // Novita docs: size mặc định 2048x2048, hỗ trợ 2K/4K hoặc WIDTHxHEIGHT tuỳ chỉnh.
  maxResolution: '4K',
  ratios: ['1:1', '3:4', '9:16', '4:3', '16:9'],
  resolutionMode: 'tiers',
}

/** Nhóm theo cấp chất lượng (cao → thấp). */
export const IMAGE_MODEL_GROUPS: { tier: ImageQualityTier; label: string; models: ImageModel[] }[] = [
  { tier: 'cuc_cao', label: IMAGE_QUALITY_LABELS.cuc_cao, models: [SEEDREAM_50, SEEDREAM_5_PRO, IMAGEN_4_ULTRA, GPT_IMAGE_2, GPT_IMAGE_25, NANO_BANANA_PRO] },
  { tier: 'cao', label: IMAGE_QUALITY_LABELS.cao, models: [FLUX_2_PRO] },
  { tier: 'chuan', label: IMAGE_QUALITY_LABELS.chuan, models: [SEEDREAM_45, FLUX_2_DEV, NANO_BANANA_2_LITE] },
  { tier: 'toc_do', label: IMAGE_QUALITY_LABELS.toc_do, models: [] },
]

export const ALL_IMAGE_MODELS = IMAGE_MODEL_GROUPS.flatMap((g) => g.models)

export const IMAGE_BRAND_GROUPS = [...new Set(ALL_IMAGE_MODELS.map((model) => model.brand))].map((brand) => ({
  brand,
  label: brand === 'ByteDance'
    ? 'Seedream · ByteDance'
    : brand === 'Black Forest Labs'
      ? 'FLUX · Black Forest Labs'
      : brand === 'OpenAI'
        ? 'OpenAI · GPT'
        : brand,
  models: ALL_IMAGE_MODELS.filter((model) => model.brand === brand),
}))

// FLUX (Together.ai) la provider anh duy nhat da co API key that tren may nay (Seedream/Imagen
// dung novita/replicate - chua co key) - dat lam mac dinh de nut Tao anh thuc su dung duoc.
export const DEFAULT_IMAGE_MODEL_ID: ImageModelId = 'flux-2-dev-together'

export const IMAGE_SIZE_PRESETS: { id: string; label: string; width: number; height: number; ratio: string }[] = [
  { id: 'sq', label: '1:1', width: 1024, height: 1024, ratio: '1:1' },
  { id: 'portrait', label: '9:16', width: 768, height: 1344, ratio: '9:16' },
  { id: 'landscape', label: '16:9', width: 1344, height: 768, ratio: '16:9' },
  { id: '34', label: '3:4', width: 896, height: 1152, ratio: '3:4' },
  { id: '43', label: '4:3', width: 1152, height: 896, ratio: '4:3' },
]

/** Độ phân giải xuất sản phẩm */
export const IMAGE_OUTPUT_RESOLUTIONS: {
  id: ImageResolutionId
  label: string
  desc: string
  longEdge: number
  apiValue?: string
}[] = [
  { id: '1K', label: '1K', desc: 'Tiêu chuẩn · ~1024px', longEdge: 1024 },
  { id: '2K', label: '2K', desc: 'Cao · ~2048px', longEdge: 2048, apiValue: '2k' },
  { id: '4K', label: '4K', desc: 'Cực cao · ~4096px', longEdge: 4096, apiValue: '4k' },
]

const RES_RANK: Record<ImageResolutionId, number> = { '1K': 1, '2K': 2, '4K': 3 }

export function resolutionsForModel(model: ImageModel): typeof IMAGE_OUTPUT_RESOLUTIONS {
  const max = RES_RANK[model.maxResolution]
  return IMAGE_OUTPUT_RESOLUTIONS.filter((r) => RES_RANK[r.id] <= max)
}

function round8(n: number) {
  return Math.max(8, Math.round(n / 8) * 8)
}

/** Tính width×height theo tỷ lệ + độ phân giải xuất */
export function imageDimensionsForOutput(ratio: string, resolution: ImageResolutionId): {
  width: number
  height: number
  resolutionLabel: ImageResolutionId
} {
  const res = IMAGE_OUTPUT_RESOLUTIONS.find((r) => r.id === resolution) ?? IMAGE_OUTPUT_RESOLUTIONS[0]
  const [rw, rh] = ratio.split(':').map(Number)
  if (!rw || !rh) return { width: 1024, height: 1024, resolutionLabel: res.id }
  const longEdge = res.longEdge
  if (rw >= rh) {
    return {
      width: round8(longEdge),
      height: round8(longEdge * rh / rw),
      resolutionLabel: res.id,
    }
  }
  return {
    width: round8(longEdge * rw / rh),
    height: round8(longEdge),
    resolutionLabel: res.id,
  }
}

export function resolutionApiValue(resolution: ImageResolutionId): string | undefined {
  return IMAGE_OUTPUT_RESOLUTIONS.find((r) => r.id === resolution)?.apiValue
}

export function findImageModel(id: string, _tier?: string): ImageModel {
  return ALL_IMAGE_MODELS.find((m) => m.id === id) ?? ALL_IMAGE_MODELS.find((m) => m.id === DEFAULT_IMAGE_MODEL_ID)!
}

/** Tra model theo apiModel (chuỗi lưu trong node.config.model của Workflow Hub) — trả undefined nếu chưa chọn/không khớp. */
export function findImageModelByApiModel(apiModel: string): ImageModel | undefined {
  return ALL_IMAGE_MODELS.find((m) => m.apiModel === apiModel)
}

export function resolveImageApiModel(model: ImageModel, hasRef: boolean): string {
  if (hasRef && model.editApiModel) return model.editApiModel
  return model.apiModel
}

export function supportsImageFaceId(model: ImageModel): boolean {
  return Boolean(model.supportsFaceId && model.faceIdApiModel)
}

export function imageModelStudioTier(model: ImageModel): StudioRenderTier {
  return model.qualityTier === 'chuan' || model.qualityTier === 'toc_do' ? 'standard' : 'director'
}

export function modelSummary(
  model: ImageModel,
  size: { width: number; height: number },
  resolution?: ImageResolutionId,
) {
  const res = resolution ? ` · ${resolution}` : ''
  return `${model.label} · ${size.width}×${size.height}${res}`
}

export const PROVIDER_LABEL: Record<ImageProvider, string> = {
  openrouter: 'OpenAI qua OpenRouter',
  novita: 'Novita AI',
  replicate: 'Replicate',
  together: 'Together.ai',
  atlascloud: 'Atlas Cloud',
  openai: 'OpenAI',
}

export const BRAND_ICON: Record<ImageModel['brand'], string> = {
  ByteDance: '▮▮▮',
  Google: 'G',
  OpenAI: '◎',
  xAI: '𝕏',
  'Stability AI': 'SD',
  'Black Forest Labs': 'FX',
}

// ---- Bridge cho StudioRenderTier (Đạo diễn/Tiêu chuẩn) — dùng bởi AiImageStudio ----
import type { StudioRenderTier } from './studioRenderTier'

const TIER_TO_QUALITY: Record<StudioRenderTier, ImageQualityTier[]> = {
  director: ['cuc_cao', 'cao'],
  standard: ['chuan', 'toc_do'],
}

/** Nhóm model ảnh theo StudioRenderTier (Đạo diễn = cực cao+cao, Tiêu chuẩn = chuẩn+tốc độ). */
export function imageModelGroupsForTier(tier: StudioRenderTier) {
  const allowed = TIER_TO_QUALITY[tier]
  return IMAGE_MODEL_GROUPS.filter((g) => allowed.includes(g.tier))
}

/** Kích thước ảnh xuất — theo tỷ lệ + độ phân giải, giới hạn theo maxResolution của model. */
export function computeImageDimensions(
  ratio: string,
  resolution: ImageResolutionId,
  modelId: ImageModelId,
): { width: number; height: number; resolutionLabel: ImageResolutionId } {
  const model = findImageModel(modelId)
  const capped = RES_RANK[resolution] > RES_RANK[model.maxResolution] ? model.maxResolution : resolution
  return imageDimensionsForOutput(ratio, capped)
}

/** Alias tương thích ngược — tên cũ của IMAGE_OUTPUT_RESOLUTIONS. */
export const IMAGE_RESOLUTION_OPTIONS = IMAGE_OUTPUT_RESOLUTIONS
export type ImageResolution = ImageResolutionId
