import { findStudioAsset, parseMentionIds, type StudioAsset } from './studioAssetLibrary'

export function stripMentionTokens(text: string): string {
  return text
    .replace(/@\[([^\]]+)\]\(asset:[a-f0-9-]+\)\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function resolveMentionAssets(text: string): StudioAsset[] {
  const ids = parseMentionIds(text)
  const seen = new Set<string>()
  const out: StudioAsset[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const a = findStudioAsset(id)
    if (a?.url) {
      seen.add(id)
      out.push(a)
    }
  }
  return out
}

export function resolveMentionUrls(text: string): string[] {
  return resolveMentionAssets(text)
    .map((a) => a.url)
    .filter((u) => u.startsWith('http'))
}

export function buildPromptWithMentionContext(text: string): string {
  const clean = stripMentionTokens(text)
  const assets = resolveMentionAssets(text)
  if (!assets.length) return clean
  const refs = assets.map((a) => a.name).join(', ')
  return clean ? `${clean} (tham chiếu: ${refs})` : `Theo tham chiếu: ${refs}`
}
