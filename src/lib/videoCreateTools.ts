/** 4 công cụ tạo video chính — tham khảo CapCut AI Creator */

export type VideoCreateToolId = 'text2video' | 'image2video' | 'image-ref' | 'motion'

export type VideoCreateTool = {
  id: VideoCreateToolId
  label: string
  shortLabel: string
  desc: string
  /** Map sang VIDEO_TOOLS id */
  toolId: string
  badge?: 'NEW' | 'HOT'
}

export const VIDEO_CREATE_TOOLS: VideoCreateTool[] = [
  {
    id: 'text2video',
    label: 'Chuyển văn bản thành video',
    shortLabel: 'Văn bản → Video',
    desc: 'Text to Video',
    toolId: 'text2video',
    badge: 'NEW',
  },
  {
    id: 'image2video',
    label: 'Chuyển đổi hình ảnh thành video',
    shortLabel: 'Ảnh → Video',
    desc: 'Image to Video',
    toolId: 'image2video',
  },
  {
    id: 'image-ref',
    label: 'Tham chiếu hình ảnh',
    shortLabel: 'Ảnh ref',
    desc: 'Image Reference',
    toolId: 'image-ref',
  },
  {
    id: 'motion',
    label: 'Điều khiển chuyển động',
    shortLabel: 'Motion Control',
    desc: 'Motion Control',
    toolId: 'motion',
    badge: 'HOT',
  },
]
