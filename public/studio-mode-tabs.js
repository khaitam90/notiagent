(function () {
  const MODES = [
    { id: 'video', label: 'Video' },
    { id: 'image', label: 'Hình ảnh' },
    { id: 'auto', label: 'Tự động' },
  ]

  function currentLabel(chip) {
    const spans = chip.querySelectorAll('span')
    for (const s of spans) {
      const t = s.textContent?.trim()
      if (t && MODES.some((m) => m.label === t)) return t
    }
    return chip.textContent?.trim() || ''
  }

  function pickMode(menu, label) {
    const opts = menu.querySelectorAll('.sh-ai-mode-opt')
    for (const opt of opts) {
      const strong = opt.querySelector('strong')
      if (strong?.textContent?.trim() === label) {
        opt.click()
        return true
      }
    }
    return false
  }

  function syncTabs(tabs, chip) {
    const active = currentLabel(chip)
    tabs.querySelectorAll('.noti-mode-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.textContent?.trim() === active)
    })
  }

  function enhance() {
    const head = document.querySelector('.sh-ai-composer-head')
    if (!head || head.classList.contains('noti-has-mode-tabs')) return

    const chip = head.querySelector('.sh-ai-mode-chip')
    const menu = head.querySelector('.sh-ai-mode-menu')
    if (!chip || !menu) return

    const tabs = document.createElement('div')
    tabs.className = 'noti-mode-tabs'
    tabs.setAttribute('role', 'tablist')
    tabs.setAttribute('aria-label', 'Chế độ Studio')

    for (const m of MODES) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'noti-mode-tab'
      btn.textContent = m.label
      btn.setAttribute('role', 'tab')
      btn.addEventListener('click', () => {
        pickMode(menu, m.label)
        syncTabs(tabs, chip)
      })
      tabs.appendChild(btn)
    }

    head.classList.add('noti-has-mode-tabs')
    head.insertBefore(tabs, head.firstChild)
    syncTabs(tabs, chip)

    const mo = new MutationObserver(() => syncTabs(tabs, chip))
    mo.observe(chip, { subtree: true, childList: true, characterData: true })
  }

  const rootObs = new MutationObserver(() => enhance())
  rootObs.observe(document.documentElement, { childList: true, subtree: true })
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance)
  } else {
    enhance()
  }
})()
