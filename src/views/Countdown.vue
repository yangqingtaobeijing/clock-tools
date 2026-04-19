<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">倒计时</h1>
        <p class="page-desc">专注计时 · 结束时通知提醒</p>
      </div>
    </div>

    <div class="countdown-layout">
      <!-- Main countdown display -->
      <div class="countdown-main card">
        <!-- Circular progress -->
        <div class="ring-container">
          <svg class="progress-ring" viewBox="0 0 240 240" width="240" height="240">
            <circle
              class="ring-bg"
              cx="120" cy="120" r="108"
              fill="none"
              stroke-width="8"
            />
            <circle
              class="ring-progress"
              cx="120" cy="120" r="108"
              fill="none"
              stroke-width="8"
              :stroke="ringColor"
              :stroke-dasharray="ringCircumference"
              :stroke-dashoffset="ringOffset"
              stroke-linecap="round"
              transform="rotate(-90 120 120)"
            />
          </svg>
          <div class="ring-inner">
            <div class="time-big time-display" :class="{ 'time-ending': isEnding }">
              {{ displayTime }}
            </div>
            <div class="time-status">
              <span v-if="state === 'idle'" class="status-idle">等待开始</span>
              <span v-else-if="state === 'running'" class="status-running">进行中</span>
              <span v-else-if="state === 'paused'" class="status-paused">已暂停</span>
              <span v-else-if="state === 'done'" class="status-done">时间到！</span>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls">
          <button
            v-if="state === 'idle'"
            class="btn btn-primary btn-lg"
            :disabled="totalSeconds === 0"
            @click="start"
          >
            ▶ 开始
          </button>
          <template v-else-if="state === 'running'">
            <button class="btn btn-amber btn-lg" @click="pause">⏸ 暂停</button>
            <button class="btn btn-ghost btn-lg" @click="reset">↺ 重置</button>
          </template>
          <template v-else-if="state === 'paused'">
            <button class="btn btn-green btn-lg" @click="resume">▶ 继续</button>
            <button class="btn btn-ghost btn-lg" @click="reset">↺ 重置</button>
          </template>
          <template v-else-if="state === 'done'">
            <button v-if="showDoneAlert" class="btn btn-red btn-lg" @click="dismissDoneAlert">停止提醒</button>
            <button class="btn btn-primary btn-lg" @click="reset">↺ 重新开始</button>
          </template>
        </div>
      </div>

      <!-- Right panel: settings + presets -->
      <div class="countdown-side">
        <!-- Time input -->
        <div class="card panel">
          <div class="section-title" style="margin-bottom: 16px;">自定义时长</div>
          <div class="time-inputs">
            <div class="time-input-group">
              <input
                type="number"
                class="input time-input"
                v-model.number="inputHours"
                min="0"
                max="99"
                :disabled="state !== 'idle'"
                placeholder="0"
              />
              <label class="time-unit">时</label>
            </div>
            <span class="colon">:</span>
            <div class="time-input-group">
              <input
                type="number"
                class="input time-input"
                v-model.number="inputMinutes"
                min="0"
                max="59"
                :disabled="state !== 'idle'"
                placeholder="0"
              />
              <label class="time-unit">分</label>
            </div>
            <span class="colon">:</span>
            <div class="time-input-group">
              <input
                type="number"
                class="input time-input"
                v-model.number="inputSeconds"
                min="0"
                max="59"
                :disabled="state !== 'idle'"
                placeholder="0"
              />
              <label class="time-unit">秒</label>
            </div>
          </div>
        </div>

        <!-- Presets -->
        <div class="card panel">
          <div class="section-title" style="margin-bottom: 16px;">快捷预设</div>
          <div class="presets-grid">
            <button
              v-for="p in presets"
              :key="p.label"
              class="btn btn-ghost preset-btn"
              :class="{ 'preset-active': isCurrentPreset(p.seconds) }"
              :disabled="state !== 'idle'"
              @click="setPreset(p.seconds)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <!-- Notification permission -->
        <div class="card panel notification-panel" v-if="!supportsNotification">
          <div class="notif-icon">🔕</div>
          <div class="notif-text">
            <div class="notif-title">系统通知不可用</div>
            <div class="notif-desc">倒计时结束时仍会显示页面提醒 + 声音提醒</div>
          </div>
        </div>

        <div class="card panel notification-panel" v-else-if="notifPermission !== 'granted'">
          <div class="notif-icon">🔔</div>
          <div class="notif-text">
            <div class="notif-title">开启通知提醒</div>
            <div class="notif-desc">允许浏览器通知，倒计时结束时收到提醒</div>
          </div>
          <button class="btn btn-primary" @click="requestNotification" style="flex-shrink:0;">
            授权
          </button>
        </div>

        <div class="card panel notification-panel granted" v-else>
          <div class="notif-icon">✅</div>
          <div class="notif-text">
            <div class="notif-title">通知已开启</div>
            <div class="notif-desc">倒计时结束时将发送浏览器通知 + 声音提醒</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showDoneAlert" class="done-overlay" role="alertdialog" aria-modal="true" aria-labelledby="done-title">
      <div class="done-dialog card">
        <div class="done-icon">⏰</div>
        <div class="done-content">
          <h2 id="done-title" class="done-title">倒计时结束</h2>
          <p class="done-desc">设定的 {{ formatDuration(totalSet) }} 已完成，请停止提醒后继续。</p>
        </div>
        <div class="done-actions">
          <button class="btn btn-red btn-lg" @click="dismissDoneAlert">停止提醒</button>
          <button class="btn btn-ghost btn-lg" @click="reset">重新开始</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

type State = 'idle' | 'running' | 'paused' | 'done'
interface StoredCountdown {
  state: 'running' | 'paused'
  totalSet: number
  remaining: number
  endAtMs: number | null
}

const inputHours = ref(0)
const inputMinutes = ref(25)
const inputSeconds = ref(0)
const COUNTDOWN_STORAGE_KEY = 'clock-countdown-state'

const presets = [
  { label: '5 min', seconds: 300 },
  { label: '15 min', seconds: 900 },
  { label: '25 min', seconds: 1500 },
  { label: '30 min', seconds: 1800 },
  { label: '1 hour', seconds: 3600 },
]

const state = ref<State>('idle')
const remaining = ref(0)
const totalSet = ref(0)
const showDoneAlert = ref(false)
let timer: ReturnType<typeof setInterval> | null = null
let ringTimer: ReturnType<typeof setInterval> | null = null
let audioCtx: AudioContext | null = null
let endAtMs: number | null = null

const supportsNotification = 'Notification' in window
const notifPermission = ref(supportsNotification ? Notification.permission : 'denied')
const notificationIcon = `${import.meta.env.BASE_URL}favicon.svg`

const totalSeconds = computed(() =>
  (inputHours.value || 0) * 3600 + (inputMinutes.value || 0) * 60 + (inputSeconds.value || 0)
)

const displayTime = computed(() => {
  const s = state.value === 'idle' ? totalSeconds.value : remaining.value
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
})

const ringCircumference = 2 * Math.PI * 108
const ringOffset = computed(() => {
  if (totalSet.value === 0) return 0
  const progress = remaining.value / totalSet.value
  return ringCircumference * (1 - progress)
})

const ringColor = computed(() => {
  if (state.value === 'done') return '#ef4444'
  if (remaining.value <= 10 && state.value === 'running') return '#f59e0b'
  return '#6366f1'
})

const isEnding = computed(() => remaining.value <= 10 && state.value === 'running')

function isCurrentPreset(secs: number) {
  return state.value === 'idle' && totalSeconds.value === secs
}

function setPreset(secs: number) {
  inputHours.value = Math.floor(secs / 3600)
  inputMinutes.value = Math.floor((secs % 3600) / 60)
  inputSeconds.value = secs % 60
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}小时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

function start() {
  if (totalSeconds.value === 0) return
  totalSet.value = totalSeconds.value
  remaining.value = totalSeconds.value
  showDoneAlert.value = false
  state.value = 'running'
  endAtMs = Date.now() + totalSeconds.value * 1000
  prepareAudio()
  saveCountdownState()
  startTick()
}

function pause() {
  syncRemaining()
  state.value = 'paused'
  stopTick()
  endAtMs = null
  saveCountdownState()
}

function resume() {
  if (remaining.value <= 0) {
    finishCountdown()
    return
  }
  state.value = 'running'
  endAtMs = Date.now() + remaining.value * 1000
  saveCountdownState()
  startTick()
}

function reset() {
  stopTick()
  stopRinging()
  endAtMs = null
  clearCountdownState()
  state.value = 'idle'
  remaining.value = 0
  totalSet.value = 0
  showDoneAlert.value = false
}

function startTick() {
  stopTick()
  syncRemaining()
  timer = setInterval(syncRemaining, 1000)
}

function syncRemaining() {
  if (state.value !== 'running' || endAtMs === null) return
  const secondsLeft = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000))
  remaining.value = secondsLeft
  if (secondsLeft === 0) finishCountdown()
}

function finishCountdown() {
  stopTick()
  if (state.value === 'done') return
  endAtMs = null
  remaining.value = 0
  clearCountdownState()
  state.value = 'done'
  showDoneAlert.value = true
  onDone()
}

function stopTick() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function onDone() {
  startRinging()
  if (supportsNotification && Notification.permission === 'granted') {
    new Notification('⏰ 倒计时结束！', {
      body: `${formatDuration(totalSet.value)} 时间到，请回到页面停止提醒。`,
      icon: notificationIcon,
    })
  }
}

function prepareAudio() {
  try {
    audioCtx = audioCtx || new AudioContext()
    if (audioCtx.state === 'suspended') audioCtx.resume()
  } catch (e) {
    audioCtx = null
  }
}

function startRinging() {
  stopRinging()
  playBeep()
  ringTimer = setInterval(playBeep, 1200)
}

function stopRinging() {
  if (ringTimer) {
    clearInterval(ringTimer)
    ringTimer = null
  }
}

function dismissDoneAlert() {
  stopRinging()
  showDoneAlert.value = false
}

function saveCountdownState() {
  if (state.value !== 'running' && state.value !== 'paused') return
  const payload: StoredCountdown = {
    state: state.value,
    totalSet: totalSet.value,
    remaining: remaining.value,
    endAtMs,
  }
  localStorage.setItem(COUNTDOWN_STORAGE_KEY, JSON.stringify(payload))
}

function clearCountdownState() {
  localStorage.removeItem(COUNTDOWN_STORAGE_KEY)
}

function restoreCountdownState() {
  try {
    const raw = localStorage.getItem(COUNTDOWN_STORAGE_KEY)
    if (!raw) return
    const stored = JSON.parse(raw) as StoredCountdown
    if (!stored.totalSet || stored.totalSet <= 0) {
      clearCountdownState()
      return
    }

    totalSet.value = stored.totalSet
    if (stored.state === 'paused') {
      state.value = 'paused'
      remaining.value = Math.max(0, stored.remaining || 0)
      if (remaining.value === 0) clearCountdownState()
      return
    }

    if (!stored.endAtMs) {
      clearCountdownState()
      return
    }

    endAtMs = stored.endAtMs
    remaining.value = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000))
    state.value = 'running'
    if (remaining.value === 0) {
      finishCountdown()
    } else {
      startTick()
    }
  } catch (e) {
    clearCountdownState()
  }
}

function playBeep() {
  try {
    prepareAudio()
    if (!audioCtx) return
    for (let i = 0; i < 2; i++) {
      const startAt = audioCtx.currentTime + i * 0.28
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.connect(gain)
      gain.connect(audioCtx.destination)
      osc.frequency.value = 880
      osc.type = 'square'
      gain.gain.setValueAtTime(0.35, startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.22)
      osc.start(startAt)
      osc.stop(startAt + 0.22)
    }
  } catch (e) {
    // ignore AudioContext errors
  }
}

async function requestNotification() {
  if (!supportsNotification) return
  const perm = await Notification.requestPermission()
  notifPermission.value = perm
}

function handleTimerResume() {
  syncRemaining()
}

onMounted(() => {
  restoreCountdownState()
  document.addEventListener('visibilitychange', handleTimerResume)
  window.addEventListener('focus', handleTimerResume)
})

onUnmounted(() => {
  stopTick()
  stopRinging()
  document.removeEventListener('visibilitychange', handleTimerResume)
  window.removeEventListener('focus', handleTimerResume)
  if (audioCtx) audioCtx.close()
})
</script>

<style scoped>
.page { max-width: 960px; }

.page-header {
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-desc {
  font-size: 14px;
  color: var(--text-muted);
}

.countdown-layout {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: start;
}

.countdown-main {
  padding: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
}

/* Ring */
.ring-container {
  position: relative;
  width: 240px;
  height: 240px;
}

.progress-ring {
  position: absolute;
  inset: 0;
}

.ring-bg {
  stroke: var(--border);
}

.ring-progress {
  transition: stroke-dashoffset 0.8s ease, stroke 0.5s;
}

.ring-inner {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.time-big {
  font-size: 48px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1;
}

.time-big.time-ending {
  color: var(--amber);
  animation: blink 0.5s ease-in-out infinite alternate;
}

@keyframes blink {
  from { opacity: 1; }
  to { opacity: 0.4; }
}

.time-status {
  font-size: 13px;
  font-weight: 500;
}

.status-idle { color: var(--text-muted); }
.status-running { color: var(--green); }
.status-paused { color: var(--amber); }
.status-done { color: var(--red); }

/* Controls */
.controls {
  display: flex;
  gap: 12px;
}

.btn-lg {
  padding: 12px 28px;
  font-size: 15px;
  border-radius: 10px;
}

/* Side panel */
.countdown-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  padding: 20px;
}

.time-inputs {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.time-input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.time-unit {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

.time-input {
  text-align: center;
  font-size: 24px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  padding: 12px 8px;
}

.colon {
  font-size: 24px;
  color: var(--text-muted);
  padding-bottom: 18px;
  font-weight: 600;
}

/* Presets */
.presets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-btn {
  font-size: 13px;
  padding: 8px 4px;
}

.preset-active {
  background: var(--accent-glow) !important;
  color: var(--accent-light) !important;
  border-color: rgba(99, 102, 241, 0.4) !important;
}

/* Notification panel */
.notification-panel {
  display: flex;
  align-items: center;
  gap: 12px;
}

.notification-panel.granted {
  border-color: rgba(16, 185, 129, 0.3);
  background: var(--green-glow);
}

.notif-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.notif-text {
  flex: 1;
}

.notif-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.notif-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Done alert */
.done-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.5);
}

.done-dialog {
  width: min(420px, 100%);
  padding: 28px;
  text-align: center;
  border-color: rgba(239, 68, 68, 0.35);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
}

.done-icon {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 8px;
  background: var(--red-glow);
  color: var(--red);
  font-size: 28px;
  animation: alertPulse 0.8s ease-in-out infinite alternate;
}

.done-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.done-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.done-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

@keyframes alertPulse {
  from { transform: scale(1); }
  to { transform: scale(1.08); }
}
</style>
