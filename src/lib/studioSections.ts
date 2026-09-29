export type StudioSectionId = 'studio-ai' | 'editor' | 'automatic' | 'library' | 'projects' | 'workflows'

export type StudioSection = {
  id: StudioSectionId
  label: string
  short: string
  /** Tab mở route khác (Timeline Editor) */
  route?: string
}

export type ProjectWorkspaceTab = 'products' | 'uploads' | 'studio'

export const PROJECT_WORKSPACE_TABS: { id: ProjectWorkspaceTab; label: string; hint: string }[] = [
  { id: 'products', label: 'Tất cả sản phẩm', hint: 'Sản phẩm AI đã tạo trong dự án này' },
  { id: 'uploads', label: 'Tải lên', hint: 'Tài liệu từ máy tính, Drive…' },
  { id: 'studio', label: 'Studio', hint: 'Tạo ảnh/video — tách biệt Studio chung' },
]

/** 4 tab top-level — IA đã gom (Studio AI / Editor / Automatic / Dự án) */
export const STUDIO_SECTIONS: StudioSection[] = [
  { id: 'studio-ai', label: 'Studio AI', short: 'AI' },
  { id: 'workflows', label: 'Workflow', short: 'Flow' },
  { id: 'editor', label: 'Dựng timeline', short: 'Timeline', route: '/studio/editor' },
  { id: 'automatic', label: 'Tự động hóa', short: 'Auto' },
  { id: 'library', label: 'Tài sản', short: 'Tài sản' },
  { id: 'projects', label: 'Dự án', short: 'Dự án' },
]

/** Section cũ → redirect sang IA mới */
export const LEGACY_STUDIO_SECTIONS: Record<string, { section: StudioSectionId; panel?: AiPanel; mode?: CreateMode }> = {
  tools: { section: 'studio-ai', panel: 'tools' },
  uploads: { section: 'studio-ai', panel: 'uploads' },
  pro: { section: 'studio-ai', panel: 'pro' },
  image: { section: 'studio-ai', mode: 'image' },
  upload: { section: 'editor' },
  templates: { section: 'studio-ai', panel: 'tools' },
}

export type CreateMode = 'auto' | 'image' | 'video'

export type AiPanel = 'create' | 'tools' | 'uploads' | 'pro'

export const AI_PANELS: { id: AiPanel; label: string }[] = [
  { id: 'create', label: 'Tạo' },
  { id: 'tools', label: 'Công cụ' },
  { id: 'uploads', label: 'Đã tải lên' },
  { id: 'pro', label: 'Pro' },
]

export const CREATE_MODES: { id: CreateMode; label: string; hint: string }[] = [
  { id: 'auto', label: 'Tự động', hint: 'AI chọn video hoặc ảnh phù hợp' },
  { id: 'image', label: 'Hình ảnh', hint: 'Tạo ảnh AI từ prompt' },
  { id: 'video', label: 'Video', hint: 'Tạo video AI từ prompt' },
]
