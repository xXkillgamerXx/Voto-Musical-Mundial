<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { getCurrentApiAuth, getMe } from '../../../src/services/api/authApi'
import { onStoredAuthChange } from '../../../src/services/api/client'
import { getNewsComments, postNewsComment, reactNewsComment } from '../../../src/services/api/newsApi'
import { t } from '../lib/copy'
import { withLocale } from '../lib/locale'
import { formatNewsDate } from '../lib/news'
import NewsCommentReportModal from './NewsCommentReportModal.vue'

type ReactionMap = { love: number; laugh: number; wow: number; fire: number }

type CommentItem = {
  id: string
  parentId?: string | null
  authorName: string
  authorUsername?: string
  authorPhotoUrl?: string
  body: string
  createdAt?: string
  score?: number
  myVote?: number
  reactions?: ReactionMap
  myReaction?: string | null
}

type CommentThread = {
  root: CommentItem
  replies: CommentItem[]
}

type SortMode = 'best' | 'recent' | 'hot'
type ReactionKey = 'love' | 'laugh' | 'wow' | 'fire'

const PAGE_SIZE = 3
const MAX_LEN = 800
const REACTIONS: Array<{ key: ReactionKey; emoji: string }> = [
  { key: 'love', emoji: '😍' },
  { key: 'laugh', emoji: '😂' },
  { key: 'wow', emoji: '🤯' },
  { key: 'fire', emoji: '🔥' },
]

const props = defineProps<{ slug: string; locale?: string }>()
const loc = computed(() => (props.locale === 'en' ? 'en' : 'es'))
const items = ref<CommentItem[]>([])
const loading = ref(true)
const sending = ref(false)
const sendStatus = ref<'idle' | 'sending' | 'ok' | 'error'>('idle')
const sendFeedback = ref('')
const votingId = ref('')
const errorMessage = ref('')
const draft = ref('')
let sendFeedbackTimer = 0
const sortMode = ref<SortMode>('best')
const visibleCount = ref(PAGE_SIZE)
const replyTo = ref<CommentItem | null>(null)
const composerRef = ref<HTMLTextAreaElement | null>(null)
const expandedThreads = ref<Record<string, boolean>>({})
const isAuthed = (auth = getCurrentApiAuth()) => Boolean(auth?.accessToken && auth.user && !auth.user.isAnonymous)
const signedIn = ref(isAuthed())
const mePhoto = ref('')
const meName = ref('')
const listAnimKey = ref(0)
const reportOpen = ref(false)
const reportCommentId = ref('')

const emptyReactions = (): ReactionMap => ({ love: 0, laugh: 0, wow: 0, fire: 0 })

const badgeFor = (name: string) => {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash + name.charCodeAt(i) * (i + 1)) % 3
  if (hash === 0) return { key: 'fan', label: t(loc.value, 'commentsBadgeFan') }
  if (hash === 1) return { key: 'super', label: t(loc.value, 'commentsBadgeSuper') }
  return { key: 'mega', label: t(loc.value, 'commentsBadgeMega') }
}

const relativeTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return formatNewsDate(value, loc.value)
  const diff = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diff / 60_000))
  if (mins < 1) return t(loc.value, 'commentsJustNow')
  if (mins < 60) return t(loc.value, 'commentsMinsAgo').replace('{n}', String(mins))
  const hours = Math.round(mins / 60)
  if (hours < 24) return t(loc.value, 'commentsHoursAgo').replace('{n}', String(hours))
  const days = Math.round(hours / 24)
  if (days < 7) return t(loc.value, 'commentsDaysAgo').replace('{n}', String(days))
  return formatNewsDate(value, loc.value)
}

const scoreOf = (item: CommentItem) => Number(item.score || 0)

const loadMe = async () => {
  signedIn.value = isAuthed()
  if (!signedIn.value) {
    mePhoto.value = ''
    meName.value = ''
    return
  }
  try {
    const me = await getMe()
    mePhoto.value = me?.photoUrl || me?.photoURL || ''
    meName.value = me?.displayName || me?.username || 'M'
  } catch {
    mePhoto.value = ''
    meName.value = 'M'
  }
}

const normalizeComment = (item: CommentItem): CommentItem => ({
  ...item,
  parentId: item.parentId ? String(item.parentId) : null,
  score: Number(item.score || 0),
  myVote: Number(item.myVote || 0),
  reactions: {
    ...emptyReactions(),
    ...(item.reactions || {}),
  },
  myReaction: item.myReaction || null,
})

const reactionTotal = (item: CommentItem) =>
  Object.values(item.reactions || emptyReactions()).reduce((sum, n) => sum + Number(n || 0), 0)

const byDateAsc = (a: CommentItem, b: CommentItem) =>
  +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0) || String(a.id).localeCompare(String(b.id))

const sortRoots = (list: CommentItem[]) => {
  const copy = [...list]
  if (sortMode.value === 'recent') {
    return copy.sort((a, b) => +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0))
  }
  if (sortMode.value === 'hot') {
    return copy.sort(
      (a, b) =>
        reactionTotal(b) * 3 + Math.abs(scoreOf(b)) - (reactionTotal(a) * 3 + Math.abs(scoreOf(a))) ||
        +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0),
    )
  }
  return copy.sort(
    (a, b) =>
      reactionTotal(b) - reactionTotal(a) ||
      scoreOf(b) - scoreOf(a) ||
      +new Date(b.createdAt || 0) - +new Date(a.createdAt || 0),
  )
}

const resolveParentId = (item: CommentItem, byId: Map<string, CommentItem>) => {
  if (item.parentId && byId.has(item.parentId)) return item.parentId
  const mention = String(item.body || '')
    .trim()
    .match(/^@([A-Za-z0-9._-]+)/)?.[1]
    ?.toLowerCase()
  if (!mention) return null
  const earlier = items.value
    .filter((row) => Number(row.id) < Number(item.id) && !row.parentId)
    .filter(
      (row) =>
        String(row.authorUsername || '').toLowerCase() === mention ||
        String(row.authorName || '').replace(/\s+/g, '').toLowerCase() === mention,
    )
    .sort((a, b) => Number(b.id) - Number(a.id))[0]
  return earlier?.id || null
}

const threads = computed((): CommentThread[] => {
  const byId = new Map(items.value.map((item) => [item.id, item]))
  const children = new Map<string, CommentItem[]>()
  const roots: CommentItem[] = []
  for (const item of items.value) {
    const parentId = resolveParentId(item, byId)
    if (!parentId) {
      roots.push(item)
      continue
    }
    const bag = children.get(parentId) || []
    bag.push({ ...item, parentId })
    children.set(parentId, bag)
  }
  return sortRoots(roots).map((root) => ({
    root,
    replies: (children.get(root.id) || []).slice().sort(byDateAsc),
  }))
})

const visibleThreads = computed(() => threads.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < threads.value.length)

const isExpanded = (threadId: string, replyCount: number) => {
  if (expandedThreads.value[threadId] === true) return true
  if (expandedThreads.value[threadId] === false) return false
  return replyCount <= 1
}

const toggleThread = (threadId: string, replyCount: number) => {
  expandedThreads.value = {
    ...expandedThreads.value,
    [threadId]: !isExpanded(threadId, replyCount),
  }
}

const repliesLabel = (count: number) => {
  if (count === 1) return t(loc.value, 'commentsViewReply')
  return t(loc.value, 'commentsViewReplies').replace('{n}', String(count))
}

const scrollToHashComment = async () => {
  const hash = String(window.location.hash || '')
  const match = hash.match(/^#comment-(.+)$/)
  if (!match) return
  const id = match[1]
  const target = items.value.find((item) => item.id === id)
  if (!target) return
  const parentId = resolveParentId(target, new Map(items.value.map((item) => [item.id, item])))
  const rootId = parentId || target.id
  const rootIndex = threads.value.findIndex((thread) => thread.root.id === rootId)
  if (rootIndex >= 0) visibleCount.value = Math.max(visibleCount.value, rootIndex + 1)
  if (parentId) {
    expandedThreads.value = { ...expandedThreads.value, [parentId]: true }
  }
  await nextTick()
  const el = document.getElementById(`comment-${id}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('is-target')
  window.setTimeout(() => el.classList.remove('is-target'), 2200)
}

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  visibleCount.value = PAGE_SIZE
  expandedThreads.value = {}
  try {
    const payload = await getNewsComments(props.slug, loc.value)
    items.value = (payload.items || []).map((item: CommentItem) => normalizeComment(item))
  } catch {
    items.value = []
  } finally {
    loading.value = false
    await scrollToHashComment()
  }
}

const openLogin = () => {
  window.location.hash = 'login'
}

const ensureAuth = () => {
  if (signedIn.value) return true
  openLogin()
  return false
}

const setSort = (mode: SortMode) => {
  if (sortMode.value === mode) return
  sortMode.value = mode
  listAnimKey.value += 1
}

const react = async (item: CommentItem, key: ReactionKey) => {
  if (!ensureAuth()) return
  if (votingId.value) return
  votingId.value = `r-${item.id}`
  errorMessage.value = ''
  try {
    const result = await reactNewsComment(props.slug, item.id, key, loc.value)
    items.value = items.value.map((row) =>
      row.id === item.id
        ? {
            ...row,
            reactions: { ...emptyReactions(), ...(result.reactions || {}) },
            myReaction: result.myReaction || null,
          }
        : row,
    )
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t(loc.value, 'commentsError')
  } finally {
    votingId.value = ''
  }
}

const visibleReactions = (item: CommentItem) =>
  REACTIONS.filter((reaction) => reactionCount(item, reaction.key) > 0 || item.myReaction === reaction.key)

const reactionCount = (item: CommentItem, key: ReactionKey) => Number(item.reactions?.[key] || 0)

const startReply = async (item: CommentItem) => {
  if (!ensureAuth()) return
  const threadId = item.parentId || item.id
  replyTo.value = item
  draft.value = `@${item.authorUsername || item.authorName} `
  expandedThreads.value = { ...expandedThreads.value, [threadId]: true }
  await nextTick()
  composerRef.value?.focus()
  composerRef.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

const cancelReply = () => {
  replyTo.value = null
  if (draft.value.startsWith('@')) draft.value = ''
}

const shareComment = async (item: CommentItem) => {
  const url = `${window.location.origin}${window.location.pathname}#comment-${item.id}`
  try {
    if (navigator.share) {
      await navigator.share({ url, text: item.body.slice(0, 120) })
      return
    }
  } catch {
    /* fall through */
  }
  try {
    await navigator.clipboard.writeText(url)
    window.location.hash = `comment-${item.id}`
    await scrollToHashComment()
  } catch {
    errorMessage.value = t(loc.value, 'commentsError')
  }
}

const reportComment = (item: CommentItem) => {
  if (!ensureAuth()) return
  reportCommentId.value = item.id
  reportOpen.value = true
}

const wrapSelection = (before: string, after = before) => {
  if (sending.value) return
  const el = composerRef.value
  if (!el) {
    draft.value = `${before}${draft.value}${after}`
    return
  }
  const start = el.selectionStart || 0
  const end = el.selectionEnd || 0
  const selected = draft.value.slice(start, end) || (loc.value === 'en' ? 'text' : 'texto')
  draft.value = `${draft.value.slice(0, start)}${before}${selected}${after}${draft.value.slice(end)}`
  nextTick(() => {
    el.focus()
    const pos = start + before.length + selected.length + after.length
    el.setSelectionRange(pos, pos)
  })
}

const clearSendFeedbackSoon = () => {
  window.clearTimeout(sendFeedbackTimer)
  sendFeedbackTimer = window.setTimeout(() => {
    if (sendStatus.value === 'ok') {
      sendStatus.value = 'idle'
      sendFeedback.value = ''
    }
  }, 2200)
}

const send = async () => {
  const text = draft.value.trim()
  if (text.length < 2 || sending.value) return
  if (!ensureAuth()) return
  sending.value = true
  sendStatus.value = 'sending'
  sendFeedback.value = t(loc.value, 'commentsSendHint')
  errorMessage.value = ''
  try {
    const parentId = replyTo.value?.id || undefined
    const created = await postNewsComment(props.slug, text.slice(0, MAX_LEN), loc.value, parentId)
    const next = normalizeComment(created)
    items.value = [...items.value, next]
    draft.value = ''
    replyTo.value = null
    sendStatus.value = 'ok'
    sendFeedback.value = t(loc.value, 'commentsSent')
    clearSendFeedbackSoon()
    if (!next.parentId) {
      sortMode.value = 'recent'
      visibleCount.value = Math.max(visibleCount.value, 1)
    } else {
      expandedThreads.value = { ...expandedThreads.value, [next.parentId]: true }
      const rootIndex = threads.value.findIndex((thread) => thread.root.id === next.parentId)
      if (rootIndex >= 0) visibleCount.value = Math.max(visibleCount.value, rootIndex + 1)
    }
    listAnimKey.value += 1
    await nextTick()
    document.getElementById(`comment-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch (error) {
    sendStatus.value = 'error'
    sendFeedback.value = error instanceof Error ? error.message : t(loc.value, 'commentsError')
    errorMessage.value = sendFeedback.value
  } finally {
    sending.value = false
  }
}

const profileHref = (username?: string) => (username ? withLocale(`/user/${username}`, loc.value) : '')
const initialOf = (name?: string) => String(name || 'M').trim().slice(0, 1).toUpperCase() || 'M'

const onHashChange = () => {
  void scrollToHashComment()
}

onMounted(() => {
  void loadMe()
  void load()
  window.addEventListener('hashchange', onHashChange)
})
watch(
  () => [props.slug, props.locale],
  () => {
    void load()
  },
)
const stopAuth = onStoredAuthChange(() => {
  void loadMe()
  void load()
})
onUnmounted(() => {
  stopAuth()
  window.removeEventListener('hashchange', onHashChange)
  window.clearTimeout(sendFeedbackTimer)
})
</script>

<template>
  <section class="mm-comments" aria-label="comentarios">
    <div class="mm-comments-head">
      <h2>
        {{ t(loc, 'commentsTitle') }}
        <span class="mm-comments-count">{{ items.length }}</span>
      </h2>
      <div class="mm-comments-sort" role="tablist" :aria-label="t(loc, 'commentsSortLabel')">
        <span class="mm-comments-sort-label">{{ t(loc, 'commentsSortBy') }}</span>
        <button type="button" role="tab" :class="{ on: sortMode === 'best' }" @click="setSort('best')">
          {{ t(loc, 'commentsSortBest') }}
        </button>
        <button type="button" role="tab" :class="{ on: sortMode === 'recent' }" @click="setSort('recent')">
          {{ t(loc, 'commentsSortRecent') }}
        </button>
        <button type="button" role="tab" :class="{ on: sortMode === 'hot' }" @click="setSort('hot')">
          {{ t(loc, 'commentsSortHot') }}
        </button>
      </div>
    </div>

    <div v-if="signedIn" class="mm-composer" :class="{ 'is-sending': sending, [`is-${sendStatus}`]: sendStatus !== 'idle' }">
      <div class="mm-composer-avatar" aria-hidden="true">
        <img v-if="mePhoto" :src="mePhoto" alt="" />
        <span v-else>{{ initialOf(meName) }}</span>
      </div>
      <div class="mm-composer-box">
        <p v-if="replyTo" class="mm-composer-reply">
          {{ t(loc, 'commentsReplying') }}
          <b>{{ replyTo.authorName }}</b>
          <button type="button" :disabled="sending" @click="cancelReply">{{ t(loc, 'commentsCancelReply') }}</button>
        </p>
        <textarea
          ref="composerRef"
          v-model="draft"
          rows="3"
          :maxlength="MAX_LEN"
          :placeholder="t(loc, 'commentsPlaceholder')"
          :disabled="sending"
          :aria-busy="sending"
        />
        <div class="mm-composer-bar">
          <div class="mm-composer-tools" aria-hidden="true">
            <button type="button" title="Bold" :disabled="sending" @click="wrapSelection('**')">B</button>
            <button type="button" title="Italic" :disabled="sending" @click="wrapSelection('_')"><i>I</i></button>
            <button type="button" title="Link" :disabled="sending" @click="wrapSelection('[', '](https://)')">🔗</button>
            <button type="button" title="List" :disabled="sending" @click="wrapSelection('\n- ', '')">≡</button>
          </div>
          <div class="mm-composer-actions">
            <span>{{ draft.length }}/{{ MAX_LEN }}</span>
            <button class="mm-composer-send" type="button" :disabled="sending || draft.trim().length < 2" @click="send">
              <span v-if="sending" class="mm-composer-spin" aria-hidden="true"></span>
              {{ sending ? t(loc, 'commentsSending') : t(loc, 'commentsSend') }}
            </button>
          </div>
        </div>
        <div class="mm-composer-progress" aria-hidden="true">
          <i :class="{ on: sending }"></i>
        </div>
        <p v-if="sendFeedback" class="mm-composer-feedback" :data-tone="sendStatus" role="status" aria-live="polite">
          {{ sendFeedback }}
        </p>
      </div>
    </div>
    <div v-else class="mm-comments-login">
      <button type="button" @click="openLogin">{{ t(loc, 'commentsLogin') }}</button>
    </div>

    <div class="mm-comments-note-row is-flush">
      <p class="mm-comments-note">
        {{ t(loc, 'commentsModNote') }}
        <a :href="withLocale(loc === 'en' ? '/terms-and-conditions' : '/terminos-y-condiciones', loc)">{{ t(loc, 'commentsRules') }}</a>.
      </p>
    </div>

    <p v-if="loading" class="mm-comments-empty">{{ t(loc, 'loadingStory') }}</p>
    <p v-else-if="!items.length" class="mm-comments-empty">{{ t(loc, 'commentsEmpty') }}</p>

    <TransitionGroup v-else :key="listAnimKey" name="mm-c-sort" tag="ul" class="mm-comment-list">
      <li
        v-for="(thread, index) in visibleThreads"
        :key="thread.root.id"
        class="mm-thread"
        :class="{
          'has-replies': thread.replies.length > 0,
          'is-open': thread.replies.length > 0 && isExpanded(thread.root.id, thread.replies.length),
        }"
        :style="{ '--i': index }"
      >
        <article :id="`comment-${thread.root.id}`" class="mm-comment">
          <div class="mm-comment-meta">
            <span class="mm-comment-avatar" aria-hidden="true">
              <img v-if="thread.root.authorPhotoUrl" :src="thread.root.authorPhotoUrl" alt="" />
              <span v-else>{{ initialOf(thread.root.authorName) }}</span>
            </span>
            <div class="mm-comment-meta-text">
              <a
                v-if="thread.root.authorUsername"
                class="mm-comment-name"
                :href="profileHref(thread.root.authorUsername)"
              >{{ thread.root.authorName }}</a>
              <b v-else class="mm-comment-name">{{ thread.root.authorName }}</b>
              <span class="mm-comment-badge" :data-tone="badgeFor(thread.root.authorName).key">{{ badgeFor(thread.root.authorName).label }}</span>
              <time>{{ relativeTime(thread.root.createdAt) }}</time>
            </div>
          </div>
          <p class="mm-comment-body">{{ thread.root.body }}</p>
          <div class="mm-comment-foot">
            <div class="mm-comment-actions">
              <button type="button" @click="startReply(thread.root)">{{ t(loc, 'commentsReply') }}</button>
              <button type="button" @click="shareComment(thread.root)">{{ t(loc, 'commentsShare') }}</button>
              <button type="button" @click="reportComment(thread.root)">{{ t(loc, 'commentsReport') }}</button>
            </div>
            <div
              v-if="visibleReactions(thread.root).length"
              class="mm-comment-reacts"
              role="group"
              aria-label="Reactions"
            >
              <button
                v-for="reaction in visibleReactions(thread.root)"
                :key="reaction.key"
                type="button"
                :class="{ on: thread.root.myReaction === reaction.key }"
                :disabled="votingId === `r-${thread.root.id}`"
                @click="react(thread.root, reaction.key)"
              >
                <span>{{ reaction.emoji }}</span>
                <small>{{ reactionCount(thread.root, reaction.key) }}</small>
              </button>
            </div>
            <div v-else class="mm-comment-reacts is-empty" role="group" aria-label="Reactions">
              <button
                v-for="reaction in REACTIONS"
                :key="reaction.key"
                type="button"
                :disabled="votingId === `r-${thread.root.id}`"
                @click="react(thread.root, reaction.key)"
              >
                <span>{{ reaction.emoji }}</span>
              </button>
            </div>
          </div>
        </article>

        <button
          v-if="thread.replies.length > 1"
          type="button"
          class="mm-thread-toggle"
          :class="{ on: isExpanded(thread.root.id, thread.replies.length) }"
          @click="toggleThread(thread.root.id, thread.replies.length)"
        >
          <span>
            {{
              isExpanded(thread.root.id, thread.replies.length)
                ? t(loc, 'commentsHideReplies')
                : repliesLabel(thread.replies.length)
            }}
          </span>
          <i aria-hidden="true">{{ isExpanded(thread.root.id, thread.replies.length) ? '∧' : '∨' }}</i>
        </button>

        <ul v-if="thread.replies.length && isExpanded(thread.root.id, thread.replies.length)" class="mm-thread-replies">
          <li
            v-for="reply in thread.replies"
            :id="`comment-${reply.id}`"
            :key="reply.id"
            class="mm-comment is-reply"
          >
            <div class="mm-comment-meta">
              <span class="mm-comment-avatar is-sm" aria-hidden="true">
                <img v-if="reply.authorPhotoUrl" :src="reply.authorPhotoUrl" alt="" />
                <span v-else>{{ initialOf(reply.authorName) }}</span>
              </span>
              <div class="mm-comment-meta-text">
                <a v-if="reply.authorUsername" class="mm-comment-name" :href="profileHref(reply.authorUsername)">{{ reply.authorName }}</a>
                <b v-else class="mm-comment-name">{{ reply.authorName }}</b>
                <span class="mm-comment-badge" :data-tone="badgeFor(reply.authorName).key">{{ badgeFor(reply.authorName).label }}</span>
                <time>{{ relativeTime(reply.createdAt) }}</time>
              </div>
            </div>
            <p class="mm-comment-body">{{ reply.body }}</p>
            <div class="mm-comment-foot">
              <div class="mm-comment-actions">
                <button type="button" @click="startReply(reply)">{{ t(loc, 'commentsReply') }}</button>
                <button type="button" @click="shareComment(reply)">{{ t(loc, 'commentsShare') }}</button>
                <button type="button" @click="reportComment(reply)">{{ t(loc, 'commentsReport') }}</button>
              </div>
              <div
                v-if="visibleReactions(reply).length"
                class="mm-comment-reacts"
                role="group"
                aria-label="Reactions"
              >
                <button
                  v-for="reaction in visibleReactions(reply)"
                  :key="reaction.key"
                  type="button"
                  :class="{ on: reply.myReaction === reaction.key }"
                  :disabled="votingId === `r-${reply.id}`"
                  @click="react(reply, reaction.key)"
                >
                  <span>{{ reaction.emoji }}</span>
                  <small>{{ reactionCount(reply, reaction.key) }}</small>
                </button>
              </div>
              <div v-else class="mm-comment-reacts is-empty" role="group" aria-label="Reactions">
                <button
                  v-for="reaction in REACTIONS"
                  :key="reaction.key"
                  type="button"
                  :disabled="votingId === `r-${reply.id}`"
                  @click="react(reply, reaction.key)"
                >
                  <span>{{ reaction.emoji }}</span>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </li>
    </TransitionGroup>

    <button v-if="hasMore" class="mm-comments-more" type="button" @click="visibleCount += PAGE_SIZE">
      {{ t(loc, 'commentsLoadMore') }}
      <span aria-hidden="true">↓</span>
    </button>

    <p v-if="errorMessage" class="mm-comments-error">{{ errorMessage }}</p>

    <NewsCommentReportModal
      :open="reportOpen"
      :slug="slug"
      :comment-id="reportCommentId"
      :locale="loc"
      @close="reportOpen = false"
    />
  </section>
</template>
