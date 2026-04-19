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
        <div class="card panel notification-panel" v-if="notifPermission !== 'granted'">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

type State = 'idle' | 'running' | 'paused' | 'done'

const inputHours = ref(0)
const inputMinutes = ref(25)
const inputSeconds = ref(0)

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
let timer: ReturnType<typeof setInterval> | null = null

const notifPermission = ref(Notification.permission)

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

function start() {
  if (totalSeconds.value === 0) return
  totalSet.value = totalSeconds.value
  remaining.value = totalSeconds.value
  state.value = 'running'
  startTick()
}

function pause() {
  state.value = 'paused'
  stopTick()
}

function resume() {
  state.value = 'running'
  startTick()
}

function reset() {
  stopTick()
  state.value = 'idle'
  remaining.value = 0
  totalSet.value = 0
}

function startTick() {
  timer = setInterval(() => {
    if (remaining.value <= 0) {
      stopTick()
      state.value = 'done'
      onDone()
      return
    }
    remaining.value--
  }, 1000)
}

function stopTick() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function onDone() {
  playBeep()
  if (Notification.permission === 'granted') {
    new Notification('⏰ 倒计时结束！', {
      body: `${displayTime.value} 时间到！`,
      icon: '/clock-tools/favicon.ico',
    })
  }
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.5, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.8)
  } catch (e) {
    // ignore AudioContext errors
  }
}

async function requestNotification() {
  const perm = await Notification.requestPermission()
  notifPermission.value = perm
}

onUnmounted(() => stopTick())
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
</style>
