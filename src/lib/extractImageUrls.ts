/** Trích mọi URL ảnh từ response /api/image (Fal, OpenRouter, …) */
export function extractImageUrls(res: Record<string, unknown>): string[] {
  const urls: string[] = []
  const add = (raw: unknown) => {
    if (typeof raw !== 'string' || !raw.startsWith('http')) return
    if (!urls.includes(raw)) urls.push(raw)
  }

  if (Array.isArray(res.imageUrls)) {
    for (const u of res.imageUrls) add(u)
  }
  add(res.imageUrl)
  add(res.url)

  const images = res.images
  if (Array.isArray(images)) {
    for (const item of images) {
      if (typeof item === 'string') {
        add(item)
        continue
      }
      if (!item || typeof item !== 'object') continue
      const obj = item as Record<string, unknown>
      add(obj.url)
      const iu = obj.image_url
      if (typeof iu === 'string') add(iu)
      else if (iu && typeof iu === 'object') add((iu as { url?: string }).url)
    }
  }

  return urls
}
