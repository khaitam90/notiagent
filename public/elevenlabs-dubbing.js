(function () {
  const API = '/api-proxy'
  const LANGS = [
    { id: 'vi', label: 'Tiếng Việt' },
    { id: 'en', label: 'English' },
    { id: 'ja', label: '日本語' },
    { id: 'ko', label: '한국어' },
    { id: 'zh', label: '中文' },
  ]

  let caps = null
  let injected = false

  async function getCaps() {
    if (caps) return caps
    const r = await fetch(`${API}/api/studio/elevenlabs/capabilities`)
    if (!r.ok) throw new Error(await r.text())
    caps = await r.json()
    return caps
  }

  function hideSpeechPanels(main) {
    main.querySelectorAll(':scope > div').forEach((el) => {
      if (!el.classList.contains('el-dub-panel') && !el.classList.contains('el-clone-panel')) {
        el.style.display = 'none'
      }
    })
  }

  function showPanel(main, which) {
    hideSpeechPanels(main)
    main.querySelectorAll('.el-dub-panel,.el-clone-panel').forEach((p) => p.classList.remove('active'))
    if (which === 'dub') main.querySelector('.el-dub-panel')?.classList.add('active')
    if (which === 'clone') main.querySelector('.el-clone-panel')?.classList.add('active')
    if (which === 'default') {
      main.querySelectorAll(':scope > div').forEach((el) => {
        if (!el.classList.contains('el-dub-panel') && !el.classList.contains('el-clone-panel')) {
          el.style.display = ''
        }
      })
    }
  }

  function buildDubPanel() {
    const panel = document.createElement('div')
    panel.className = 'el-dub-panel'
    panel.innerHTML = `
      <header class="el-hero">
        <span class="el-kicker">Dubbing · Lip-sync</span>
        <h1>Video nhép miệng chân thực</h1>
        <p>Upload video — ElevenLabs đồng bộ khẩu hình & giọng.</p>
        <small class="el-dub-note" data-el-note></small>
      </header>
      <label class="el-pill"><span>Ngôn ngữ đích</span>
        <select data-el-lang>${LANGS.map((l) => `<option value="${l.id}">${l.label}</option>`).join('')}</select>
      </label>
      <input type="file" accept="video/*,audio/*" hidden data-el-file />
      <button type="button" class="el-dub-drop" data-el-pick>
        <strong data-el-fname>Chọn video hoặc audio</strong>
        <span>MP4 · MOV · WebM · MP3</span>
      </button>
      <button type="button" class="el-dub-btn" data-el-run>Tạo dubbing nhép miệng</button>
      <div class="el-dub-progress" hidden><div class="el-dub-progress-bar" data-el-bar style="width:0%"></div></div>
      <p class="el-dub-status" data-el-status></p>
      <video class="el-dub-preview" controls hidden data-el-video></video>
    `
    return panel
  }

  function buildClonePanel() {
    const panel = document.createElement('div')
    panel.className = 'el-clone-panel'
    panel.innerHTML = `
      <header class="el-hero">
        <span class="el-kicker">Voice Clone</span>
        <h1>Nhân bản giọng từ mẫu audio</h1>
        <p>Upload 1–3 clip giọng rõ (~30s).</p>
      </header>
      <input class="el-clone-name" placeholder="Tên giọng (VD: MC Sếp)" data-el-cname />
      <input type="file" accept="audio/*" multiple hidden data-el-cfiles />
      <button type="button" class="el-dub-drop" data-el-cpick>
        <strong data-el-cfn>Chọn mẫu audio</strong>
        <span>MP3 · WAV · M4A</span>
      </button>
      <button type="button" class="el-dub-btn" data-el-crun>Tạo voice clone</button>
      <p class="el-dub-status" data-el-cstatus></p>
    `
    return panel
  }

  async function pollJob(jobId, onProg) {
    const start = Date.now()
    for (;;) {
      const r = await fetch(`${API}/api/studio/elevenlabs/dubbing/${jobId}`)
      if (!r.ok) throw new Error(await r.text())
      const job = await r.json()
      onProg(job)
      if (job.status === 'success' || job.status === 'failed') return job
      if (Date.now() - start > 30 * 60 * 1000) throw new Error('Hết thời gian chờ dubbing')
      await new Promise((res) => setTimeout(res, 4000))
    }
  }

  async function inject(workspace) {
    if (injected) return
    injected = true
    const nav = workspace.querySelector('.el-nav-list')
    const main = workspace.querySelector('.el-main')
    if (!nav || !main) return

    try {
      const c = await getCaps()
      const note = main.querySelector('[data-el-note]')
      if (note && c.dubbing_v2_note) note.textContent = c.dubbing_v2_note
    } catch (_) { /* ignore */ }

    const dubNav = document.createElement('button')
    dubNav.type = 'button'
    dubNav.className = 'el-nav-item el-dubbing-patch-nav'
    dubNav.innerHTML = '<span class="el-nav-label">Dubbing / Lip-sync</span><span class="el-nav-short">Dub</span>'
    const cloneNav = document.createElement('button')
    cloneNav.type = 'button'
    cloneNav.className = 'el-nav-item el-dubbing-patch-nav'
    cloneNav.innerHTML = '<span class="el-nav-label">Voice Clone</span><span class="el-nav-short">Clone</span>'

    const speechBtn = nav.querySelector('.el-nav-item')
    nav.insertBefore(cloneNav, speechBtn?.nextSibling?.nextSibling || null)
    nav.insertBefore(dubNav, cloneNav)

    main.appendChild(buildDubPanel())
    main.appendChild(buildClonePanel())

    const dubPanel = main.querySelector('.el-dub-panel')
    const fileInput = dubPanel.querySelector('[data-el-file]')
    const pickBtn = dubPanel.querySelector('[data-el-pick]')
    const runBtn = dubPanel.querySelector('[data-el-run]')
    const statusEl = dubPanel.querySelector('[data-el-status]')
    const barWrap = dubPanel.querySelector('.el-dub-progress')
    const bar = dubPanel.querySelector('[data-el-bar]')
    const video = dubPanel.querySelector('[data-el-video]')
    const fname = dubPanel.querySelector('[data-el-fname]')
    let dubFile = null

    pickBtn.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', () => {
      dubFile = fileInput.files?.[0] || null
      fname.textContent = dubFile ? dubFile.name : 'Chọn video hoặc audio'
    })

    dubNav.addEventListener('click', () => {
      nav.querySelectorAll('.el-nav-item').forEach((b) => b.classList.remove('active'))
      dubNav.classList.add('active')
      showPanel(main, 'dub')
    })
    cloneNav.addEventListener('click', () => {
      nav.querySelectorAll('.el-nav-item').forEach((b) => b.classList.remove('active'))
      cloneNav.classList.add('active')
      showPanel(main, 'clone')
    })
    nav.querySelectorAll('.el-nav-item:not(.el-dubbing-patch-nav)').forEach((btn) => {
      btn.addEventListener('click', () => showPanel(main, 'default'))
    })

    runBtn.addEventListener('click', async () => {
      if (!dubFile) return
      try {
        const c = await getCaps()
        if (!c.elevenlabs_direct) {
          statusEl.textContent = 'Cần ELEVENLABS_API_KEY trong .env.ai'
          return
        }
      } catch (e) {
        statusEl.textContent = e.message || 'Lỗi capabilities'
        return
      }
      runBtn.disabled = true
      barWrap.hidden = false
      bar.style.width = '8%'
      statusEl.textContent = 'Đang gửi lên ElevenLabs…'
      try {
        const fd = new FormData()
        fd.append('file', dubFile, dubFile.name)
        fd.append('target_lang', dubPanel.querySelector('[data-el-lang]').value)
        fd.append('source_lang', 'auto')
        const cr = await fetch(`${API}/api/studio/elevenlabs/dubbing`, { method: 'POST', body: fd })
        if (!cr.ok) throw new Error(await cr.text())
        const created = await cr.json()
        const done = await pollJob(created.job_id, (j) => {
          bar.style.width = `${j.progress || 15}%`
          statusEl.textContent = j.message || `Đang xử lý… ${j.eleven_status || j.status}`
        })
        if (done.status !== 'success' || !done.output_url) throw new Error(done.error || 'Dubbing thất bại')
        const url = done.output_url.startsWith('http') ? done.output_url : `${API}${done.output_url}`
        video.src = url
        video.hidden = false
        bar.style.width = '100%'
        statusEl.textContent = `Hoàn tất · nhép miệng ${dubPanel.querySelector('[data-el-lang]').value.toUpperCase()}`
      } catch (e) {
        statusEl.textContent = e.message || 'Dubbing lỗi'
      } finally {
        runBtn.disabled = false
      }
    })

    const clonePanel = main.querySelector('.el-clone-panel')
    const cfiles = clonePanel.querySelector('[data-el-cfiles]')
    const cpick = clonePanel.querySelector('[data-el-cpick]')
    const crun = clonePanel.querySelector('[data-el-crun]')
    const cstatus = clonePanel.querySelector('[data-el-cstatus]')
    const cfn = clonePanel.querySelector('[data-el-cfn]')
    let samples = []

    cpick.addEventListener('click', () => cfiles.click())
    cfiles.addEventListener('change', () => {
      samples = Array.from(cfiles.files || [])
      cfn.textContent = samples.length ? `${samples.length} file đã chọn` : 'Chọn mẫu audio'
    })
    crun.addEventListener('click', async () => {
      const name = clonePanel.querySelector('[data-el-cname]').value.trim()
      if (!name || !samples.length) return
      try {
        const c = await getCaps()
        if (!c.elevenlabs_direct) {
          cstatus.textContent = 'Cần ELEVENLABS_API_KEY trong .env.ai'
          return
        }
      } catch (e) {
        cstatus.textContent = e.message || 'Lỗi'
        return
      }
      crun.disabled = true
      cstatus.textContent = 'Đang tạo voice clone…'
      try {
        const fd = new FormData()
        fd.append('name', name)
        fd.append('description', '')
        samples.forEach((f) => fd.append('files', f, f.name))
        const r = await fetch(`${API}/api/studio/elevenlabs/voice-clone`, { method: 'POST', body: fd })
        if (!r.ok) throw new Error(await r.text())
        const res = await r.json()
        cstatus.textContent = `Đã tạo giọng «${res.name}» — chọn trong tab TTS (voice_id: ${res.voice_id.slice(0, 14)}…)`
      } catch (e) {
        cstatus.textContent = e.message || 'Clone lỗi'
      } finally {
        crun.disabled = false
      }
    })
  }

  const obs = new MutationObserver(() => {
    const ws = document.querySelector('.el-workspace')
    if (ws) inject(ws).catch(() => {})
  })
  obs.observe(document.body, { childList: true, subtree: true })
  const ws0 = document.querySelector('.el-workspace')
  if (ws0) inject(ws0).catch(() => {})
})()
