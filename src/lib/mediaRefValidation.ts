import {
  MOTION_VIDEO_MAX_EDGE_PX,
  MOTION_VIDEO_MAX_SEC,
  MOTION_VIDEO_MIN_EDGE_PX,
  MOTION_VIDEO_MIN_SEC,
} from './motionControl'

function loadVideoMeta(file: File): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không đọc được metadata video'))
    }
    video.src = url
  })
}

export async function validateMotionVideoFile(file: File): Promise<string | null> {
  try {
    const { width, height, duration } = await loadVideoMeta(file)
    const short = Math.min(width, height)
    const long = Math.max(width, height)
    if (short < MOTION_VIDEO_MIN_EDGE_PX) {
      return `Cạnh ngắn video tối thiểu ${MOTION_VIDEO_MIN_EDGE_PX}px (hiện ${short}px)`
    }
    if (long > MOTION_VIDEO_MAX_EDGE_PX) {
      return `Cạnh dài video tối đa ${MOTION_VIDEO_MAX_EDGE_PX}px (hiện ${long}px)`
    }
    if (duration < MOTION_VIDEO_MIN_SEC - 0.2) {
      return `Video chuyển động cần ${MOTION_VIDEO_MIN_SEC}–${MOTION_VIDEO_MAX_SEC}s (hiện ${duration.toFixed(1)}s)`
    }
    if (duration > MOTION_VIDEO_MAX_SEC + 0.5) {
      return `Video chuyển động tối đa ${MOTION_VIDEO_MAX_SEC}s (hiện ${duration.toFixed(1)}s)`
    }
    return null
  } catch {
    return 'Không đọc được file video — thử MP4 hoặc WebM'
  }
}

export async function getVideoDurationSec(file: File): Promise<number | null> {
  try {
    const meta = await loadVideoMeta(file)
    return Math.round(meta.duration)
  } catch {
    return null
  }
}

export async function validateImageFileDimensions(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width < 300 || img.height < 300) {
        resolve('Ảnh nhân vật tối thiểu 300×300px')
        return
      }
      resolve(null)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve('Không đọc được file ảnh')
    }
    img.src = url
  })
}

export async function validateVideoFileDimensions(file: File): Promise<string | null> {
  try {
    const { width, height } = await loadVideoMeta(file)
    if (width < 300 || height < 300) {
      return 'Video tối thiểu 300×300px'
    }
    return null
  } catch {
    return 'Không đọc được file video'
  }
}
