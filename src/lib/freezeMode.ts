const API_BASE = import.meta.env.VITE_API_URL || '/api-proxy'

export type FreezeStatus = {
  active: boolean
  mode: string | null
  message: string
  allowed_features: string[] | null
  unlock_command: string
}

let cached: FreezeStatus | null = null

export async function fetchFreezeStatus(force = false): Promise<FreezeStatus> {
  if (cached && !force) return cached
  try {
    const r = await fetch(`${API_BASE}/api/freeze/status`)
    if (!r.ok) throw new Error(String(r.status))
    cached = (await r.json()) as FreezeStatus
    return cached
  } catch {
    cached = {
      active: false,
      mode: null,
      message: 'Không đọc được trạng thái đóng băng.',
      allowed_features: null,
      unlock_command: '/mokhoa',
    }
    return cached
  }
}

export function isStudioImageVideoFreeze(status: FreezeStatus | null): boolean {
  return !!status?.active
}
