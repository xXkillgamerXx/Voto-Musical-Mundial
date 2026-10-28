<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { uploadAdminImage } from '../../../src/services/api/adminApi'
import { collapseNewsEmbeds, expandNewsEmbedsForEditor, loadTwitterEmbeds } from '../lib/embeds'

const content = defineModel<string>({ default: '' })
const mode = ref<'visual' | 'html'>('visual')
const editor = ref<HTMLElement | null>(null)
const uploading = ref(false)
let skipWatch = false

const syncFromEditor = () => {
  if (!editor.value) return
  skipWatch = true
  content.value = collapseNewsEmbeds(editor.value.innerHTML)
  queueMicrotask(() => {
    skipWatch = false
  })
}

const fillEditor = async (html: string) => {
  await nextTick()
  if (!editor.value) return
  editor.value.innerHTML = expandNewsEmbedsForEditor(html || '')
  loadTwitterEmbeds(editor.value)
}

watch(content, (html) => {
  if (skipWatch || mode.value !== 'visual') return
  void fillEditor(html || '')
})

watch(mode, async (next) => {
  if (next === 'html' && editor.value) {
    skipWatch = true
    content.value = collapseNewsEmbeds(editor.value.innerHTML)
    queueMicrotask(() => {
      skipWatch = false
    })
  }
  if (next === 'visual') await fillEditor(content.value || '')
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

const addImage = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm'
  input.onchange = async () => {
    const [file] = input.files || []
    if (!file) return
    uploading.value = true
    try {
      const uploaded = await uploadAdminImage('news-file', file)
      const url = uploaded.path || uploaded.url
      if (!url) return
      if (file.type.startsWith('video/')) {
        run('insertHTML', `<p><video src="${url}" controls playsinline></video></p>`)
      } else {
        run('insertHTML', `<p><img src="${url}" alt="" /></p>`)
      }
    } finally {
      uploading.value = false
    }
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
        <button type="button" title="Cita" @mousedown.prevent @click="setBlock('blockquote')">“</button>
        <span></span>
        <button type="button" title="Enlace" @mousedown.prevent @click="addLink">Link</button>
        <button type="button" title="Imagen, GIF o video" :disabled="uploading" @mousedown.prevent @click="addImage">
          {{ uploading ? '…' : 'Img' }}
        </button>
        <button type="button" title="Quitar formato" @mousedown.prevent @click="run('removeFormat')">Tx</button>
      </div>
      <div class="na-wp-tabs">
        <button type="button" :class="{ on: mode === 'visual' }" @click="mode = 'visual'">Visual</button>
        <button type="button" :class="{ on: mode === 'html' }" @click="mode = 'html'">Texto</button>
      </div>
    </div>
    <div
      v-show="mode === 'visual'"
      ref="editor"
      class="na-wp-visual"
      contenteditable="true"
      @input="syncFromEditor"
    ></div>
    <textarea
      v-show="mode === 'html'"
      v-model="content"
      class="na-wp-html"
      spellcheck="false"
    />
  </div>
</template>
