import { Clapperboard, FileText, UserCircle, type LucideIcon } from 'lucide-react'

export type ProFlowId = 'character' | 'script' | 'short-film'
export type ProMode = 'auto' | 'director' | 'render'
export type ProPhase = 'pick' | 'chat' | 'script-ready' | 'rendering' | 'ready'

export type ProFlow = {
  id: ProFlowId
  icon: LucideIcon
  title: string
  titleHighlight: string
  desc: string
  welcome: string
  placeholder: string
  suggestions: string[]
}

export const PRO_FLOWS: ProFlow[] = [
  {
    id: 'character',
    icon: UserCircle,
    title: 'Bắt đầu với',
    titleHighlight: 'thiết kế nhân vật',
    desc: 'Tạo nhân vật AI, concept art, upload ref cho video',
    welcome:
      'Chào Sếp! Em sẽ giúp thiết kế nhân vật cho video — mô tả ngoại hình, trang phục, phong cách (anime, cinematic, 3D…). Khi ổn, bấm **Tạo ảnh nhân vật** hoặc nhắn "tạo ảnh" để render.',
    placeholder: 'Mô tả nhân vật: tuổi, trang phục, bối cảnh, phong cách hình ảnh…',
    suggestions: [
      'Nữ sinh Việt Nam áo dài, ánh sáng golden hour',
      'Nhân vật hoạt hình lịch sử Dòng Máu Việt',
      'Concept art chiến binh cổ trang 4K cinematic',
    ],
  },
  {
    id: 'script',
    icon: FileText,
    title: 'Soạn',
    titleHighlight: 'kịch bản',
    desc: 'AI đạo diễn viết phân cảnh chi tiết trước khi render',
    welcome:
      'Em là đạo diễn AI — kể ý tưởng video, em viết kịch bản phân cảnh chi tiết. Chỉnh sửa xong, bấm **Render video** hoặc Enter lần 2 để gửi Kie.ai render.',
    placeholder: 'Nhập ý tưởng, phân cảnh hoặc kịch bản cho phim ngắn hoặc tác phẩm điện ảnh…',
    suggestions: [
      'Kịch bản TikTok 30s về phở Hà Nội cinematic',
      'Video du lịch Sa Pa mùa lúa chín 9:16',
      'Quảng cáo mỹ phẩm 15 giây tone sang trọng',
    ],
  },
  {
    id: 'short-film',
    icon: Clapperboard,
    title: 'Biến ý tưởng thành',
    titleHighlight: 'phim ngắn',
    desc: 'Biến ý tưởng thành phim ngắn cinematic đa cảnh',
    welcome:
      'Flow phim ngắn: (1) Brainstorm ý tưởng → (2) Em viết kịch bản đa cảnh → (3) Render video AI → (4) Mở Timeline Editor để ghép/chỉnh sâu. Bắt đầu bằng cách kể câu chuyện Sếp muốn kể.',
    placeholder: 'Kể ý tưởng phim ngắn — thể loại, mood, nhân vật, kết thúc…',
    suggestions: [
      'Phim ngắn 30s về mẹ Việt thời chiến tranh',
      'Cinematic drone shot Hạ Long lúc bình minh',
      'Hoạt hình AI 15s giới thiệu thương hiệu cà phê',
    ],
  },
]

export const PRO_MODES: { id: ProMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Tự động', hint: 'AI chat + gợi ý bước tiếp' },
  { id: 'director', label: 'Đạo diễn', hint: 'Viết kịch bản trước khi render' },
  { id: 'render', label: 'Render nhanh', hint: 'Gửi prompt thẳng Kie.ai' },
]

export const PRO_GLOBAL_SUGGESTIONS = [
  'Gợi ý cách kết hợp Chat AI và Timeline Editor',
  'Hướng dẫn chuyển tài nguyên AI sang Timeline Editor',
  'So sánh ưu nhược Chat AI vs Studio chuyên nghiệp',
]

export function findProFlow(id: ProFlowId | null) {
  return PRO_FLOWS.find((f) => f.id === id)
}

export function buildProSystemPrompt(
  flow: ProFlowId | null,
  mode: ProMode,
  opts: { ratio: string; duration: number; modelLabel: string },
): string {
  const base = `Bạn là trợ lý Studio Pro của Nô Tì Agent — mô hình giống CapCut AI Creator.
Luôn trả lời tiếng Việt, ngắn gọn, thực dụng.

Hai giao diện trong hệ sinh thái:
1. **Studio AI / Pro (Chat)** — Sếp chat bằng ngôn ngữ tự nhiên; AI lên kế hoạch, viết kịch bản, gợi ý tạo ảnh/video. Nhanh, tự động, phù hợp người không biết edit.
2. **Timeline Editor (Studio chuyên nghiệp)** — Timeline, track video/audio/text, cắt ghép thủ công, chỉnh từng frame. Sau khi AI tạo tài nguyên thô, Sếp bấm "Mở Timeline Editor" để tinh chỉnh sâu.

Quy trình kết hợp (CapCut-style): Chat AI tạo kịch bản + clip thô → Timeline Editor cắt ghép, nhịp, transition.

Thông số render hiện tại: tỷ lệ ${opts.ratio}, ${opts.duration}s, model ${opts.modelLabel}.`

  if (!flow) {
    return `${base}
Sếp chưa chọn flow — gợi ý chọn một trong: thiết kế nhân vật, soạn kịch bản, phim ngắn.`
  }

  if (flow === 'character') {
    return `${base}
Flow: **Thiết kế nhân vật**. Giúp mô tả chi tiết ngoại hình, trang phục, pose, lighting, art style.
Khi Sếp hài lòng mô tả, nhắc bấm "Tạo ảnh nhân vật". Không tự bịa URL ảnh.`
  }

  if (flow === 'script') {
    return `${base}
Flow: **Soạn kịch bản**. Viết kịch bản phân cảnh cho AI video.
Format khi viết kịch bản:
🎬 TỔNG QUAN: (1 câu)
📋 PHÂN CẢNH: Cảnh N (0-Xs): mô tả hình, góc máy, chuyển động
🎨 STYLE: mood, màu sắc
Mode hiện tại: ${mode}. ${mode === 'director' ? 'Viết kịch bản trước, chưa render.' : mode === 'render' ? 'Có thể render trực tiếp nếu prompt đủ rõ.' : 'Tự quyết bước tiếp.'}`
  }

  return `${base}
Flow: **Phim ngắn**. Brainstorm → kịch bản đa cảnh cinematic → render.
Mode: ${mode}. Ưu tiên câu chuyện có nhịp điệu, hook 3 giây đầu, kết gọn.`
}

export function buildDirectorScriptPrompt(
  idea: string,
  opts: { ratio: string; duration: number; modelLabel: string; style?: string },
): { role: string; content: string }[] {
  return [
    {
      role: 'system',
      content: `Bạn là đạo diễn AI video chuyên nghiệp. Biến ý tưởng thành kịch bản phân cảnh cho AI text-to-video.
Thông số: tỷ lệ ${opts.ratio}, thời lượng ${opts.duration}s, model ${opts.modelLabel}, phong cách ${opts.style || 'cinematic'}.
Format bắt buộc:
🎬 TỔNG QUAN: (1 câu tóm tắt)
📋 PHÂN CẢNH:
Cảnh 1 (0-Xs): mô tả hình ảnh, góc máy, ánh sáng, chuyển động
Cảnh 2 ...
🎨 STYLE: màu sắc, mood, camera movement
Chỉ trả kịch bản tiếng Việt, không giải thích thêm.`,
    },
    { role: 'user', content: idea },
  ]
}

export function buildCharacterImagePrompt(description: string): string {
  return `Professional character concept art, high detail, ${description}, studio lighting, clean background, 4K quality`
}

export function shouldTriggerImage(text: string) {
  return /tạo ảnh|render ảnh|generate image|vẽ nhân vật/i.test(text)
}

export function shouldTriggerVideo(text: string) {
  return /render video|tạo video|xuất video|bắt đầu render|gửi render/i.test(text)
}
