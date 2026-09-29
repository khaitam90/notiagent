export type ProMediaKind = 'image' | 'video' | 'audio'

export type ProMediaItem = {
  id: string
  kind: ProMediaKind
  name: string
  preview: string
  url?: string
  file?: File
}

export function detectProMediaKind(file: File): ProMediaKind {
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  return 'image'
}

export function proMediaAccept(layout: 'seedance-mix' | 'kling-keyframes'): string {
  if (layout === 'kling-keyframes') {
    return 'image/jpeg,image/png,image/webp,image/gif'
  }
  return 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm,audio/mp4'
}

export const SEEDANCE_MAX_IMAGES = 7
