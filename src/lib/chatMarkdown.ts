/** Render Markdown cơ bản cho chat — bảng, bold, danh sách. */
export function normalizeChatMarkdown(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .trim()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inlineFormat(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function isTableRow(line: string): boolean {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|') && t.includes('|')
}

function isSeparatorRow(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line.trim())
}

function parseTableRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|').map((c) => c.trim())
}

function renderTable(lines: string[]): string {
  const rows = lines.map(parseTableRow)
  const header = rows[0] ?? []
  const body = rows.slice(2)
  const thead = `<thead><tr>${header.map((c) => `<th>${inlineFormat(c)}</th>`).join('')}</tr></thead>`
  const tbody = `<tbody>${body
    .map((row) => `<tr>${row.map((c) => `<td>${inlineFormat(c).replace(/\n/g, '<br/>')}</td>`).join('')}</tr>`)
    .join('')}</tbody>`
  return `<div class="chat-md-table-wrap"><table class="chat-md-table">${thead}${tbody}</table></div>`
}

/** Chuyển Markdown → HTML an toàn cho bubble chat. */
export function chatMarkdownToHtml(raw: string): string {
  const text = normalizeChatMarkdown(raw)
  if (!text) return ''

  const lines = text.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const tableLines: string[] = [line, lines[i + 1]]
      i += 2
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i])
        i += 1
      }
      out.push(renderTable(tableLines))
      continue
    }

    if (!line.trim()) {
      i += 1
      continue
    }

    const para: string[] = [line]
    i += 1
    while (i < lines.length && lines[i].trim() && !isTableRow(lines[i])) {
      para.push(lines[i])
      i += 1
    }
    const joined = para.join('\n')
    const html = inlineFormat(joined).replace(/\n/g, '<br/>')
    if (/^[-*•]\s/.test(line.trim())) {
      out.push(`<ul class="chat-md-list">${para.map((p) => `<li>${inlineFormat(p.replace(/^[-*•]\s+/, ''))}</li>`).join('')}</ul>`)
    } else {
      out.push(`<p class="chat-md-p">${html}</p>`)
    }
  }

  return out.join('')
}
