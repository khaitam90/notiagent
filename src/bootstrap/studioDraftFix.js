(function () {
  const DRAFT_PREFIX = 'noti-project-workspace-draft-v1-'
  const GLOBAL_DRAFT = 'noti-studio-global-draft-v1'
  const MAX_PENDING_MS = 12 * 60 * 1000
  const POLL_MS = 5000
  const MAX_POLLS = 150
  const API = '/api-proxy'
  const FALSE_ERROR_RE = /Phiên render đã hết hạn|không có phản hồi/i
  const HEAL_RELOAD_KEY = 'noti-draft-heal-reload-v3'

  const activePolls = new Set()
  let healedStorage = false

  function parseDraft(raw) {
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  }

  function isFalseError(preview) {
    return preview?.status === 'error' && FALSE_ERROR_RE.test(preview.message || '')
  }

  function normalizePreview(preview, draftUpdatedAt) {
    if (!preview) return preview

    if (isFalseError(preview)) {
      healedStorage = true
      if (preview.taskId) {
        return {
          ...preview,
          status: 'pending',
          pendingAt: preview.pendingAt || draftUpdatedAt || new Date().toISOString(),
          message: 'Đang render — đang kiểm tra lại tiến độ…',
        }
      }
      return null
    }

    if (preview.status !== 'pending') return preview
    if (!preview.taskId) return null
    if (!preview.pendingAt) {
      return { ...preview, pendingAt: draftUpdatedAt || new Date().toISOString() }
    }
    return preview
  }

  function isStalePending(preview) {
    if (!preview || preview.status !== 'pending') return false
    if (!preview.taskId) return true
    const at = preview.pendingAt
    if (!at) return false
    return Date.now() - new Date(at).getTime() > MAX_PENDING_MS
  }

  function cleanDraft(draft) {
    if (!draft) return draft
    const before = JSON.stringify(draft.preview || null)
    let preview = normalizePreview(draft.preview, draft.updatedAt)
    if (preview && isStalePending(preview)) {
      preview = {
        status: 'error',
        taskId: preview.taskId,
        message: 'Render quá lâu — bấm Tạo lại hoặc đợi thêm vài phút.',
      }
    }
    if (JSON.stringify(preview || null) !== before) healedStorage = true
    if (preview !== draft.preview) draft.preview = preview
    return draft
  }

  const origGetItem = Storage.prototype.getItem
  const origSetItem = Storage.prototype.setItem

  function saveDraft(key, draft) {
    const cleaned = cleanDraft(draft)
    origSetItem.call(localStorage, key, JSON.stringify({ ...cleaned, updatedAt: new Date().toISOString() }))
  }

  function sweep() {
    try {
      const g = parseDraft(origGetItem.call(localStorage, GLOBAL_DRAFT))
      if (g) saveDraft(GLOBAL_DRAFT, g)
    } catch (_) { /* ignore */ }
    try {
      const keys = []
      for (let i = 0; i < localStorage.length; i += 1) {
        const k = localStorage.key(i)
        if (k?.startsWith(DRAFT_PREFIX)) keys.push(k)
      }
      keys.forEach((k) => {
        const d = parseDraft(origGetItem.call(localStorage, k))
        if (d) saveDraft(k, d)
      })
    } catch (_) { /* ignore */ }
  }

  function patchDraftPreview(taskId, nextPreview) {
    const keys = [GLOBAL_DRAFT]
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k?.startsWith(DRAFT_PREFIX)) keys.push(k)
    }
    for (const key of keys) {
      const d = parseDraft(origGetItem.call(localStorage, key))
      if (!d?.preview || d.preview.taskId !== taskId) continue
      saveDraft(key, { ...d, preview: { ...d.preview, ...nextPreview } })
    }
    window.dispatchEvent(new CustomEvent('noti-studio-preview-resume', { detail: { taskId, preview: nextPreview } }))
  }

  function userLikelyBusy() {
    const active = document.activeElement
    if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return true
    const textareas = document.querySelectorAll('textarea')
    for (const ta of textareas) {
      if (ta.value && ta.value.trim().length > 0) return true
    }
    if (document.querySelector('[class*="loading"], [class*="spin"], .spin')) return true
    return false
  }

  async function pollTask(taskId) {
    if (activePolls.has(taskId)) return
    activePolls.add(taskId)
    try {
      for (let i = 0; i < MAX_POLLS; i += 1) {
        const res = await fetch(`${API}/api/video/status?task_id=${encodeURIComponent(taskId)}`)
        if (!res.ok) break
        const body = await res.json()
        const state = body.state || body.status || (body.data && body.data.state) || 'waiting'
        if (state === 'success' || state === 'ready') {
          const url = (body.resultUrls || body.video_urls || [])[0] || body.videoUrl || body.video_url
          patchDraftPreview(taskId, {
            status: 'ready',
            taskId,
            videoUrl: url,
            message: body.message || 'Video đã sẵn sàng.',
          })
          if (
            window.location.pathname.includes('/studio')
            && !sessionStorage.getItem('noti-resume-done:' + taskId)
            && !userLikelyBusy()
          ) {
            sessionStorage.setItem('noti-resume-done:' + taskId, '1')
            window.location.reload()
          }
          return
        }
        if (state === 'fail' || state === 'error') {
          patchDraftPreview(taskId, {
            status: 'error',
            taskId,
            message: body.failMsg || body.message || 'Render thất bại.',
          })
          return
        }
        await new Promise((r) => setTimeout(r, POLL_MS))
      }
    } catch (_) { /* ignore */ } finally {
      activePolls.delete(taskId)
    }
  }

  function collectPendingTaskIds() {
    const taskIds = new Set()
    const collect = (draft) => {
      const p = normalizePreview(draft?.preview, draft?.updatedAt)
      if (p?.status === 'pending' && p.taskId && !isStalePending(p)) taskIds.add(p.taskId)
    }
    collect(parseDraft(origGetItem.call(localStorage, GLOBAL_DRAFT)))
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k?.startsWith(DRAFT_PREFIX)) continue
      collect(parseDraft(origGetItem.call(localStorage, k)))
    }
    return taskIds
  }

  function resumePendingPolls() {
    collectPendingTaskIds().forEach((id) => { void pollTask(id) })
  }

  function scrubFalseErrorUI() {
    return false
  }

  sweep()

  Storage.prototype.getItem = function patchedGetItem(key) {
    const val = origGetItem.call(this, key)
    if (!val) return val
    if (key === GLOBAL_DRAFT || (typeof key === 'string' && key.startsWith(DRAFT_PREFIX))) {
      const d = parseDraft(val)
      if (d) return JSON.stringify(cleanDraft(d))
    }
    return val
  }

  Storage.prototype.setItem = function patchedSetItem(key, value) {
    if (key === GLOBAL_DRAFT || (typeof key === 'string' && key.startsWith(DRAFT_PREFIX))) {
      const d = parseDraft(value)
      if (d) {
        if (d.preview) d.preview = normalizePreview(d.preview, d.updatedAt || new Date().toISOString())
        return origSetItem.call(this, key, JSON.stringify({ ...cleanDraft(d), updatedAt: new Date().toISOString() }))
      }
    }
    return origSetItem.call(this, key, value)
  }

  const origFetch = window.fetch.bind(window)
  window.fetch = async function patchedFetch(input, init) {
    const res = await origFetch(input, init)
    try {
      const url = typeof input === 'string' ? input : input?.url || ''
      if (url.includes('/api/video/status') && res.ok) {
        const clone = res.clone()
        const body = await clone.json()
        if (body?.data?.state && !body.state) {
          const flat = { ...body, state: body.data.state, status: body.data.state, taskId: body.data.taskId }
          if (body.data.failMsg) flat.failMsg = body.data.failMsg
          if (body.data.resultJson) {
            try {
              const parsed = JSON.parse(body.data.resultJson)
              const urls = parsed?.resultUrls || []
              if (urls[0]) { flat.resultUrls = urls; flat.video_url = urls[0]; flat.videoUrl = urls[0] }
            } catch (_) { /* ignore */ }
          }
          return new Response(JSON.stringify(flat), { status: res.status, headers: res.headers })
        }
      }
      if (url.includes('/api/video') && res.ok && String(init?.method || 'GET').toUpperCase() === 'POST') {
        const clone = res.clone()
        const body = await clone.json()
        if (body?.taskId) setTimeout(resumePendingPolls, 300)
      }
    } catch (_) { /* ignore */ }
    return res
  }

  function afterDom() {
    resumePendingPolls()
    scrubFalseErrorUI()
  }

  if (healedStorage && !sessionStorage.getItem(HEAL_RELOAD_KEY)) {
    sessionStorage.setItem(HEAL_RELOAD_KEY, '1')
    window.location.reload()
    return
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', afterDom)
  } else {
    afterDom()
  }
})()
