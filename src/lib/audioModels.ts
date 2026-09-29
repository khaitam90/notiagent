/**
 * Danh muc 4 model am thanh tot nhat (uu tien khop moi/lipsync), chon 2026-09-30 tu cac bai so sanh
 * cong khai: Sync Labs lipsync-2-pro dan dau chat luong khop moi video->video, VEED Fabric 1.0 chinh
 * xac + nhanh nhat cho anh->video noi, Kling Lip Sync re hon; ElevenLabs Eleven v3 la giong doc hay
 * nhat co tieng Viet. CHI LA DANH MUC: backend workflow van chay tts/lipsync bang mock cho toi khi
 * co key that (Replicate/ElevenLabs) - `status: 'catalog'` de UI noi that thay vi gia vo chay duoc.
 * Slug `apiModel` tren Replicate chua duoc goi thu bang key that - kiem tra lai truoc khi noi API.
 */

export type AudioModelKind = 'lipsync' | 'tts'

export type AudioModel = {
  id: string
  label: string
  brand: string
  kind: AudioModelKind
  provider: 'replicate' | 'elevenlabs'
  apiModel: string
  desc: string
  strengths: string[]
  /** Gia hien thi tham khao (chuoi, khong dung de tinh tien). */
  priceHint: string
  status: 'catalog'
}

export const AUDIO_MODELS: AudioModel[] = [
  {
    id: 'sync-lipsync-2-pro',
    label: 'Sync Labs Lipsync 2 Pro',
    brand: 'Sync Labs',
    kind: 'lipsync',
    provider: 'replicate',
    apiModel: 'sync/lipsync-2-pro',
    desc: 'Khớp môi video → video tốt nhất theo các bản so sánh 2026: giữ nguyên biểu cảm, răng và nét mặt gốc.',
    strengths: ['Video có sẵn cần thay lời/lồng tiếng', 'Chất lượng sản phẩm cuối'],
    priceHint: '~$0.067–0.083/giây video',
    status: 'catalog',
  },
  {
    id: 'veed-fabric-1.0',
    label: 'VEED Fabric 1.0',
    brand: 'VEED',
    kind: 'lipsync',
    provider: 'replicate',
    apiModel: 'veed/fabric-1.0',
    desc: 'Ảnh + audio → video người nói, khớp khẩu hình chính xác, biểu cảm và cử chỉ tự nhiên, nhanh nhất trong nhóm.',
    strengths: ['Biến ảnh nhân vật thành video nói', 'Quảng cáo, avatar'],
    priceHint: '~$0.15/giây',
    status: 'catalog',
  },
  {
    id: 'kling-lip-sync',
    label: 'Kling Lip Sync',
    brand: 'Kling',
    kind: 'lipsync',
    provider: 'replicate',
    apiModel: 'kwaivgi/kling-lip-sync',
    desc: 'Khớp môi cho video Kling (hoặc video bất kỳ) bằng audio hoặc văn bản; rẻ hơn, chậm hơn Fabric.',
    strengths: ['Ngân sách thấp', 'Lồng tiếng cho video tạo bằng Kling'],
    priceHint: '~$0.115/giây',
    status: 'catalog',
  },
  {
    id: 'elevenlabs-v3',
    label: 'ElevenLabs Eleven v3',
    brand: 'ElevenLabs',
    kind: 'tts',
    provider: 'elevenlabs',
    apiModel: 'eleven_v3',
    desc: 'Giọng đọc biểu cảm nhất, hỗ trợ tiếng Việt và 70+ ngôn ngữ; tạo voiceover để đưa vào node khớp môi.',
    strengths: ['Voiceover tiếng Việt', 'Cảm xúc, nhấn nhá tự nhiên'],
    priceHint: 'chưa có bảng giá xác thực',
    status: 'catalog',
  },
]

export function audioModelsForKind(kind: AudioModelKind): AudioModel[] {
  return AUDIO_MODELS.filter((model) => model.kind === kind)
}
