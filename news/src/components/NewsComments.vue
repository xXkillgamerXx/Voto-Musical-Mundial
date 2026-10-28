<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { getCurrentApiAuth, getMe } from '../../../src/services/api/authApi'
import { onStoredAuthChange } from '../../../src/services/api/client'
import { getNewsComments, postNewsComment } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'
import { withLocale } from '../lib/locale'
import { formatNewsDate } from '../lib/news'

type CommentItem = {
  id: string
  authorName: string
  authorUsername?: string
  authorPhotoUrl?: string
  body: string
  createdAt?: string
}

const props = defineProps<{ slug: string; locale?: string }>()
const loc = computed(() => (props.locale === 'en' ? 'en' : 'es'))
const items = ref<CommentItem[]>([])
const loading = ref(true)
const sending = ref(false)
const errorMessage = ref('')
const draft = ref('')
const isAuthed = (auth = getCurrentApiAuth()) => Boolean(auth?.accessToken && auth.user && !auth.user.isAnonymous)
const signedIn = ref(isAuthed())
const mePhoto = ref('')

const loadMe = async () => {
  signedIn.value = isAuthed()
  if (!signedIn.value) {
    mePhoto.value = ''
    return
  }
  try {
    const me = await getMe()
    mePhoto.value = me?.photoUrl || me?.photoURL || ''
  } catch {
    mePhoto.value = ''
  }
}

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    const payload = await getNewsComments(props.slug, loc.value)
    items.value = payload.items || []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

const openLogin = () => {
  window.location.hash = 'login'
}

const send = async () => {
  const text = draft.value.trim()
  if (text.length < 2 || sending.value) return
  sending.value = true
  errorMessage.value = ''
  try {
    const created = await postNewsComment(props.slug, text, loc.value)
    items.value = [...items.value, created]
    draft.value = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t(loc.value, 'commentsError')
  } finally {
    sending.value = false
  }
}

const profileHref = (username?: string) => (username ? withLocale(`/user/${username}`, loc.value) : '')

onMounted(() => {
  void loadMe()
  void load()
})
watch(() => [props.slug, props.locale], () => {
  void load()
})
const stopAuth = onStoredAuthChange(() => {
  void loadMe()
})
onUnmounted(() => stopAuth())
</script>

<template>
  <section class="article-comments" aria-label="comentarios">
    <h2>{{ t(loc, 'commentsTitle') }} <small v-if="items.length">{{ items.length }}</small></h2>
    <p v-if="loading" class="article-comments-empty">{{ t(loc, 'loadingStory') }}</p>
    <p v-else-if="!items.length" class="article-comments-empty">{{ t(loc, 'commentsEmpty') }}</p>
    <ul v-else class="article-comment-list">
      <li v-for="item in items" :key="item.id">
        <img v-if="item.authorPhotoUrl" :src="item.authorPhotoUrl" alt="" />
        <span v-else class="ph">{{ (item.authorName || 'U').slice(0, 1) }}</span>
        <div>
          <b>
            <a v-if="item.authorUsername" :href="profileHref(item.authorUsername)">{{ item.authorName }}</a>
            <template v-else>{{ item.authorName }}</template>
          </b>
          <time v-if="item.createdAt">{{ formatNewsDate(item.createdAt, loc) }}</time>
          <p>{{ item.body }}</p>
        </div>
      </li>
    </ul>
    <form v-if="signedIn" class="article-comment-form" @submit.prevent="send">
      <img v-if="mePhoto" :src="mePhoto" alt="" />
      <span v-else class="ph">+</span>
      <textarea v-model="draft" rows="3" maxlength="800" :placeholder="t(loc, 'commentsPlaceholder')" />
      <button type="submit" :disabled="sending || draft.trim().length < 2">
        {{ sending ? t(loc, 'commentsSending') : t(loc, 'commentsSend') }}
      </button>
    </form>
    <p v-else class="article-comments-login">
      <button type="button" @click="openLogin">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z"/></svg>
        {{ t(loc, 'commentsLogin') }}
      </button>
    </p>
    <p v-if="errorMessage" class="article-comments-error">{{ errorMessage }}</p>
  </section>
</template>
