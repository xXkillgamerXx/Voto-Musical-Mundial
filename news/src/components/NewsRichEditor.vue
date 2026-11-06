<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { uploadAdminImage } from '../../../src/services/api/adminApi'
import { compressImageFile } from '../lib/compressImage'
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
let skipWatch = false

const syncFromEditor = () => {
  if (!editor.value) return
  skipWatch = true
  content.value = normalizeEditorHtml(collapseNewsEmbeds(editor.value.innerHTML))
  queueMicrotask(() => {
    skipWatch = false
  })
}

const fillEditor = async (html: string) => {
  await nextTick()
  if (!editor.value) return
  const cleaned = normalizeEditorHtml(html || '')
  editor.value.innerHTML = expandNewsEmbedsForEditor(cleaned)
  // Keep model in sync when we auto-split jammed label lines.
  if (cleaned !== (html || '')) {
    skipWatch = true
    content.value = collapseNewsEmbeds(cleaned)
    queueMicrotask(() => {
      skipWatch = false
    })
  }
}

const showHtmlSource = async (raw: string) => {
  skipWatch = true
  content.value = formatHtmlForEdit(normalizeEditorHtml(collapseNewsEmbeds(raw || '')))
  await nextTick()
  skipWatch = false
  htmlBox.value?.focus()
}

const formatHtmlSource = () => {
  skipWatch = true
  content.value = formatHtmlForEdit(normalizeEditorHtml(content.value || ''))
  queueMicrotask(() => {
    skipWatch = false
  })
}

watch(content, (html) => {
  if (skipWatch || mode.value !== 'visual') return
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

const run = (command: string, value?: string) => {
  editor.value?.focus()
  document.execCommand(command, false, value)
  syncFromEditor()
}

const setBlock = (tag: string) => {
  run('formatBlock', tag)
}

const addLink = () => {
  const current = document.queryCommandValue('createLink')
  const url = window.prompt('URL del enlace', current || 'https://')
  if (!url) return
  run('createLink', url)
}

const addQuote = () => {
  const selected = window.getSelection()?.toString().trim() || ''
  const quote = selected || window.prompt('Cita', '') || ''
  if (!quote.trim()) return
  const cite = window.prompt('Autor de la cita (opcional)', '') || ''
  const safe = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const citeHtml = cite.trim() ? `<cite>${safe(cite.trim())}</cite>` : ''
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

const addEmbed = () => {
  const url = window.prompt('Pega el enlace o el shortcode [embed]…[/embed]', 'https://')?.trim()
  if (!url) return
  insertEmbed(url)
}

const safeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const insertUploadedMedia = async (file: File, opts?: { askSeo?: boolean }) => {
  uploading.value = true
  uploadError.value = ''
  try {
    const prepared =
      file.type.startsWith('image/') && !file.type.includes('gif')
        ? await compressImageFile(file)
        : file
    const uploaded = await uploadAdminImage('news-file', prepared)
    const url = uploaded.path || uploaded.url
    if (!url) throw new Error('La subida no devolvió URL.')
    if (file.type.startsWith('video/')) {
      run('insertHTML', `<p><video src="${url}" controls playsinline></video></p>`)
      return
    }
    const suggested = String(props.defaultAlt || '').trim() || file.name.replace(/\.[^.]+$/, '') || 'Imagen'
    let alt = suggested
    let caption = ''
    if (opts?.askSeo !== false) {
      alt = window.prompt('Texto alternativo (SEO)', suggested) || suggested
      caption = window.prompt('Pie de foto (opcional)', '') || ''
    }
    const cap = caption.trim() ? `<figcaption>${safeAttr(caption.trim())}</figcaption>` : ''
    run(
      'insertHTML',
      `<figure class="wp-block-image"><img src="${url}" alt="${safeAttr(alt.trim() || suggested)}" />${cap}</figure>`,
    )
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : 'No se pudo subir la imagen.'
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
    uploadError.value = 'Pega la foto como archivo (Ctrl+V de imagen) o usa el botón Img.'
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
        <button type="button" title="Insertar video o embed" @mousedown.prevent @click="addEmbed">Embed</button>
        <button type="button" title="Imagen, GIF o video" :disabled="uploading" @mousedown.prevent @click="addImage">
          {{ uploading ? '…' : 'Img' }}
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
      Escribe aquí como se verá la noticia. Enter = nuevo párrafo. No hace falta ver etiquetas.
    </p>
    <div
      v-show="mode === 'visual'"
      ref="editor"
      class="na-wp-visual"
      contenteditable="true"
      data-placeholder="Empieza a escribir el contenido…"
      @input="syncFromEditor"
      @paste="onPaste"
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
  </div>
</template>
