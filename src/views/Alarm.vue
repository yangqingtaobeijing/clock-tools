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
    <div class="notif-bar card" v-if="notifPermission !== 'granted'" style="margin-top: 20px;">
      <span class="notif-icon">🔔</span>
      <span class="notif-text">开启浏览器通知，闹钟到时将弹出提醒</span>
      <button class="btn btn-primary" @click="requestNotification">授权通知</button>
    </div>

    <!-- Current time display -->
    <div class="current-time-display">
      <span class="time-display">{{ currentBeijingTime }}</span>
      <span class="ct-label">北京时间</span>
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
const notifPermission = ref(Notification.permission)

const alarms = ref<Alarm[]>(
  JSON.parse(localStorage.getItem('clock-alarms') || '[]')
)

const now = ref(new Date())
let checkTimer: ReturnType<typeof setInterval>

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
  alarms.value = alarms.value.filter(a => a.id !== id)
  saveAlarms()
}

function toggleAlarm(id: string) {
  const alarm = alarms.value.find(a => a.id === id)
  if (alarm) {
    alarm.active = !alarm.active
    alarm.ringing = false
    saveAlarms()
  }
}

function saveAlarms() {
  localStorage.setItem('clock-alarms', JSON.stringify(alarms.value))
}

function checkAlarms() {
  const bjParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now.value)
  const h = parseInt(bjParts.find(p => p.type === 'hour')!.value)
  const m = parseInt(bjParts.find(p => p.type === 'minute')!.value)
  const s = parseInt(bjParts.find(p => p.type === 'second')!.value)

  const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

  alarms.value.forEach(alarm => {
    if (alarm.active && !alarm.ringing && alarm.time === timeStr && s < 5) {
      alarm.ringing = true
      triggerAlarm(alarm)
      setTimeout(() => {
        alarm.ringing = false
      }, 60000)
    }
  })
}

function triggerAlarm(alarm: Alarm) {
  playBeep()
  if (Notification.permission === 'granted') {
    const label = alarm.label === '自定义' && alarm.note ? alarm.note : alarm.label
    new Notification(`🔔 闹钟 - ${label}`, {
      body: `时间：${alarm.time}`,
      icon: '/clock-tools/favicon.ico',
    })
  }
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 660
        osc.type = 'square'
        gain.gain.setValueAtTime(0.3, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.3)
      }, i * 400)
    }
  } catch (e) {}
}

async function requestNotification() {
  const perm = await Notification.requestPermission()
  notifPermission.value = perm
}

onMounted(() => {
  checkTimer = setInterval(() => {
    now.value = new Date()
    checkAlarms()
  }, 1000)
})

onUnmounted(() => clearInterval(checkTimer))
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
</style>
