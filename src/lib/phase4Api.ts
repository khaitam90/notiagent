const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

export type Phase4Row = {
  row_number: number
  'Mô tả gốc'?: string
  'Model Video'?: string
  Model?: string
  'Trạng thái'?: string
  'Link Video'?: string
  'Prompt AI tạo'?: string
  Caption?: string
}

export async function fetchPhase4Rows(status?: string): Promise<{ rows: Phase4Row[]; configured: boolean; detail?: string }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  const r = await fetch(`${API_BASE}/api/phase4/rows${q}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function createPhase4Job(body: {
  topic: string
  model_video?: string
  caption?: string
}): Promise<{ ok: boolean; row_number: number }> {
  const r = await fetch(`${API_BASE}/api/phase4/rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function approvePhase4Row(
  rowNumber: number,
  platform: 'tiktok' | 'youtube' | 'both',
): Promise<{ ok: boolean; status: string }> {
  const r = await fetch(`${API_BASE}/api/phase4/rows/${rowNumber}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform }),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function publishPhase4Row(
  rowNumber: number,
  platform: 'tiktok' | 'youtube',
  title: string,
  caption: string,
): Promise<{ ok: boolean; message?: string }> {
  const r = await fetch(`${API_BASE}/api/phase4/rows/${rowNumber}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, title, caption }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(typeof data.detail === 'string' ? data.detail : JSON.stringify(data))
  return data
}
