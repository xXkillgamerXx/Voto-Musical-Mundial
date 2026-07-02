<script setup>
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'

defineProps({
  placeholder: {
    type: String,
    default: '',
  },
})

const content = defineModel({
  type: String,
  default: '',
})

const toolbar = [
  [{ header: [2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean'],
]
</script>

<template>
  <div class="rich-text-editor">
    <QuillEditor
      v-model:content="content"
      content-type="html"
      theme="snow"
      :placeholder="placeholder"
      :toolbar="toolbar"
    />
  </div>
</template>

<style scoped>
.rich-text-editor :deep(.ql-toolbar.ql-snow) {
  border: 1px solid rgb(255 255 255 / 0.1);
  border-bottom: 0;
  border-radius: 1rem 1rem 0 0;
  background: rgb(15 23 42 / 0.85);
}

.rich-text-editor :deep(.ql-container.ql-snow) {
  min-height: 9rem;
  border: 1px solid rgb(255 255 255 / 0.1);
  border-radius: 0 0 1rem 1rem;
  background: rgb(255 255 255 / 0.05);
  color: #fff;
  font-size: 0.875rem;
}

.rich-text-editor :deep(.ql-editor) {
  min-height: 9rem;
  line-height: 1.6;
}

.rich-text-editor :deep(.ql-editor.ql-blank::before) {
  color: rgb(100 116 139);
  font-style: normal;
}

.rich-text-editor :deep(.ql-snow .ql-stroke) {
  stroke: rgb(226 232 240);
}

.rich-text-editor :deep(.ql-snow .ql-fill) {
  fill: rgb(226 232 240);
}

.rich-text-editor :deep(.ql-snow .ql-picker) {
  color: rgb(226 232 240);
}

.rich-text-editor :deep(.ql-snow .ql-picker-options) {
  background: rgb(15 23 42);
  border-color: rgb(255 255 255 / 0.1);
}

.rich-text-editor :deep(.ql-snow .ql-picker-label:hover),
.rich-text-editor :deep(.ql-snow .ql-picker-label.ql-active),
.rich-text-editor :deep(.ql-snow .ql-picker-item:hover),
.rich-text-editor :deep(.ql-snow .ql-picker-item.ql-selected) {
  color: rgb(244 114 182);
}

.rich-text-editor :deep(.ql-snow.ql-toolbar button:hover),
.rich-text-editor :deep(.ql-snow.ql-toolbar button.ql-active) {
  color: rgb(244 114 182);
}

.rich-text-editor :deep(.ql-snow.ql-toolbar button:hover .ql-stroke),
.rich-text-editor :deep(.ql-snow.ql-toolbar button.ql-active .ql-stroke) {
  stroke: rgb(244 114 182);
}

.rich-text-editor :deep(.ql-snow.ql-toolbar button:hover .ql-fill),
.rich-text-editor :deep(.ql-snow.ql-toolbar button.ql-active .ql-fill) {
  fill: rgb(244 114 182);
}
</style>
