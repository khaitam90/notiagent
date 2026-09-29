import type { AssetItem, TimelineClip } from './timeline'
import { generateId } from './uuid'

export type StudioProject = {
  id: string
  name: string
  updatedAt: string
  ratio: string
  duration: number
  clips: TimelineClip[]
  assets: AssetItem[]
  userCreated?: boolean
}

const LIST_KEY = 'noti-studio-projects-v1'
const ACTIVE_KEY = 'noti-studio-active-id'

export const STUDIO_PROJECTS_EVENT = 'studio-projects-updated'

function notifyProjects() {
  window.dispatchEvent(new CustomEvent(STUDIO_PROJECTS_EVENT))
}

export function loadStudioProjects(): StudioProject[] {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as StudioProject[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStudioProjects(list: StudioProject[]) {
  localStorage.setItem(LIST_KEY, JSON.stringify(list))
  notifyProjects()
}

export function listUserProjects(): StudioProject[] {
  return loadStudioProjects().filter((p) => p.userCreated !== false)
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveProjectId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}

export function findStudioProject(id: string): StudioProject | undefined {
  return loadStudioProjects().find((p) => p.id === id)
}

export function upsertStudioProject(data: StudioProject) {
  const list = loadStudioProjects()
  const idx = list.findIndex((p) => p.id === data.id)
  const next = [...list]
  if (idx >= 0) next[idx] = data
  else next.unshift(data)
  saveStudioProjects(next)
  return data
}

export function deleteStudioProject(id: string) {
  saveStudioProjects(loadStudioProjects().filter((p) => p.id !== id))
  if (getActiveProjectId() === id) setActiveProjectId(null)
}

export function createEmptyProject(name: string, ratio = '9:16', duration = 5): StudioProject {
  return {
    id: generateId(),
    name: name.trim() || 'Untitled project',
    updatedAt: new Date().toISOString(),
    ratio,
    duration,
    clips: [],
    assets: [],
    userCreated: true,
  }
}

export function createNamedProject(name: string, ratio = '9:16', duration = 5): StudioProject {
  return createEmptyProject(name, ratio, duration)
}

export function createNamedWorkspace(name: string, ratio = '9:16', duration = 5): StudioProject {
  const p = createNamedProject(name, ratio, duration)
  upsertStudioProject(p)
  return p
}

export function purgeAutoProjects() {
  /* giữ tương thích editor cũ — không còn auto-project rác */
}
