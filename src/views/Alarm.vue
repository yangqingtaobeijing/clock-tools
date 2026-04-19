<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">闹钟</h1>
        <p class="page-desc">多闹钟管理 · 浏览器通知提醒</p>
      </div>
    </div>

    <div class="alarm-layout">
      <!-- Add alarm form -->
      <div class="card add-form">
        <div class="section-title" style="margin-bottom: 20px;">添加闹钟</div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">时间</label>
            <input
              type="time"
              class="input"
              v-model="newAlarmTime"
            />
          </div>
          <div class="form-group">
            <label class="form-label">标签</label>
            <select class="input" v-model="newAlarmLabel">
              <option value="美股开盘">🟢 美股开盘</option>
              <option value="美股收盘">🔴 美股收盘</option>
              <option value="自定义">✏️ 自定义</option>
            </select>
          </div>
        </div>

        <div class="form-group" v-if="newAlarmLabel === '自定义'">
          <label class="form-label">备注</label>
          <input
            type="text"
            class="input"
            v-model="newAlarmNote"
            placeholder="输入备注内容..."
            maxlength="50"
          />
        </div>

        <button class="btn btn-primary" style="width: 100%; margin-top: 8px;" @click="addAlarm">
          ＋ 添加闹钟
        </button>
      </div>

      <!-- Alarm list -->
      <div class="alarm-list-container">
        <div class="section-title" style="margin-bottom: 16px;">
          已设置 {{ alarms.length }} 个闹钟
        </div>

        <div v-if="alarms.length === 0" class="empty-state">
          <div class="empty-icon">🔔</div>
          <div class="empty-text">还没有闹钟，添加一个吧</div>
        </div>

        <div v-else class="alarm-list">
          <div
            v-for="alarm in sortedAlarms"
            :key="alarm.id"
            class="alarm-item card"
            :class="{
              'alarm-active': alarm.active,
              'alarm-ringing': alarm.ringing,
            }"
          >
            <div class="alarm-left">
              <div class="alarm-time time-display" :class="{ 'time-inactive': !alarm.active }">
                {{ alarm.time }}
              </div>
              <div class="alarm-meta">
                <span class="alarm-label-tag">
                  {{ getLabelEmoji(alarm.label) }} {{ alarm.label === '自定义' && alarm.note ? alarm.note : alarm.label }}
                </span>
                <span class="alarm-countdown" v-if="alarm.active">
                  {{ getAlarmCountdown(alarm.time) }}
                </span>
              </div>
            </div>
            <div class="alarm-right">
              <div class="alarm-ringing-badge" v-if="alarm.ringing">
                <span class="pulse-dot"></span>
                响铃中
              </div>
              <button v-if="alarm.ringing" class="btn btn-red btn-stop" @click="stopAlarm(alarm.id)">停止</button>
              <label class="toggle">
                <input type="checkbox" :checked="alarm.active" @change="toggleAlarm(alarm.id)" />
                <span class="toggle-slider"></span>
              </label>
              <button class="btn-remove" @click="removeAlarm(alarm.id)">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notification permission -->
    <div class="notif-bar card" v-if="!supportsNotification" style="margin-top: 20px;">
      <span class="notif-icon">🔕</span>
      <span class="notif-text">系统通知不可用，闹钟到时仍会显示页面提醒 + 声音提醒</span>
    </div>

    <div class="notif-bar card" v-else-if="notifPermission !== 'granted'" style="margin-top: 20px;">
      <span class="notif-icon">🔔</span>
      <span class="notif-text">开启浏览器通知，闹钟到时将弹出提醒</span>
      <button class="btn btn-primary" @click="requestNotification">授权通知</button>
    </div>

    <!-- Current time display -->
    <div class="current-time-display">
      <span class="time-display">{{ currentBeijingTime }}</span>
      <span class="ct-label">北京时间</span>
    </div>

    <div v-if="ringingAlarm" class="alarm-overlay" role="alertdialog" aria-modal="true" aria-labelledby="alarm-alert-title">
      <div class="alarm-dialog card">
        <div class="alarm-alert-icon">🔔</div>
        <div class="alarm-alert-content">
          <h2 id="alarm-alert-title" class="alarm-alert-title">闹钟时间到</h2>
          <p class="alarm-alert-time time-display">{{ ringingAlarm.time }}</p>
          <p class="alarm-alert-desc">{{ getAlarmLabel(ringingAlarm) }}</p>
        </div>
        <div class="alarm-alert-actions">
          <button class="btn btn-red btn-lg" @click="stopAlarm(ringingAlarm.id)">停止提醒</button>
          <button class="btn btn-ghost btn-lg" @click="dismissAlarmAlert">仅关闭弹窗</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Alarm {
  id: string
  time: string // HH:MM
  label: string
  note: string
  active: boolean
  ringing: boolean
}

const newAlarmTime = ref('21:30')
const newAlarmLabel = ref('美股开盘')
const newAlarmNote = ref('')
const supportsNotification = 'Notification' in window
const notifPermission = ref(supportsNotification ? Notification.permission : 'denied')
const notificationIcon = `${import.meta.env.BASE_URL}favicon.svg`
const ringingAlarm = ref<Alarm | null>(null)

const alarms = ref<Alarm[]>(
  JSON.parse(localStorage.getItem('clock-alarms') || '[]').map((alarm: Alarm) => ({
    ...alarm,
    ringing: false,
  }))
)

const now = ref(new Date())
let checkTimer: ReturnType<typeof setInterval>
let ringTimer: ReturnType<typeof setInterval> | null = null
let audioCtx: AudioContext | null = null
let lastAlarmCheckMs = Date.now()
const triggeredAlarmKeys = new Set<string>()

const currentBeijingTime = computed(() => {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now.value)
})

const sortedAlarms = computed(() =>
  [...alarms.value].sort((a, b) => a.time.localeCompare(b.time))
)

function getLabelEmoji(label: string) {
  if (label === '美股开盘') return ''
  if (label === '美股收盘') return ''
  return ''
}

function getAlarmLabel(alarm: Alarm) {
  return alarm.label === '自定义' && alarm.note ? alarm.note : alarm.label
}

function getAlarmCountdown(time: string) {
  const [hStr, mStr] = time.split(':')
  const targetH = parseInt(hStr)
  const targetM = parseInt(mStr)

  const bjParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now.value)
  const currentH = parseInt(bjParts.find(p => p.type === 'hour')!.value)
  const currentM = parseInt(bjParts.find(p => p.type === 'minute')!.value)

  let diffMin = (targetH * 60 + targetM) - (currentH * 60 + currentM)
  if (diffMin <= 0) diffMin += 24 * 60

  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  if (h === 0) return `${m} 分钟后`
  if (m === 0) return `${h} 小时后`
  return `${h}h ${m}m 后`
}

function addAlarm() {
  if (!newAlarmTime.value) return
  const alarm: Alarm = {
    id: Date.now().toString(),
    time: newAlarmTime.value,
    label: newAlarmLabel.value,
    note: newAlarmNote.value,
    active: true,
    ringing: false,
  }
  alarms.value.push(alarm)
  saveAlarms()
  newAlarmNote.value = ''
}

function removeAlarm(id: string) {
  stopAlarm(id)
  alarms.value = alarms.value.filter(a => a.id !== id)
  saveAlarms()
}

function toggleAlarm(id: string) {
  const alarm = alarms.value.find(a => a.id === id)
  if (alarm) {
    if (alarm.ringing) stopAlarm(id)
    alarm.active = !alarm.active
    alarm.ringing = false
    saveAlarms()
  }
}

function saveAlarms() {
  localStorage.setItem('clock-alarms', JSON.stringify(alarms.value))
}

function getBeijingParts(date: Date) {
  const bjParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => bjParts.find(p => p.type === type)?.value || '0'
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minuteOfDay: Number(get('hour')) * 60 + Number(get('minute')),
    second: Number(get('second')),
  }
}

function shouldTriggerAlarm(alarm: Alarm, previousMs: number, currentMs: number) {
  if (!alarm.active || alarm.ringing) return null

  const [hStr, mStr] = alarm.time.split(':')
  const targetMinute = Number(hStr) * 60 + Number(mStr)
  const previous = getBeijingParts(new Date(previousMs))
  const current = getBeijingParts(new Date(currentMs))
  const gapMs = currentMs - previousMs

  let triggerDateKey: string | null = null
  if (previous.dateKey === current.dateKey) {
    if (
      (targetMinute > previous.minuteOfDay && targetMinute <= current.minuteOfDay) ||
      (targetMinute === current.minuteOfDay && current.second < 5)
    ) {
      triggerDateKey = current.dateKey
    }
  } else if (gapMs <= 25 * 60 * 60 * 1000) {
    if (targetMinute > previous.minuteOfDay) {
      triggerDateKey = previous.dateKey
    } else if (targetMinute <= current.minuteOfDay) {
      triggerDateKey = current.dateKey
    }
  } else if (targetMinute === current.minuteOfDay && current.second < 5) {
    triggerDateKey = current.dateKey
  }

  if (!triggerDateKey) return null
  const triggerKey = `${alarm.id}-${triggerDateKey}-${alarm.time}`
  if (triggeredAlarmKeys.has(triggerKey)) return null
  return triggerKey
}

function checkAlarms() {
  const currentMs = now.value.getTime()
  alarms.value.forEach(alarm => {
    const triggerKey = shouldTriggerAlarm(alarm, lastAlarmCheckMs, currentMs)
    if (!triggerKey) return
    triggeredAlarmKeys.add(triggerKey)
    alarm.ringing = true
    triggerAlarm(alarm)
    saveAlarms()
  })
  lastAlarmCheckMs = currentMs
}

function triggerAlarm(alarm: Alarm) {
  ringingAlarm.value = alarm
  startRinging()
  if (supportsNotification && Notification.permission === 'granted') {
    const label = getAlarmLabel(alarm)
    new Notification(`🔔 闹钟 - ${label}`, {
      body: `时间：${alarm.time}，请回到页面停止提醒。`,
      icon: notificationIcon,
    })
  }
}

function stopAlarm(id?: string) {
  if (!id && !ringingAlarm.value) {
    alarms.value.forEach(alarm => { alarm.ringing = false })
    stopRinging()
    saveAlarms()
    return
  }

  const targetId = id || ringingAlarm.value?.id
  const alarm = alarms.value.find(a => a.id === targetId)
  if (alarm) alarm.ringing = false

  const nextRingingAlarm = alarms.value.find(a => a.ringing)
  if (nextRingingAlarm) {
    ringingAlarm.value = nextRingingAlarm
  } else {
    ringingAlarm.value = null
    stopRinging()
  }
  saveAlarms()
}

function dismissAlarmAlert() {
  ringingAlarm.value = null
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
      osc.frequency.value = 660
      osc.type = 'square'
      gain.gain.setValueAtTime(0.35, startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.22)
      osc.start(startAt)
      osc.stop(startAt + 0.22)
    }
  } catch (e) {}
}

async function requestNotification() {
  if (!supportsNotification) return
  const perm = await Notification.requestPermission()
  notifPermission.value = perm
}

function handleAlarmResume() {
  now.value = new Date()
  checkAlarms()
}

onMounted(() => {
  checkTimer = setInterval(() => {
    now.value = new Date()
    checkAlarms()
  }, 1000)
  document.addEventListener('visibilitychange', handleAlarmResume)
  window.addEventListener('focus', handleAlarmResume)
})

onUnmounted(() => {
  clearInterval(checkTimer)
  stopRinging()
  document.removeEventListener('visibilitychange', handleAlarmResume)
  window.removeEventListener('focus', handleAlarmResume)
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

.alarm-layout {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 24px;
  align-items: start;
}

.add-form {
  padding: 24px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.form-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* Alarm list */
.alarm-list-container {
  min-width: 0;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-text {
  font-size: 14px;
}

.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alarm-item {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;
}

.alarm-item.alarm-ringing {
  border-color: var(--amber);
  box-shadow: 0 0 20px var(--amber-glow);
  animation: ring-pulse 0.5s ease-in-out infinite alternate;
}

@keyframes ring-pulse {
  from { transform: translateX(0); }
  to { transform: translateX(3px); }
}

.alarm-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alarm-time {
  font-size: 36px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1;
}

.alarm-time.time-inactive {
  color: var(--text-muted);
}

.alarm-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.alarm-label-tag {
  font-size: 12px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}

.alarm-countdown {
  font-size: 12px;
  color: var(--accent-light);
  font-family: 'JetBrains Mono', monospace;
}

.alarm-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.alarm-ringing-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--amber);
  font-weight: 600;
}

.btn-stop {
  padding: 6px 10px;
  font-size: 12px;
}

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle input {
  display: none;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: var(--border);
  border-radius: 12px;
  transition: 0.2s;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  left: 3px;
  top: 3px;
  background: var(--text-muted);
  border-radius: 50%;
  transition: 0.2s;
}

.toggle input:checked + .toggle-slider {
  background: var(--accent);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background: white;
}

/* Notification bar */
.notif-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
}

.notif-icon {
  font-size: 20px;
}

.notif-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
}

/* Current time */
.current-time-display {
  position: fixed;
  bottom: 24px;
  right: 32px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.current-time-display .time-display {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-muted);
}

.ct-label {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

/* Alarm alert */
.alarm-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.5);
}

.alarm-dialog {
  width: min(420px, 100%);
  padding: 28px;
  text-align: center;
  border-color: rgba(245, 158, 11, 0.4);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
}

.alarm-alert-icon {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  border-radius: 8px;
  background: var(--amber-glow);
  color: var(--amber);
  font-size: 28px;
  animation: alarmPulse 0.8s ease-in-out infinite alternate;
}

.alarm-alert-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.alarm-alert-time {
  font-size: 48px;
  font-weight: 700;
  color: var(--amber);
  line-height: 1;
  margin-bottom: 10px;
}

.alarm-alert-desc {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.alarm-alert-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

@keyframes alarmPulse {
  from { transform: scale(1) rotate(-5deg); }
  to { transform: scale(1.08) rotate(5deg); }
}
</style>
