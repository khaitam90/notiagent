(function () {
  const API = '/api-proxy'
  let caps = null
  const injected = new WeakSet()

  async function getCaps() {
    if (caps) return caps
    const r = await fetch(`${API}/api/studio/heygen/capabilities`)
    if (!r.ok) throw new Error(await r.text())
    caps = await r.json()
    return caps
  }

  function langOptions(c) {
    const langs = c?.languages?.length ? c.languages : [{ id: 'en', label: 'English' }]
    return langs.map((l) => `<option value="${l.id}">${l.label}</option>`).join('')
  }

  async function uploadFile(file) {
    const fd = new FormData()
    fd.append('file', file, file.name)
    fd.append('kind', 'video')
    const r = await fetch(`${API}/api/upload`, { method: 'POST', body: fd })
    if (!r.ok) throw new Error(await r.text())
    const data = await r.json()
    const url = data.url || data.public_url || data.media_url
    if (!url) throw new Error('Upload không trả URL')
    return url.startsWith('http') ? url : `${API}${url}`
  }

  async function pollJob(jobId, onProg) {
    const start = Date.now()
    for (;;) {
      const r = await fetch(`${API}/api/studio/heygen/jobs/${jobId}`)
      if (!r.ok) throw new Error(await r.text())
      const job = await r.json()
      onProg(job)
      if (job.status === 'success' || job.status === 'failed') {
        if (job.output_url && !job.output_url.startsWith('http')) {
          job.output_url = `${API}${job.output_url}`
        }
        return job
      }
      if (Date.now() - start > 40 * 60 * 1000) throw new Error('Hết thời gian chờ')
      await new Promise((res) => setTimeout(res, 5000))
    }
  }

  function isVideoStudio(wrap) {
    const h2 = wrap.querySelector('.sfg-head h2')
    if (!h2) return false
    const t = h2.textContent || ''
    return t.includes('Studio video') || t.includes('Motion Control')
  }

  async function inject(wrap) {
    if (injected.has(wrap)) return
    if (!isVideoStudio(wrap)) return
    let c
    try {
      c = await getCaps()
      if (!c.novita_heygen_translate) return
    } catch (_) {
      return
    }
    injected.add(wrap)

    const panel = document.createElement('div')
    panel.className = 'ls-panel'
    panel.innerHTML = `
      <div class="ls-panel-head">
        <div>
          <h3>Nhép miệng · Dịch video AI</h3>
          <p>Upload video có người nói → đồng bộ khẩu hình & giọng sang ngôn ngữ đích (HeyGen qua Novita)</p>
          <p class="ls-note">${c.vietnamese_note || 'Tiếng Việt: dùng tab ElevenLabs dubbing.'}</p>
        </div>
        <span class="ls-badge">~$2.25/phút</span>
      </div>
      <div class="ls-row">
        <label>Ngôn ngữ đích
          <select data-ls-lang>${langOptions(c)}</select>
        </label>
      </div>
      <input type="file" accept="video/*" hidden data-ls-file />
      <button type="button" class="ls-drop" data-ls-pick>
        <div>
          <strong data-ls-fname>Chọn video MP4/MOV (có người nói)</strong>
          <span>Tối đa 25MB qua upload Studio</span>
        </div>
      </button>
      <button type="button" class="ls-btn" data-ls-run>Bắt đầu nhép miệng</button>
      <div class="ls-progress" hidden><div class="ls-progress-bar" data-ls-bar style="width:0%"></div></div>
      <p class="ls-status" data-ls-status></p>
      <p class="ls-price">Trả theo giây video · không cần gói HeyGen Pro · ví Novita sẵn có</p>
      <video class="ls-preview" controls hidden data-ls-video></video>
    `
    const head = wrap.querySelector('.sfg-head')
    if (head && head.nextSibling) {
      wrap.insertBefore(panel, head.nextSibling)
    } else {
      wrap.prepend(panel)
    }

    const fileInput = panel.querySelector('[data-ls-file]')
    const pickBtn = panel.querySelector('[data-ls-pick]')
    const runBtn = panel.querySelector('[data-ls-run]')
    const statusEl = panel.querySelector('[data-ls-status]')
    const barWrap = panel.querySelector('.ls-progress')
    const bar = panel.querySelector('[data-ls-bar]')
    const video = panel.querySelector('[data-ls-video]')
    const fname = panel.querySelector('[data-ls-fname]')
    let file = null
    let publicUrl = ''

    pickBtn.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', () => {
      file = fileInput.files?.[0] || null
      publicUrl = ''
      fname.textContent = file ? file.name : 'Chọn video MP4/MOV (có người nói)'
    })

    runBtn.addEventListener('click', async () => {
      if (!file && !publicUrl) return
      runBtn.disabled = true
      barWrap.hidden = false
      bar.style.width = '5%'
      statusEl.textContent = 'Đang upload video…'
      try {
        const videoUrl = publicUrl || await uploadFile(file)
        bar.style.width = '15%'
        statusEl.textContent = 'Đang gửi job nhép miệng (HeyGen/Novita)…'
        const cr = await fetch(`${API}/api/studio/heygen/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_url: videoUrl,
            output_language: panel.querySelector('[data-ls-lang]').value,
          }),
        })
        if (!cr.ok) throw new Error(await cr.text())
        const created = await cr.json()
        const done = await pollJob(created.job_id, (j) => {
          bar.style.width = `${Math.max(20, j.progress || 20)}%`
          statusEl.textContent = j.message || `Đang xử lý… ${j.status}`
        })
        if (done.status !== 'success' || !done.output_url) {
          throw new Error(done.error || 'Nhép miệng thất bại')
        }
        video.src = done.output_url
        video.hidden = false
        bar.style.width = '100%'
        statusEl.textContent = 'Hoàn tất — video nhép miệng sẵn sàng'

        const previewCard = wrap.querySelector('.sfg-preview-card')
        if (previewCard) {
          let pv = previewCard.querySelector('video.sfg-preview-media')
          if (!pv) {
            pv = document.createElement('video')
            pv.className = 'sfg-preview-media'
            pv.controls = true
            pv.playsInline = true
            previewCard.appendChild(pv)
          }
          pv.src = done.output_url
          previewCard.classList.add('has-media')
          const headStrong = previewCard.querySelector('.sfg-preview-head strong')
          if (headStrong) headStrong.textContent = 'Kết quả nhép miệng'
        }
      } catch (e) {
        let msg = e.message || 'Lỗi nhép miệng'
        try {
          const parsed = JSON.parse(msg.replace(/^\{/, '{'))
          if (parsed.detail) msg = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail)
        } catch (_) { /* ignore */ }
        statusEl.textContent = msg
      } finally {
        runBtn.disabled = false
      }
    })
  }

  const obs = new MutationObserver(() => {
    document.querySelectorAll('.sfg-wrap').forEach((w) => {
      inject(w).catch(() => {})
    })
  })
  obs.observe(document.body, { childList: true, subtree: true })
  document.querySelectorAll('.sfg-wrap').forEach((w) => inject(w).catch(() => {}))
})()
