import { useCallback, useState, type RefObject } from 'react'
import {
  addStudioAsset,
  loadStudioAssets,
  mentionInsertText,
  type StudioAsset,
} from '../lib/studioAssetLibrary'

type Options = {
  value: string
  onChange: (next: string) => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
}

export function useStudioPromptMention({ value, onChange, textareaRef }: Options) {
  const [assets, setAssets] = useState<StudioAsset[]>(() => loadStudioAssets())
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')

  const refreshAssets = useCallback(() => {
    setAssets(loadStudioAssets())
  }, [])

  const detectMention = useCallback((text: string, cursor: number) => {
    const before = text.slice(0, cursor)
    const match = before.match(/@([^\s@[\]()]*?)$/)
    if (match) {
      setMentionOpen(true)
      setMentionQuery(match[1] ?? '')
    } else {
      setMentionOpen(false)
      setMentionQuery('')
    }
  }, [])

  const handlePromptChange = useCallback((text: string, cursor?: number) => {
    onChange(text)
    const pos = cursor ?? textareaRef.current?.selectionStart ?? text.length
    detectMention(text, pos)
  }, [onChange, detectMention, textareaRef])

  const insertMention = useCallback((asset: StudioAsset) => {
    const ta = textareaRef.current
    const cursor = ta?.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const after = value.slice(cursor)
    const atIdx = before.lastIndexOf('@')
    const prefix = atIdx >= 0 && /@[^\s@[\]()]*$/.test(before.slice(atIdx))
      ? before.slice(0, atIdx)
      : before
    const next = `${prefix}${mentionInsertText(asset)}${after}`
    onChange(next)
    setMentionOpen(false)
    setMentionQuery('')
    requestAnimationFrame(() => {
      if (!ta) return
      ta.focus()
      const pos = prefix.length + mentionInsertText(asset).length
      ta.setSelectionRange(pos, pos)
    })
  }, [onChange, textareaRef, value])

  const openMentionPicker = useCallback(() => {
    refreshAssets()
    const ta = textareaRef.current
    if (!ta) {
      onChange(`${value}@`)
      setMentionOpen(true)
      setMentionQuery('')
      return
    }
    const cursor = ta.selectionStart ?? value.length
    const next = `${value.slice(0, cursor)}@${value.slice(cursor)}`
    onChange(next)
    setMentionOpen(true)
    setMentionQuery('')
    requestAnimationFrame(() => {
      ta.focus()
      const pos = cursor + 1
      ta.setSelectionRange(pos, pos)
    })
  }, [onChange, refreshAssets, textareaRef, value])

  const registerUploadedAsset = useCallback((input: {
    kind: 'image' | 'video'
    name: string
    url: string
    preview?: string
  }) => {
    if (!input.url.startsWith('http')) return null
    const asset = addStudioAsset(input)
    refreshAssets()
    return asset
  }, [refreshAssets])

  return {
    assets,
    mentionOpen,
    mentionQuery,
    refreshAssets,
    handlePromptChange,
    insertMention,
    openMentionPicker,
    registerUploadedAsset,
    closeMention: () => setMentionOpen(false),
  }
}
