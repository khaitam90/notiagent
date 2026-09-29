import type { StudioRenderTier } from './studioRenderTier'

export type VideoProvider = 'replicate' | 'novita' | 'atlascloud' | 'crazyrouter'
export type VideoModelId = string

export type VideoModel = {
  id: VideoModelId
  provider: VideoProvider
  apiModel: string
  imageApiModel?: string
  label: string
  brand: 'Seedance' | 'Kling' | 'Google' | 'xAI' | 'Alibaba' | 'OpenAI' | 'MiniMax'
  tier: 'budget' | 'standard' | 'pro'
  studioTier: StudioRenderTier
  desc: string
  maxDuration: number
  durations?: number[]
  ratios: string[]
  defaultQuality: '480p' | '720p' | '1080p'
  qualityOptions?: ('480p' | '720p' | '1080p' | '4k')[]
  /** optional = người dùng bật/tắt; always = model luôn tạo âm thanh và không có tham số tắt. */
  nativeAudio?: 'optional' | 'always'
}

export const MODEL_GROUPS: { brand: VideoModel['brand']; models: VideoModel[] }[] = [
  {
    brand: 'Seedance',
    models: [
      {
        id: 'seedance-v1-pro-fast-atlascloud',
        provider: 'atlascloud',
        apiModel: 'bytedance/seedance-v1-pro-fast/text-to-video',
        label: 'Seedance v1 Pro Fast (Atlas Cloud)',
        brand: 'Seedance',
        tier: 'budget',
        studioTier: 'standard',
        desc: 'Atlas Cloud · bản thử text-to-video chi phí thấp',
        maxDuration: 12,
        durations: [2, 3, 4, 5, 6, 8, 10, 12],
        ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        defaultQuality: '480p',
        qualityOptions: ['480p', '720p', '1080p'],
      },
      {
        id: 'seedance-2.0-mini',
        provider: 'replicate',
        apiModel: 'bytedance/seedance-2.0-mini',
        label: 'Seedance 2.0 Mini',
        brand: 'Seedance',
        tier: 'budget',
        studioTier: 'standard',
        desc: 'Replicate · chi phí thấp nhất cho batch video',
        maxDuration: 10,
        ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        defaultQuality: '480p',
      },
      {
        id: 'seedance-2.0-fast',
        provider: 'replicate',
        apiModel: 'bytedance/seedance-2.0-fast',
        label: 'Seedance 2.0 Fast',
        brand: 'Seedance',
        tier: 'budget',
        studioTier: 'standard',
        desc: 'Replicate · tối ưu chi phí / tốc độ cho render hằng ngày',
        maxDuration: 15,
        ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        defaultQuality: '720p',
      },
      {
        id: 'seedance-2.0',
        provider: 'replicate',
        apiModel: 'bytedance/seedance-2.0',
        label: 'Seedance 2.0',
        brand: 'Seedance',
        tier: 'standard',
        studioTier: 'director',
        desc: 'Replicate · chất lượng cao cho render cuối cùng',
        maxDuration: 15,
        ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        defaultQuality: '1080p',
      },
      // 2026-08-02: them Atlas Cloud lam trung gian du phong (chua nap credit luc them - xem
      // note o duoi). Slug xac nhan tu tai lieu Atlas Cloud that (khong bia), route qua
      // provider=atlascloud da wire o backend generate_video_asset().
      {
        id: 'seedance-2.0-atlascloud',
        provider: 'atlascloud',
        apiModel: 'bytedance/seedance-2.0/text-to-video',
        imageApiModel: 'bytedance/seedance-2.0/image-to-video',
        label: 'Seedance 2.0 (Atlas Cloud)',
        brand: 'Seedance',
        tier: 'standard',
        studioTier: 'director',
        desc: 'Atlas Cloud · trung gian rẻ nhất khi so sánh giá — dự phòng, cần nạp credit trước khi dùng',
        maxDuration: 15,
        ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        defaultQuality: '1080p',
      },
      // 2026-09-29: them theo yeu cau Sep - da xac minh THAT qua web search (khong bia): ra mat
      // 31/7/2026, clip 1 lan toi 30s, toi 50 anh tham chieu, am thanh sinh cung hinh (khong ghep
      // sau). Endpoint Atlas Cloud xac nhan that (atlascloud.ai/models/bytedance/seedance-2.5/...).
      // Do phan giai THAT chi toi 720p (ByteDance cong bo 4K nhung ban phat hanh chua co).
      {
        id: 'seedance-2.5-atlascloud',
        provider: 'atlascloud',
        apiModel: 'bytedance/seedance-2.5/text-to-video',
        imageApiModel: 'bytedance/seedance-2.5/image-to-video',
        label: 'Seedance 2.5',
        brand: 'Seedance',
        tier: 'pro',
        studioTier: 'director',
        desc: 'Atlas Cloud · bản mới nhất (31/7/2026), clip 1 lần tới 30s, tới 50 ảnh tham chiếu, âm thanh sinh cùng hình.',
        maxDuration: 30,
        durations: [4, 8, 12, 16, 20, 24, 30],
        ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
        defaultQuality: '720p',
        qualityOptions: ['480p', '720p'],
        nativeAudio: 'always',
      },
      // DreamActor M2.0: KHONG phai text-to-video thuong - can 1 anh nhan vat + 1 video dan
      // chuyen dong lam driving reference (dieu ban trong to app hien tai chua co UI rieng cho
      // luong 2-input nay). Chua xac dinh duoc slug tren Novita/Atlas Cloud, chi thay tren
      // Replicate qua web search - dat provider=replicate, se bao "chua ho tro" neu bam vao
      // (dung nhu cac model catalog khac chua noi backend).
      {
        id: 'dreamactor-m2-replicate',
        provider: 'replicate',
        apiModel: 'bytedance/dreamactor-m2.0',
        label: 'DreamActor M2.0',
        brand: 'Seedance',
        tier: 'pro',
        studioTier: 'director',
        desc: 'ByteDance · ghép chuyển động từ 1 video mẫu vào nhân vật trong ảnh (không phải text-to-video thường — cần ảnh nhân vật + video chuyển động mẫu, $0.05/giây).',
        maxDuration: 15,
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
      },
    ],
  },
  {
    brand: 'Kling',
    models: [
      {
        id: 'kling-2.5-turbo-crazyrouter',
        provider: 'crazyrouter',
        apiModel: 'aigc-video-kling-2.5-turbo',
        label: 'Kling 2.5 Turbo (CrazyRouter)',
        brand: 'Kling',
        tier: 'budget',
        studioTier: 'standard',
        desc: 'CrazyRouter · text-to-video 720p để thử kết nối',
        maxDuration: 5,
        durations: [5],
        ratios: ['16:9', '9:16'],
        defaultQuality: '720p',
        qualityOptions: ['720p'],
      },
      // 2026-08-04: Fal.ai bị loại bỏ hoàn toàn (key hỏng + chủ trương không dùng nữa). Đã kiểm
      // tra thật tài liệu Novita AI (novita.ai/llms.txt + fetch từng trang docs): Kling 2.5
      // Turbo / 2.6 Pro / 3.0 Pro đều có endpoint async tương đương trên Novita
      // (kling-2.5-turbo-t2v/i2v, kling-v2.6-pro-t2v/i2v, kling-v3.0-pro-t2v/i2v) — chuyển hẳn
      // 3 model này sang Novita thay vì xoá. Riêng "Kling O3 Omni" KHÔNG có bằng chứng tồn tại
      // trên Novita (chỉ có dòng O1, không phải O3) — đã gỡ khỏi danh mục.
      {
        id: 'kling-2.5-turbo',
        provider: 'novita',
        apiModel: 'kling-2.5-turbo-t2v',
        imageApiModel: 'kling-2.5-turbo-i2v',
        label: 'Kling 2.5 Turbo',
        brand: 'Kling',
        tier: 'budget',
        studioTier: 'standard',
        desc: 'Nhanh và tiết kiệm cho quảng cáo ngắn, chuyển động mạnh và image-to-video hằng ngày.',
        maxDuration: 10,
        durations: [5, 10],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
        qualityOptions: ['1080p'],
      },
      {
        id: 'kling-2.6',
        provider: 'novita',
        apiModel: 'kling-v2.6-pro-t2v',
        imageApiModel: 'kling-v2.6-pro-i2v',
        label: 'Kling 2.6 Pro',
        brand: 'Kling',
        tier: 'standard',
        studioTier: 'director',
        desc: 'Video điện ảnh ổn định, chuyển động mượt và âm thanh native; phù hợp quảng cáo và nhân vật.',
        maxDuration: 10,
        durations: [5, 10],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
        qualityOptions: ['1080p'],
        nativeAudio: 'optional',
      },
      {
        id: 'kling-3.0',
        provider: 'novita',
        apiModel: 'kling-v3.0-pro-t2v',
        imageApiModel: 'kling-v3.0-pro-i2v',
        label: 'Kling 3.0 Pro',
        brand: 'Kling',
        tier: 'pro',
        studioTier: 'director',
        desc: 'Cinematic cao cấp, multi-shot, chuyển động phức tạp và âm thanh native cho sản phẩm cuối.',
        maxDuration: 15,
        durations: [3, 5, 8, 10, 12, 15],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
        qualityOptions: ['1080p'],
        nativeAudio: 'optional',
      },
      // 2026-08-02: Kling 3.0 Std qua Novita — con credit that (>5$), dung ngay duoc, khong phai
      // du phong. Slug xac nhan tu tai lieu Novita (kling-v3.0-std-t2v/i2v), route qua
      // provider=novita da wire o backend.
      {
        id: 'kling-3.0-std-novita',
        provider: 'novita',
        apiModel: 'kling-v3.0-std-t2v',
        imageApiModel: 'kling-v3.0-std-i2v',
        label: 'Kling 3.0 Std (Novita)',
        brand: 'Kling',
        tier: 'standard',
        studioTier: 'director',
        desc: 'Novita · còn credit sẵn, ưu tiên dùng trước khi chuyển hẳn sang Atlas Cloud.',
        maxDuration: 15,
        durations: [3, 5, 8, 10, 12, 15],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
        qualityOptions: ['1080p'],
        nativeAudio: 'optional',
      },
      // 2026-08-02: Kling 3.0 Std qua Atlas Cloud — du phong, cung slug xac nhan tu tai lieu that.
      {
        id: 'kling-3.0-std-atlascloud',
        provider: 'atlascloud',
        apiModel: 'kwaivgi/kling-v3.0-std/text-to-video',
        imageApiModel: 'kwaivgi/kling-v3.0-std/image-to-video',
        label: 'Kling 3.0 Std (Atlas Cloud)',
        brand: 'Kling',
        tier: 'standard',
        studioTier: 'director',
        desc: 'Atlas Cloud · trung gian rẻ nhất khi so sánh giá — dự phòng, cần nạp credit trước khi dùng',
        maxDuration: 15,
        durations: [3, 5, 8, 10, 12, 15],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
        qualityOptions: ['1080p'],
        nativeAudio: 'optional',
      },
      // 2026-09-29: Kling 3.0 Motion Control - KHONG phai text-to-video thuong, can 1 anh nhan
      // vat + 1 video mau 3-30s de "truyen" chuyen dong sang. Slug Replicate xac nhan that qua
      // web search (replicate.com/kwaivgi/kling-v3-motion-control), gia $0.1134/giay (720p).
      {
        id: 'kling-3.0-motion-control-replicate',
        provider: 'replicate',
        apiModel: 'kwaivgi/kling-v3-motion-control',
        label: 'Kling 3.0 Motion Control',
        brand: 'Kling',
        tier: 'pro',
        studioTier: 'director',
        desc: 'Kuaishou · truyền chuyển động từ 1 video mẫu (3-30s) sang nhân vật trong ảnh — không phải text-to-video thường, cần cả ảnh + video mẫu.',
        maxDuration: 30,
        ratios: ['16:9', '9:16'],
        defaultQuality: '720p',
        qualityOptions: ['720p', '1080p'],
      },
    ],
  },
  // 2026-07-27w: Sep yeu cau noi Google Veo (day du dong), WAN 2.5, Sora 2, Hailuo/MiniMax.
  // Da test THAT tung model qua fal-gateway (khong doan): Veo 2 / Veo 3.1 / WAN 2.5 / Sora 2 /
  // Hailuo 2.3 Pro deu tra ve video MP4 that, HTTP 200. Rieng Veo 3 (ban thuong, khong phai
  // Fast) da bi fal.ai danh dau DEPRECATED ("no longer supported") - KHONG them vao day, chi
  // them Veo 3 Fast (con hoat dong). Veo 3 Fast / Veo 3.1 Fast dung chung schema xac nhan da
  // test voi Veo 3.1 (cung enum duration 4s/6s/8s) nen tin tuong hoat dong nhung CHUA tu goi
  // thu rieng tung cai (de tiet kiem thoi gian/chi phi thuc te, da neu ro voi Sep).
  // QUAN TRONG: da phai VA THAT vao fal-gateway (/root/codex-workspace/deploy/fal-gateway/
  // app/main.py, ham format_duration_for_model) vi gateway cu gui duration mac dinh "5"
  // (chuoi so tho) - Google Veo can dang "4s/6s/8s" (Veo2 rieng la "5s/6s/7s/8s"), OpenAI
  // Sora 2 can SO NGUYEN (khong phai chuoi) trong {4,8,12,16,20} - neu khong vá se loi 422/502
  // ngay ca khi da them dung vao catalog nay.
  {
    brand: 'Google',
    // 2026-08-04: Fal.ai bị loại bỏ hoàn toàn — 4 model Veo 3.1 qua Fal (Lower/Lite/Omni/Quality)
    // đã gỡ khỏi danh mục. Google Veo KHÔNG có trên Novita (không có trong tài liệu API chính
    // thức của Novita) nên không chuyển được, chỉ còn lại 2 bản Veo qua Atlas Cloud bên dưới
    // (dự phòng, cần nạp credit — xem PROJECT_KNOWLEDGE.md).
    models: [
      // 2026-08-02: Veo 3.1 qua Atlas Cloud — du phong, slug xac nhan tu tai lieu Atlas Cloud that
      // (google/veo3.1-lite, google/veo3.1-fast). Duration set cung [4,6,8] giong cac entry Veo
      // khac o tren vi Google Veo chi nhan dung 1 tap gia tri co dinh nay (khong phai dai lien tuc).
      {
        id: 'veo-3.1-lite-atlascloud',
        provider: 'atlascloud',
        apiModel: 'google/veo3.1-lite/text-to-video',
        label: 'Veo 3.1 Lite (Atlas Cloud)',
        brand: 'Google',
        tier: 'budget',
        studioTier: 'standard',
        desc: 'Atlas Cloud · rẻ nhất trong dòng Veo — dự phòng, cần nạp credit trước khi dùng',
        maxDuration: 8,
        durations: [4, 6, 8],
        ratios: ['16:9', '9:16'],
        defaultQuality: '720p',
        qualityOptions: ['720p', '1080p'],
        nativeAudio: 'optional',
      },
      {
        id: 'veo-3.1-fast-atlascloud',
        provider: 'atlascloud',
        apiModel: 'google/veo3.1-fast/text-to-video',
        label: 'Veo 3.1 Fast (Atlas Cloud)',
        brand: 'Google',
        tier: 'standard',
        studioTier: 'director',
        desc: 'Atlas Cloud · cân bằng tốc độ/chất lượng — dự phòng, cần nạp credit trước khi dùng',
        maxDuration: 8,
        durations: [4, 6, 8],
        ratios: ['16:9', '9:16'],
        defaultQuality: '720p',
        qualityOptions: ['720p', '1080p'],
        nativeAudio: 'optional',
      },
      // 2026-09-29: Gemini Omni Flash - model video nhanh cua Google, chay tren Interactions
      // API (khac han Veo), co chinh sua hoi thoai (mo ta thay doi bang loi). Slug Replicate xac
      // nhan that qua web search (replicate.com/google/gemini-omni-1.1). Video ngan (3-10s toi uu).
      {
        id: 'gemini-omni-flash-replicate',
        provider: 'replicate',
        apiModel: 'google/gemini-omni-1.1',
        label: 'Gemini Omni Flash',
        brand: 'Google',
        tier: 'standard',
        studioTier: 'standard',
        desc: 'Google · sinh + chỉnh sửa video hội thoại (mô tả thay đổi bằng lời), âm thanh đồng bộ tự nhiên, tối ưu clip ngắn 3-10s.',
        maxDuration: 8,
        durations: [4, 6, 8],
        ratios: ['16:9', '9:16'],
        defaultQuality: '720p',
        nativeAudio: 'always',
      },
    ],
  },
  // 2026-08-04: xAI (Grok Imagine Video) và OpenAI (Sora 2) đã gỡ khỏi danh mục — cả 2 chỉ có
  // trên Fal.ai, không tìm thấy bằng chứng tồn tại trên Novita/Replicate/Atlas Cloud.
  {
    brand: 'Alibaba',
    models: [
      // 2026-08-04: chuyển từ Fal sang Novita — slug xác nhận thật qua docs Novita
      // (model-apis-wan-2.5-t2v-preview), endpoint POST /v3/async/wan-2.5-t2v-preview.
      {
        id: 'wan-2.5',
        provider: 'novita',
        apiModel: 'wan-2.5-t2v-preview',
        imageApiModel: 'wan-2.5-i2v-preview',
        label: 'WAN 2.5',
        brand: 'Alibaba',
        tier: 'standard',
        studioTier: 'director',
        desc: 'Alibaba · chất lượng hình ảnh & độ ổn định chuyển động tốt nhất dòng WAN, hỗ trợ nhạc nền',
        maxDuration: 10,
        durations: [5, 10],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
      },
    ],
  },
  {
    brand: 'MiniMax',
    models: [
      // 2026-08-04: chuyển từ Fal sang Novita — slug xác nhận thật qua docs Novita
      // (model-apis-minimax-hailuo-2.3-t2v), endpoint POST /v3/async/minimax-hailuo-2.3-t2v.
      {
        id: 'hailuo-2.3-pro',
        provider: 'novita',
        apiModel: 'minimax-hailuo-2.3-t2v',
        imageApiModel: 'minimax-hailuo-2.3-i2v',
        label: 'Hailuo 2.3 Pro',
        brand: 'MiniMax',
        tier: 'pro',
        studioTier: 'director',
        desc: 'MiniMax · bản Hailuo mới nhất, 1080p, tự động tối ưu prompt',
        maxDuration: 6,
        durations: [6, 10],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
      },
      // 2026-09-29: MiniMax H3 (ten chinh thuc, con goi Hailuo 3/H3) - da xac minh THAT qua web
      // search: ra mat 31/7/2026, 2K native + am thanh stereo, toi 15s, toi 9 anh + 3 video + 3
      // audio tham chieu 1 lan. CHUA tim thay tren Replicate/Novita (chi co API rieng cua MiniMax,
      // minimax.io) - de provider=novita nhu fallback catalog nhung GHI RO trong desc la chua xac
      // minh duoc endpoint, khac voi cac model khac da co slug provider xac nhan that.
      {
        id: 'minimax-h3',
        provider: 'novita',
        apiModel: 'minimax-h3-t2v',
        label: 'MiniMax H3',
        brand: 'MiniMax',
        tier: 'pro',
        studioTier: 'director',
        desc: 'MiniMax · bản mới nhất (31/7/2026), 2K native + âm thanh stereo, tới 15s. ⚠️ Chưa xác minh được endpoint qua Novita/Replicate — chỉ có API riêng minimax.io, nút này mang tính danh mục, cần kiểm tra thêm trước khi dùng thật.',
        maxDuration: 15,
        durations: [6, 10, 15],
        ratios: ['16:9', '9:16', '1:1'],
        defaultQuality: '1080p',
        qualityOptions: ['1080p'],
        nativeAudio: 'always',
      },
    ],
  },
]

export const ALL_VIDEO_MODELS = MODEL_GROUPS.flatMap((g) => g.models)

export const DURATION_OPTIONS = [5, 8, 10, 12, 15]
export const QUALITY_OPTIONS = ['480p', '720p', '1080p'] as const
export const RATIO_OPTIONS = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'] as const

export type StudioRatioId = typeof RATIO_OPTIONS[number]

export const STUDIO_RATIO_PRESETS: { id: StudioRatioId; label: string; hint: string; css: string }[] = [
  { id: '9:16', label: '9:16', hint: 'TikTok · Reels', css: 'ratio-916' },
  { id: '16:9', label: '16:9', hint: 'YouTube · TV', css: 'ratio-169' },
  { id: '1:1', label: '1:1', hint: 'Instagram', css: 'ratio-11' },
  { id: '4:3', label: '4:3', hint: 'Classic TV', css: 'ratio-43' },
  { id: '3:4', label: '3:4', hint: 'Portrait 3:4', css: 'ratio-34' },
  { id: '21:9', label: '21:9', hint: 'Ultrawide · Cinema', css: 'ratio-219' },
]

export function ratioCssClass(ratio: string): string {
  return STUDIO_RATIO_PRESETS.find((p) => p.id === ratio)?.css ?? 'ratio-916'
}

/**
 * 2026-07-28: Thời lượng THẬT model chấp nhận — không phải mọi model đều nhận số nguyên tùy ý.
 * Google Veo / OpenAI Sora đòi đúng 1 tập giá trị cố định (đã test thật + vá cứng trong
 * fal-gateway/app/main.py, hàm format_duration_for_model — copy lại đúng tập đó ở đây để UI
 * không hiện lựa chọn mà backend sẽ tự động làm tròn sai ý người dùng). Các model còn lại
 * (Seedance/Kling/WAN/Hailuo) dùng chuỗi số thô, chấp nhận dải liên tục — dùng DURATION_OPTIONS
 * đã có sẵn (test thật từ trước), lọc theo maxDuration của từng model + luôn thêm maxDuration
 * vào cuối nếu chưa có, để không chặn thời lượng tối đa thật của model.
 */
export function durationOptionsForModel(model: VideoModel): number[] {
  if (model.durations?.length) return model.durations
  const capped = DURATION_OPTIONS.filter((d) => d <= model.maxDuration)
  if (!capped.includes(model.maxDuration)) capped.push(model.maxDuration)
  return capped.length > 0 ? capped : [model.maxDuration]
}

export function videoModelsForTier(tier: StudioRenderTier): VideoModel[] {
  return ALL_VIDEO_MODELS.filter((m) => m.studioTier === tier)
}

export function videoModelGroupsForTier(tier: StudioRenderTier) {
  const models = videoModelsForTier(tier)
  const brands = [...new Set(models.map((m) => m.brand))]
  return brands.map((brand) => ({
    brand,
    models: models.filter((m) => m.brand === brand),
  }))
}

export function findVideoModel(id: string, tier?: StudioRenderTier): VideoModel {
  const pool = tier ? videoModelsForTier(tier) : ALL_VIDEO_MODELS
  const hit = pool.find((m) => m.id === id)
  if (hit) return hit
  const fallbackId = tier === 'standard' ? 'seedance-2.0-fast' : 'seedance-2.0'
  return pool.find((m) => m.id === fallbackId) ?? ALL_VIDEO_MODELS[0]
}

/** Tra model theo apiModel (chuỗi lưu trong node.config.model của Workflow Hub) — trả undefined nếu chưa chọn/không khớp. */
export function findVideoModelByApiModel(apiModel: string): VideoModel | undefined {
  const clean = apiModel.trim()
  return ALL_VIDEO_MODELS.find(
    (model) =>
      model.apiModel === clean ||
      model.imageApiModel === clean ||
      clean.startsWith(`${model.apiModel}/`),
  )
}

export function modelSummary(model: VideoModel, ratio: string, duration: number, quality: string) {
  return `${model.label} · ${ratio} · ${duration}s · ${quality}`
}

export const VIDEO_BRAND_ICON: Record<VideoModel['brand'], string> = {
  Kling: '🎬',
  Seedance: '🩰',
  Google: 'G',
  xAI: '𝕏',
  Alibaba: 'W',
  OpenAI: '◎',
  MiniMax: 'H',
}

const TIER_LABEL: Record<VideoModel['tier'], string> = {
  budget: 'Tiết kiệm',
  standard: 'Tiêu chuẩn',
  pro: 'Cao cấp',
}

function strengthForModel(m: VideoModel): string {
  if (m.id === 'seedance-2.0') return 'Chất lượng tốt nhất trong preset mặc định'
  if (m.id === 'seedance-2.0-fast') return 'Tốc độ / giá tối ưu'
  if (m.id === 'seedance-2.0-mini') return 'Rẻ nhất cho batch'
  if (m.id === 'veo-3.1-quality') return 'Phim quảng cáo, điện ảnh, âm thanh đồng bộ và 4K'
  if (m.id === 'veo-3.1-lower') return 'Thử ý tưởng nhanh với chi phí thấp hơn'
  if (m.id === 'veo-3.1-lite') return 'Social video và prototype tiết kiệm'
  if (m.id === 'veo-3.1-omni') return 'Giữ chủ thể/phong cách từ ảnh tham chiếu'
  if (m.id === 'grok-imagine-video') return 'Social, anime và quảng cáo ngắn giàu phong cách'
  if (m.id === 'kling-3.0') return 'Multi-shot điện ảnh và chuyển động phức tạp'
  if (m.id === 'kling-o3-omni') return 'Storyboard omni từ prompt hoặc ảnh'
  if (m.id === 'kling-2.6') return 'Nhân vật và quảng cáo có âm thanh native'
  if (m.id === 'kling-2.5-turbo') return 'Render nhanh, tiết kiệm cho video hằng ngày'
  if (m.id === 'wan-2.5') return 'Khuyên dùng khi cần độ ổn định chuyển động cao & có nhạc nền'
  if (m.id === 'sora-2') return 'Khuyên dùng cho video chi tiết, chuyển động sống động, có âm thanh'
  if (m.id === 'hailuo-2.3-pro') return 'Khuyên dùng cho video nhân vật/chuyển động mượt, 1080p'
  if (m.id === 'seedance-2.0-atlascloud') return 'Trung gian rẻ nhất theo so sánh giá — dự phòng, cần nạp credit'
  if (m.id === 'kling-3.0-std-novita') return 'Còn credit thật — ưu tiên dùng trước'
  if (m.id === 'kling-3.0-std-atlascloud') return 'Trung gian rẻ nhất theo so sánh giá — dự phòng, cần nạp credit'
  if (m.id === 'veo-3.1-lite-atlascloud' || m.id === 'veo-3.1-fast-atlascloud') {
    return 'Trung gian rẻ nhất theo so sánh giá — dự phòng, cần nạp credit'
  }
  return 'Fallback an toàn'
}

export const VIDEO_MODEL_TIER_GROUPS: {
  tier: VideoModel['tier']
  label: string
  models: (VideoModel & { premium: boolean; strength: string })[]
}[] = (['pro', 'standard', 'budget'] as VideoModel['tier'][]).map((tier) => ({
  tier,
  label: TIER_LABEL[tier],
  models: ALL_VIDEO_MODELS
    .filter((m) => m.tier === tier)
    .map((m) => ({ ...m, premium: tier === 'pro', strength: strengthForModel(m) })),
}))
