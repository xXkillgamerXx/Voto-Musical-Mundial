<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { uploadAdminImage } from '../../../src/services/api/adminApi'
import { compressImageFile, slugifyImageBase } from '../lib/compressImage'
import {
  collapseNewsEmbeds,
  editorEmbedHtml,
  embedUrlFromHtml,
  expandNewsEmbedsForEditor,
  firstEmbeddableUrl,
  isEmbeddableUrl,
} from '../lib/embeds'
import { formatHtmlForEdit, normalizeEditorHtml } from '../lib/formatHtml'

const props = defineProps<{ defaultAlt?: string }>()
const content = defineModel<string>({ default: '' })
const mode = ref<'visual' | 'html'>('visual')
const editor = ref<HTMLElement | null>(null)
const htmlBox = ref<HTMLTextAreaElement | null>(null)
const uploading = ref(false)
const uploadError = ref('')
/** Ignore model→DOM sync while we push DOM→model (or programmatic model writes). */
let skipWatch = false
let syncEpoch = 0

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const clampVideoHeight = (value: unknown) =>
  Math.min(900, Math.max(180, Number.parseInt(String(value || ''), 10) || 420))

const videoStyle = (heightPx: number) =>
  `width:100%;height:${heightPx}px;max-height:${heightPx}px;object-fit:contain;background:#0b1220;border-radius:12px`

const mediaToolbar = (label: string, extra = '') =>
  `<div class="na-media-toolbar" contenteditable="false"><button type="button" class="na-media-drag" draggable="true" title="Arrastrar para mover">⠿</button><span class="na-media-label">${label}</span>${extra}<span class="na-media-actions"><button type="button" class="na-media-move-up" title="Subir">↑</button><button type="button" class="na-media-move-down" title="Bajar">↓</button><button type="button" class="na-media-remove" title="Quitar" aria-label="Quitar">×</button></span></div>`

let dragMediaBlock: HTMLElement | null = null

const clearMediaDropMarks = () => {
  editor.value
    ?.querySelectorAll('.na-media-drop-before, .na-media-drop-after')
    .forEach((el) => el.classList.remove('na-media-drop-before', 'na-media-drop-after'))
}

const finishMediaDrag = () => {
  dragMediaBlock?.classList.remove('na-media-dragging')
  clearMediaDropMarks()
  dragMediaBlock = null
}

const onEditorDragStart = (event: DragEvent) => {
  const target = event.target as HTMLElement | null
  const root = editor.value
  if (!target || !root) return
  const handle = target.closest('.na-media-drag')
  const block = handle?.closest(MEDIA_BLOCK_SEL) as HTMLElement | null
  if (!handle || !block || !root.contains(block)) {
    // Block native image drag; only the ⠿ handle moves media.
    if (target.closest(MEDIA_BLOCK_SEL)) event.preventDefault()
    return
  }
  dragMediaBlock = block
  block.classList.add('na-media-dragging')
  clearMediaDropMarks()
  event.dataTransfer?.setData('text/plain', 'na-media-block')
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const onEditorDragOver = (event: DragEvent) => {
  if (!dragMediaBlock || !editor.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  clearMediaDropMarks()
  const target = (event.target as HTMLElement | null)?.closest(MEDIA_BLOCK_SEL) as HTMLElement | null
  if (!target || target === dragMediaBlock || !editor.value.contains(target)) return
  const rect = target.getBoundingClientRect()
  const before = event.clientY < rect.top + rect.height / 2
  target.classList.add(before ? 'na-media-drop-before' : 'na-media-drop-after')
}

const onEditorDrop = (event: DragEvent) => {
  if (!dragMediaBlock || !editor.value) return
  event.preventDefault()
  event.stopPropagation()
  const marked = editor.value.querySelector(
    '.na-media-drop-before, .na-media-drop-after',
  ) as HTMLElement | null
  if (marked && marked !== dragMediaBlock && editor.value.contains(marked)) {
    if (marked.classList.contains('na-media-drop-before')) marked.before(dragMediaBlock)
    else marked.after(dragMediaBlock)
    ensureMediaGaps()
    placeCaretIn(dragMediaBlock.nextElementSibling)
    syncFromEditor()
  }
  finishMediaDrag()
}

const onEditorDragEnd = () => {
  finishMediaDrag()
}

const MEDIA_BLOCK_SEL =
  '.na-media-block, .na-video-block, .na-image-block, .wp-block-video, .wp-block-image'

const isGapParagraph = (el: Element | null | undefined) => {
  if (!el || el.tagName !== 'P') return false
  const text = (el.textContent || '').replace(/\u200B/g, '').trim()
  return !text
}

const makeGapParagraph = () => {
  const p = document.createElement('p')
  p.innerHTML = '<br>'
  return p
}

const collapseExtraGaps = (root: HTMLElement) => {
  let el = root.firstElementChild
  while (el) {
    const next = el.nextElementSibling
    if (isGapParagraph(el) && isGapParagraph(next)) {
      next?.remove()
      continue
    }
    el = next
  }
}

/** Always keep a clickable empty paragraph above/below every media block. */
const ensureMediaGaps = () => {
  const root = editor.value
  if (!root) return
  const blocks = Array.from(root.querySelectorAll(MEDIA_BLOCK_SEL)).filter(
    (el) => el.parentElement === root,
  )
  for (const block of blocks) {
    if (!isGapParagraph(block.previousElementSibling)) block.before(makeGapParagraph())
    if (!isGapParagraph(block.nextElementSibling)) block.after(makeGapParagraph())
  }
  collapseExtraGaps(root)
}

const placeCaretIn = (node: Node | null) => {
  if (!editor.value || !node) return
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  if (node.nodeType === Node.ELEMENT_NODE) {
    range.selectNodeContents(node)
    range.collapse(true)
  } else {
    range.setStart(node, 0)
    range.collapse(true)
  }
  sel.removeAllRanges()
  sel.addRange(range)
  editor.value.focus()
}

const moveMediaBlock = (block: Element, dir: -1 | 1) => {
  const root = editor.value
  if (!root || block.parentElement !== root) return
  let sibling = dir < 0 ? block.previousElementSibling : block.nextElementSibling
  while (sibling && isGapParagraph(sibling)) {
    sibling = dir < 0 ? sibling.previousElementSibling : sibling.nextElementSibling
  }
  if (!sibling) return
  if (dir < 0) sibling.before(block)
  else sibling.after(block)
  ensureMediaGaps()
  placeCaretIn(dir < 0 ? block.previousElementSibling : block.nextElementSibling)
  syncFromEditor()
}

/** Editor chrome around uploaded videos (remove + height). Stripped on save. */
const editorVideoBlockHtml = (src: string, heightPx: number) => {
  const h = clampVideoHeight(heightPx)
  const safeSrc = escapeAttr(src)
  const heightControl = `<label class="na-media-height-wrap">Altura del video <input class="na-video-height" type="number" min="180" max="900" step="10" value="${h}" /></label>`
  return `<figure class="wp-block-video na-media-block na-video-block" contenteditable="false" data-video-height="${h}">${mediaToolbar('Video', heightControl)}<video src="${safeSrc}" controls playsinline preload="metadata" style="${videoStyle(h)}"></video></figure>`
}

/** Editor chrome around images (remove). Stripped on save. */
const editorImageBlockHtml = (src: string, alt: string, caption: string) => {
  const safeSrc = escapeAttr(src)
  const safeAlt = escapeAttr(alt)
  const cap = caption.trim() ? `<figcaption>${escapeAttr(caption.trim())}</figcaption>` : ''
  return `<figure class="wp-block-image na-media-block na-image-block" contenteditable="false">${mediaToolbar('Imagen')}<img src="${safeSrc}" alt="${safeAlt}" draggable="false" />${cap}</figure>`
}

const expandEditorVideos = (html: string) =>
  String(html || '').replace(
    /<figure\b([^>]*\bwp-block-video\b[^>]*)>([\s\S]*?)<\/figure>/gi,
    (_full, _attrs: string, inner: string) => {
      const src = String(inner.match(/<video\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '').trim()
      if (!src) return _full
      const fromData = Number(String(_full).match(/data-video-height=["']?(\d+)/i)?.[1] || 0)
      const fromStyle = Number(String(inner).match(/height\s*:\s*(\d+)px/i)?.[1] || 0)
      return editorVideoBlockHtml(src.replace(/&amp;/g, '&'), fromData || fromStyle || 420)
    },
  )

const expandEditorImages = (html: string) =>
  String(html || '').replace(
    /<figure\b([^>]*\bwp-block-image\b[^>]*)>([\s\S]*?)<\/figure>/gi,
    (_full, _attrs: string, inner: string) => {
      if (/\bna-image-block\b/.test(_full) && /\bna-media-toolbar\b/.test(inner)) return _full
      const src = String(inner.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '').trim()
      if (!src) return _full
      const alt = String(inner.match(/<img\b[^>]*\balt=["']([^"']*)["']/i)?.[1] || '').trim()
      const caption = String(inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || '')
        .replace(/<[^>]+>/g, '')
        .trim()
      return editorImageBlockHtml(src.replace(/&amp;/g, '&'), alt.replace(/&amp;/g, '&'), caption)
    },
  )

const collapseEditorVideos = (html: string) =>
  String(html || '').replace(
    /<figure\b([^>]*\bwp-block-video\b[^>]*)>([\s\S]*?)<\/figure>/gi,
    (_full, attrs: string, inner: string) => {
      const src = String(inner.match(/<video\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '').trim()
      if (!src) return ''
      const fromData = Number(String(attrs).match(/data-video-height=["']?(\d+)/i)?.[1] || 0)
      const fromInput = Number(String(inner).match(/class="na-video-height"[^>]*value=["']?(\d+)/i)?.[1] || 0)
      const fromStyle = Number(String(inner).match(/height\s*:\s*(\d+)px/i)?.[1] || 0)
      const h = clampVideoHeight(fromData || fromInput || fromStyle || 420)
      return `<figure class="wp-block-video"><video src="${src}" controls playsinline preload="metadata" style="${videoStyle(h)}"></video></figure>`
    },
  )

const collapseEditorImages = (html: string) =>
  String(html || '').replace(
    /<figure\b([^>]*\bwp-block-image\b[^>]*)>([\s\S]*?)<\/figure>/gi,
    (_full, _attrs: string, inner: string) => {
      const src = String(inner.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || '').trim()
      if (!src) return ''
      const alt = String(inner.match(/<img\b[^>]*\balt=["']([^"']*)["']/i)?.[1] || '').trim()
      const caption = String(inner.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || '')
        .replace(/<[^>]+>/g, '')
        .trim()
      const cap = caption ? `<figcaption>${caption}</figcaption>` : ''
      return `<figure class="wp-block-image"><img src="${src}" alt="${alt}" />${cap}</figure>`
    },
  )

const collapseEditorMedia = (html: string) => collapseEditorImages(collapseEditorVideos(html))

const editorSnapshot = () =>
  editor.value
    ? normalizeEditorHtml(collapseNewsEmbeds(collapseEditorMedia(editor.value.innerHTML)))
    : ''

const beginModelWrite = () => {
  skipWatch = true
  syncEpoch += 1
  const epoch = syncEpoch
  return () => {
    void nextTick(() => {
      if (epoch === syncEpoch) skipWatch = false
    })
  }
}

const syncFromEditor = () => {
  if (!editor.value) return
  const end = beginModelWrite()
  content.value = editorSnapshot()
  end()
}

const fillEditor = async (html: string) => {
  await nextTick()
  if (!editor.value || mode.value !== 'visual') return
  const cleaned = normalizeEditorHtml(html || '')
  const expanded = expandEditorImages(expandEditorVideos(expandNewsEmbedsForEditor(cleaned)))
  // Avoid wiping a non-empty draft with an empty/stale model write.
  if (!cleaned.trim() && editorSnapshot().trim()) return
  if (editor.value.innerHTML === expanded) {
    ensureMediaGaps()
    return
  }
  editor.value.innerHTML = expanded
  ensureMediaGaps()
  // Keep model in sync when we auto-split jammed label lines.
  if (cleaned !== (html || '')) {
    const end = beginModelWrite()
    content.value = collapseNewsEmbeds(collapseEditorMedia(cleaned))
    end()
  }
}

const showHtmlSource = async (raw: string) => {
  const end = beginModelWrite()
  content.value = formatHtmlForEdit(
    normalizeEditorHtml(collapseNewsEmbeds(collapseEditorMedia(raw || ''))),
  )
  await nextTick()
  end()
  htmlBox.value?.focus()
}

const formatHtmlSource = () => {
  const end = beginModelWrite()
  content.value = formatHtmlForEdit(normalizeEditorHtml(content.value || ''))
  end()
}

watch(content, (html) => {
  if (skipWatch || mode.value !== 'visual') return
  const incoming = normalizeEditorHtml(html || '')
  const current = editorSnapshot()
  if (incoming === current) return
  // Never replace typed body with empty string from a race / accidental save path.
  if (!incoming.trim() && current.trim()) return
  void fillEditor(html || '')
})

watch(mode, async (next) => {
  if (next === 'html') {
    const raw = editor.value ? editor.value.innerHTML : content.value || ''
    await showHtmlSource(raw)
    return
  }
  await fillEditor(content.value || '')
})

const restoreSelection = (range: Range | null) => {
  if (!range || !editor.value) return
  editor.value.focus()
  const sel = window.getSelection()
  if (!sel) return
  sel.removeAllRanges()
  try {
    sel.addRange(range)
  } catch {
    /* range may be detached after async work */
  }
}

const captureSelection = () => {
  const sel = window.getSelection()
  if (!sel || !sel.rangeCount || !editor.value) return null
  const range = sel.getRangeAt(0)
  if (!editor.value.contains(range.commonAncestorContainer)) return null
  return range.cloneRange()
}

type PromptField = {
  key: string
  label: string
  value?: string
  placeholder?: string
  type?: 'text' | 'number' | 'url'
  optional?: boolean
}

type PromptResult = Record<string, string> | null

const promptOpen = ref(false)
const promptTitle = ref('')
const promptHint = ref('')
const promptFields = ref<PromptField[]>([])
const promptValues = ref<Record<string, string>>({})
const promptInput = ref<HTMLInputElement | null>(null)
let promptResolve: ((value: PromptResult) => void) | null = null

const setPromptInputRef = (el: unknown) => {
  promptInput.value = (el as HTMLInputElement | null) || null
}

const closePrompt = (ok: boolean) => {
  const resolve = promptResolve
  promptResolve = null
  promptOpen.value = false
  if (!resolve) return
  if (!ok) {
    resolve(null)
    return
  }
  const out: Record<string, string> = {}
  for (const field of promptFields.value) {
    out[field.key] = String(promptValues.value[field.key] ?? '').trim()
  }
  resolve(out)
}

const askFields = (title: string, fields: PromptField[], hint = '') =>
  new Promise<PromptResult>((resolve) => {
    if (promptResolve) promptResolve(null)
    promptTitle.value = title
    promptHint.value = hint
    promptFields.value = fields
    promptValues.value = Object.fromEntries(fields.map((f) => [f.key, String(f.value ?? '')]))
    promptResolve = resolve
    promptOpen.value = true
    void nextTick(() => {
      promptInput.value?.focus()
      promptInput.value?.select()
    })
  })

const ask = async (message: string, defaultValue = '', opts?: { type?: PromptField['type']; placeholder?: string }) => {
  const result = await askFields(message, [
    {
      key: 'value',
      label: message,
      value: defaultValue,
      type: opts?.type || 'text',
      placeholder: opts?.placeholder,
    },
  ])
  return result ? result.value : null
}

const run = (command: string, value?: string) => {
  editor.value?.focus()
  document.execCommand(command, false, value)
  syncFromEditor()
}

const setBlock = (tag: string) => {
  run('formatBlock', tag)
}

const addLink = async () => {
  const saved = captureSelection()
  const current = document.queryCommandValue('createLink')
  const url = await ask('URL del enlace', current || 'https://', { type: 'url', placeholder: 'https://' })
  if (!url) {
    restoreSelection(saved)
    return
  }
  restoreSelection(saved)
  run('createLink', url)
}

const addQuote = async () => {
  const saved = captureSelection()
  const selected = window.getSelection()?.toString().trim() || ''
  const fields: PromptField[] = selected
    ? [{ key: 'cite', label: 'Autor de la cita (opcional)', value: '', optional: true }]
    : [
        { key: 'quote', label: 'Cita', value: '' },
        { key: 'cite', label: 'Autor (opcional)', value: '', optional: true },
      ]
  const result = await askFields('Insertar cita', fields)
  const quote = selected || result?.quote || ''
  if (!result || !quote.trim()) {
    restoreSelection(saved)
    return
  }
  const cite = result.cite || ''
  const safe = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const citeHtml = cite.trim() ? `<cite>${safe(cite.trim())}</cite>` : ''
  restoreSelection(saved)
  run(
    'insertHTML',
    `<figure class="wp-block-pullquote"><blockquote><p>${safe(quote.trim())}</p>${citeHtml}</blockquote></figure>`,
  )
}

const insertEmbed = (raw: string) => {
  const text = raw.trim()
  if (!text) return
  if (isEmbeddableUrl(text)) {
    run('insertHTML', editorEmbedHtml(text))
    return
  }
  const fromText = firstEmbeddableUrl(text)
  if (fromText) {
    run('insertHTML', editorEmbedHtml(fromText))
    return
  }
  const expanded = expandNewsEmbedsForEditor(text)
  if (expanded.includes('na-embed')) run('insertHTML', expanded)
}

const addEmbed = async () => {
  const saved = captureSelection()
  const url = (
    await ask('Enlace o shortcode embed', 'https://', {
      type: 'url',
      placeholder: 'https://… o [embed]…[/embed]',
    })
  )?.trim()
  if (!url) {
    restoreSelection(saved)
    return
  }
  restoreSelection(saved)
  insertEmbed(url)
}

const safeAttr = escapeAttr

const placeCaretAfter = (node: Node | null) => {
  if (!editor.value || !node) return
  ensureMediaGaps()
  const next =
    node instanceof Element
      ? node.nextElementSibling
      : (node.nextSibling as Element | null)
  placeCaretIn(next && isGapParagraph(next) ? next : node.nextSibling)
}

const onEditorClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null
  const root = editor.value
  if (!target || !root) return

  const removeBtn = target.closest('.na-media-remove, .na-video-remove')
  if (removeBtn) {
    event.preventDefault()
    event.stopPropagation()
    const block = removeBtn.closest(MEDIA_BLOCK_SEL)
    if (block) {
      const gap = makeGapParagraph()
      block.after(gap)
      block.remove()
      ensureMediaGaps()
      placeCaretIn(gap.isConnected ? gap : root.firstElementChild)
    }
    syncFromEditor()
    return
  }

  const moveUp = target.closest('.na-media-move-up')
  const moveDown = target.closest('.na-media-move-down')
  if (moveUp || moveDown) {
    event.preventDefault()
    event.stopPropagation()
    const block = (moveUp || moveDown)?.closest(MEDIA_BLOCK_SEL)
    if (block) moveMediaBlock(block, moveUp ? -1 : 1)
    return
  }

  const gapP = target.closest('p')
  if (gapP && root.contains(gapP) && isGapParagraph(gapP)) {
    placeCaretIn(gapP)
    return
  }

  const media = target.closest(MEDIA_BLOCK_SEL)
  if (
    media &&
    root.contains(media) &&
    !target.closest('button, input, textarea, select, a, video')
  ) {
    const rect = media.getBoundingClientRect()
    const edge = 36
    const nearTop = event.clientY <= rect.top + edge
    const nearBottom = event.clientY >= rect.bottom - edge
    if (nearTop || nearBottom) {
      event.preventDefault()
      ensureMediaGaps()
      placeCaretIn(nearTop ? media.previousElementSibling : media.nextElementSibling)
    }
  }
}

const onEditorInputVideoHeight = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  if (!target?.classList.contains('na-video-height')) return
  const block = target.closest('.na-video-block') as HTMLElement | null
  const video = block?.querySelector('video') as HTMLVideoElement | null
  if (!block || !video) return
  const h = clampVideoHeight(target.value)
  target.value = String(h)
  block.dataset.videoHeight = String(h)
  video.setAttribute('style', videoStyle(h))
  syncFromEditor()
}

const uploadWithRetry = async (file: File) => {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await uploadAdminImage('news-file', file)
    } catch (error) {
      lastError = error
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400))
    }
  }
  throw lastError instanceof Error ? lastError : new Error('No se pudo subir la imagen.')
}

/** Reject audio-only .mp4/.webm that look like video but have no picture track. */
const assertVideoHasPicture = (file: File) =>
  new Promise<void>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    el.preload = 'metadata'
    el.muted = true
    el.playsInline = true
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url)
      el.removeAttribute('src')
      el.load()
      if (ok) resolve()
      else {
        reject(
          new Error(
            'Ese archivo no tiene imagen de video (solo audio). Exporta un MP4 con video H.264 e inténtalo de nuevo.',
          ),
        )
      }
    }
    el.onloadedmetadata = () => {
      const w = Number(el.videoWidth || 0)
      const h = Number(el.videoHeight || 0)
      done(w > 0 && h > 0)
    }
    el.onerror = () => done(false)
    window.setTimeout(() => done(false), 8000)
    el.src = url
  })

const insertUploadedMedia = async (file: File, opts?: { askSeo?: boolean }) => {
  uploading.value = true
  uploadError.value = ''
  const saved = captureSelection()
  const before = editorSnapshot()
  try {
    if (file.type.startsWith('video/')) {
      await assertVideoHasPicture(file)
    }
    const titleBase = slugifyImageBase(props.defaultAlt || '', 'imagen-noticia')
    const prepared =
      file.type.startsWith('image/') && !file.type.includes('gif')
        ? await compressImageFile(file, { maxEdge: 1600, targetBytes: 220_000, fileNameBase: titleBase })
        : file
    const uploaded = await uploadWithRetry(prepared)
    const url = uploaded.path || uploaded.url
    if (!url) throw new Error('La subida no devolvió URL.')
    // If a race emptied the model while we uploaded, restore the snapshot first.
    if (!editorSnapshot().trim() && before.trim()) {
      const end = beginModelWrite()
      content.value = before
      end()
      await fillEditor(before)
    }
    restoreSelection(saved)
    if (file.type.startsWith('video/')) {
      let heightPx = 420
      if (opts?.askSeo !== false) {
        const raw =
          (await ask('Altura del video en px (180–900)', '420', { type: 'number' })) || '420'
        heightPx = clampVideoHeight(raw)
        restoreSelection(saved)
      }
      run('insertHTML', `${editorVideoBlockHtml(url, heightPx)}<p><br></p>`)
      ensureMediaGaps()
      const block = editor.value?.querySelector('.na-media-block.na-video-block:last-of-type') || null
      placeCaretAfter(block)
      syncFromEditor()
      return
    }
    const suggested = String(props.defaultAlt || '').trim() || titleBase || 'Imagen'
    let alt = suggested
    let caption = ''
    if (opts?.askSeo !== false) {
      const seo = await askFields('Datos de la imagen', [
        { key: 'alt', label: 'Texto alternativo (SEO)', value: suggested },
        { key: 'caption', label: 'Pie de foto (opcional)', value: '', optional: true },
      ])
      if (!seo) {
        restoreSelection(saved)
        return
      }
      alt = seo.alt || suggested
      caption = seo.caption || ''
      restoreSelection(saved)
    }
    run('insertHTML', `${editorImageBlockHtml(url, alt.trim() || suggested, caption)}<p><br></p>`)
    ensureMediaGaps()
    const block = editor.value?.querySelector('.na-media-block.na-image-block:last-of-type') || null
    placeCaretAfter(block)
    syncFromEditor()
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'No se pudo subir la imagen.'
    restoreSelection(saved)
  } finally {
    uploading.value = false
  }
}

const clipboardMediaFile = (data: DataTransfer | null) => {
  if (!data) return null
  const fromFiles = Array.from(data.files || []).find(
    (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
  )
  if (fromFiles) return fromFiles
  for (const item of Array.from(data.items || [])) {
    if (item.kind !== 'file') continue
    if (!item.type.startsWith('image/') && !item.type.startsWith('video/')) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}

const onPaste = (event: ClipboardEvent) => {
  const data = event.clipboardData
  if (!data) return

  const media = clipboardMediaFile(data)
  if (media) {
    event.preventDefault()
    void insertUploadedMedia(media, { askSeo: false })
    return
  }

  const plain = String(data.getData('text/plain') || '')
  const html = String(data.getData('text/html') || '')

  // Avoid huge base64 dumps from some editors; force upload path instead.
  if (/data:image\//i.test(html) || /data:image\//i.test(plain)) {
    event.preventDefault()
    uploadError.value = 'Pega la foto/video como archivo o usa el botón Foto/Video.'
    return
  }

  const embedFromPlain = firstEmbeddableUrl(plain)
  if (embedFromPlain) {
    event.preventDefault()
    insertEmbed(embedFromPlain)
    return
  }

  if (/\[embed\b/i.test(plain.trim())) {
    event.preventDefault()
    insertEmbed(plain.trim())
    return
  }

  const embedFromHtml = embedUrlFromHtml(html)
  if (embedFromHtml) {
    event.preventDefault()
    insertEmbed(embedFromHtml)
  }
}

const addImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'
  input.onchange = async () => {
    const [file] = input.files || []
    if (!file) return
    await insertUploadedMedia(file, { askSeo: true })
  }
  input.click()
}

onMounted(() => {
  document.execCommand('defaultParagraphSeparator', false, 'p')
  void fillEditor(content.value || '')
})
</script>

<template>
  <div class="na-wp">
    <div class="na-wp-bar">
      <div class="na-wp-tools">
        <button type="button" title="Negrita" @mousedown.prevent @click="run('bold')"><b>B</b></button>
        <button type="button" title="Cursiva" @mousedown.prevent @click="run('italic')"><i>I</i></button>
        <button type="button" title="Subrayado" @mousedown.prevent @click="run('underline')"><u>U</u></button>
        <button type="button" title="Tachado" @mousedown.prevent @click="run('strikeThrough')"><s>S</s></button>
        <span></span>
        <button type="button" title="Título" @mousedown.prevent @click="setBlock('h2')">H2</button>
        <button type="button" title="Subtítulo" @mousedown.prevent @click="setBlock('h3')">H3</button>
        <button type="button" title="Párrafo" @mousedown.prevent @click="setBlock('p')">P</button>
        <span></span>
        <button type="button" title="Lista" @mousedown.prevent @click="run('insertUnorderedList')">•</button>
        <button type="button" title="Lista numerada" @mousedown.prevent @click="run('insertOrderedList')">1.</button>
        <button type="button" title="Cita" @mousedown.prevent @click="addQuote">“</button>
        <span></span>
        <button type="button" title="Enlace" @mousedown.prevent @click="addLink">Link</button>
        <button type="button" title="Pegar enlace de YouTube u otro embed" @mousedown.prevent @click="addEmbed">Embed</button>
        <button type="button" title="Insertar foto, GIF o video (mp4/webm)" :disabled="uploading" @mousedown.prevent @click="addImage">
          {{ uploading ? '…' : 'Foto/Video' }}
        </button>
        <button type="button" title="Quitar formato" @mousedown.prevent @click="run('removeFormat')">Tx</button>
      </div>
      <div class="na-wp-tabs">
        <button type="button" :class="{ on: mode === 'visual' }" @click="mode = 'visual'">Escribir</button>
        <button
          type="button"
          class="na-wp-advanced"
          :class="{ on: mode === 'html' }"
          title="Solo avanzado: código HTML interno"
          @click="mode = 'html'"
        >
          HTML
        </button>
        <button
          v-if="mode === 'html'"
          type="button"
          class="na-wp-format"
          title="Ordenar etiquetas HTML"
          @click="formatHtmlSource"
        >
          Formatear
        </button>
      </div>
    </div>
    <p v-if="uploadError" class="na-wp-error" role="alert">{{ uploadError }}</p>
    <p v-if="mode === 'visual'" class="na-wp-hint">
      Escribe aquí como se verá la noticia. Arrastra ⠿ para mover foto/video. Enter = nuevo párrafo.
    </p>
    <div
      v-show="mode === 'visual'"
      ref="editor"
      class="na-wp-visual"
      contenteditable="true"
      data-placeholder="Empieza a escribir el contenido…"
      @input="syncFromEditor"
      @paste="onPaste"
      @click="onEditorClick"
      @change="onEditorInputVideoHeight"
      @dragstart="onEditorDragStart"
      @dragover="onEditorDragOver"
      @drop="onEditorDrop"
      @dragend="onEditorDragEnd"
      @keydown.enter.stop
    ></div>
    <textarea
      v-show="mode === 'html'"
      ref="htmlBox"
      v-model="content"
      class="na-wp-html"
      spellcheck="false"
      wrap="off"
      aria-label="Código HTML interno (avanzado)"
    />

    <div
      v-if="promptOpen"
      class="na-modal na-editor-prompt"
      role="dialog"
      aria-modal="true"
      :aria-label="promptTitle"
      @mousedown.self="closePrompt(false)"
    >
      <form class="na-modal-card na-editor-prompt-card" @submit.prevent="closePrompt(true)">
        <div class="na-modal-head">
          <h2>{{ promptTitle }}</h2>
          <button type="button" class="na-modal-close" aria-label="Cerrar" @click="closePrompt(false)">×</button>
        </div>
        <p v-if="promptHint" class="na-editor-prompt-hint">{{ promptHint }}</p>
        <label v-for="(field, index) in promptFields" :key="field.key" class="na-editor-prompt-field">
          <span>{{ field.label }}</span>
          <input
            :ref="index === 0 ? setPromptInputRef : undefined"
            v-model="promptValues[field.key]"
            :type="field.type || 'text'"
            :placeholder="field.placeholder || ''"
            :required="!field.optional"
          />
        </label>
        <div class="na-form-actions">
          <button type="button" class="na-btn" @click="closePrompt(false)">Cancelar</button>
          <button type="submit" class="na-btn solid">Aceptar</button>
        </div>
      </form>
    </div>
  </div>
</template>
