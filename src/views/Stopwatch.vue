<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">秒表</h1>
        <p class="page-desc">精准计时 · 圈次记录</p>
      </div>
    </div>

    <div class="stopwatch-layout">
      <!-- Main display -->
      <div class="stopwatch-main card">
        <div class="sw-display">
          <div class="sw-time time-display">{{ displayMain }}</div>
          <div class="sw-ms time-display">.{{ displayMs }}</div>
        </div>

        <!-- Ring accent -->
        <div class="sw-ring" :class="`ring-${state}`"></div>

        <div class="sw-controls">
          <button
            v-if="state === 'idle'"
            class="btn btn-green btn-xl"
            @click="startSW"
          >
            ▶ 开始
          </button>
          <template v-else-if="state === 'running'">
            <button class="btn btn-ghost btn-xl" @click="lap">
              ⚑ 记圈
            </button>
            <button class="btn btn-amber btn-xl" @click="pauseSW">
              ⏸ 暂停
            </button>
          </template>
          <template v-else-if="state === 'paused'">
            <button class="btn btn-ghost btn-xl" @click="resetSW" style="color:var(--red); border-color: rgba(239,68,68,0.3);">
              ↺ 重置
            </button>
            <button class="btn btn-green btn-xl" @click="resumeSW">
              ▶ 继续
            </button>
          </template>
        </div>
      </div>

      <!-- Lap records -->
      <div class="laps-panel card">
        <div class="laps-header">
          <div class="section-title">圈次记录</div>
          <div class="laps-count" v-if="laps.length > 0">{{ laps.length }} 圈</div>
        </div>

        <div v-if="laps.length === 0" class="laps-empty">
          <div class="laps-empty-icon">🏁</div>
          <div>开始后按「记圈」记录圈次</div>
        </div>

        <div v-else class="laps-list">
          <!-- Header -->
          <div class="lap-row lap-header">
            <span class="lap-num">#</span>
            <span class="lap-time">圈次时间</span>
            <span class="lap-total">累计时间</span>
            <span class="lap-bar"></span>
          </div>

          <div
            v-for="(lap, i) in reversedLaps"
            :key="lap.id"
            class="lap-row"
            :class="{
              'lap-fastest': lap.elapsed === minLapTime,
              'lap-slowest': laps.length > 2 && lap.elapsed === maxLapTime,
              'lap-current': i === 0 && state === 'running',
            }"
          >
            <span class="lap-num">{{ laps.length - i }}</span>
            <span class="lap-time time-display">{{ formatTime(lap.elapsed) }}</span>
            <span class="lap-total time-display">{{ formatTime(lap.total) }}</span>
            <div class="lap-bar">
              <div
                class="lap-bar-fill"
                :style="{ width: getLapBarWidth(lap.elapsed) + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

type State = 'idle' | 'running' | 'paused'

interface Lap {
  id: number
  elapsed: number  // ms for this lap
  total: number    // ms cumulative
}

const state = ref<State>('idle')
const elapsed = ref(0) // total ms
const lapStart = ref(0) // ms at which current lap started
const laps = ref<Lap[]>([])
let startTime = 0
let pausedAt = 0
let raf: number | null = null

const displayMain = computed(() => {
  const ms = elapsed.value
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
})

const displayMs = computed(() => {
  return String(Math.floor((elapsed.value % 1000) / 10)).padStart(2, '0')
})

const reversedLaps = computed(() => [...laps.value].reverse())

const minLapTime = computed(() => {
  if (laps.value.length < 2) return -1
  return Math.min(...laps.value.map(l => l.elapsed))
})

const maxLapTime = computed(() => {
  if (laps.value.length < 2) return -1
  return Math.max(...laps.value.map(l => l.elapsed))
})

function getLapBarWidth(ms: number) {
  const max = Math.max(...laps.value.map(l => l.elapsed), 1)
  return Math.round((ms / max) * 100)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatTime(ms: number) {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const cs = Math.floor((ms % 1000) / 10)
  return `${pad(m)}:${pad(s)}.${String(cs).padStart(2, '0')}`
}

function tick() {
  elapsed.value = Date.now() - startTime
  raf = requestAnimationFrame(tick)
}

function startSW() {
  state.value = 'running'
  startTime = Date.now()
  lapStart.value = 0
  elapsed.value = 0
  raf = requestAnimationFrame(tick)
}

function pauseSW() {
  state.value = 'paused'
  pausedAt = elapsed.value
  if (raf !== null) {
    cancelAnimationFrame(raf)
    raf = null
  }
}

function resumeSW() {
  state.value = 'running'
  startTime = Date.now() - pausedAt
  raf = requestAnimationFrame(tick)
}

function resetSW() {
  if (raf !== null) {
    cancelAnimationFrame(raf)
    raf = null
  }
  state.value = 'idle'
  elapsed.value = 0
  lapStart.value = 0
  laps.value = []
}

function lap() {
  const lapElapsed = elapsed.value - lapStart.value
  laps.value.push({
    id: laps.value.length + 1,
    elapsed: lapElapsed,
    total: elapsed.value,
  })
  lapStart.value = elapsed.value
}

onUnmounted(() => {
  if (raf !== null) cancelAnimationFrame(raf)
})
</script>

<style scoped>
.page { max-width: 1100px; }

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

.stopwatch-layout {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  align-items: start;
}

.stopwatch-main {
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  position: relative;
  overflow: hidden;
}

.sw-ring {
  position: absolute;
  top: -80px;
  right: -80px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 2px solid var(--border);
  opacity: 0.3;
  transition: border-color 0.3s, opacity 0.3s;
}

.sw-ring.ring-running {
  border-color: var(--green);
  opacity: 0.4;
  animation: spin 8s linear infinite;
}

.sw-ring.ring-paused {
  border-color: var(--amber);
  opacity: 0.3;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.sw-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.sw-time {
  font-size: 72px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.04em;
  line-height: 1;
}

.sw-ms {
  font-size: 32px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: -0.02em;
}

.sw-controls {
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: center;
}

.btn-xl {
  padding: 14px 32px;
  font-size: 15px;
  border-radius: 12px;
  flex: 1;
  max-width: 160px;
}

/* Laps panel */
.laps-panel {
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.laps-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
}

.laps-count {
  font-size: 12px;
  color: var(--accent-light);
  background: var(--accent-glow);
  padding: 2px 10px;
  border-radius: 10px;
}

.laps-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
  padding: 40px;
}

.laps-empty-icon {
  font-size: 40px;
  opacity: 0.5;
}

.laps-list {
  overflow-y: auto;
  max-height: 500px;
}

.lap-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 80px;
  align-items: center;
  padding: 11px 24px;
  gap: 8px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  transition: background 0.15s;
}

.lap-row:last-child {
  border-bottom: none;
}

.lap-row:hover {
  background: var(--bg-card-hover);
}

.lap-header {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 600;
  font-family: 'Space Grotesk', sans-serif;
}

.lap-num {
  color: var(--text-muted);
  font-weight: 600;
}

.lap-time {
  color: var(--text-primary);
  font-weight: 500;
}

.lap-total {
  color: var(--text-secondary);
}

.lap-bar {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
}

.lap-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s;
}

.lap-fastest .lap-time { color: var(--green); }
.lap-fastest .lap-bar-fill { background: var(--green); }
.lap-fastest .lap-num::after { content: ' 🟢'; font-size: 10px; }

.lap-slowest .lap-time { color: var(--red); }
.lap-slowest .lap-bar-fill { background: var(--red); }
.lap-slowest .lap-num::after { content: ' 🔴'; font-size: 10px; }

.lap-current {
  background: rgba(99, 102, 241, 0.05);
}
</style>
