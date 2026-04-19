<template>
  <div id="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">⏱</div>
        <div class="logo-text">
          <span class="logo-title">Clock Tools</span>
          <span class="logo-sub">工具站</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
          <span class="nav-sublabel">{{ item.sub }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <div class="current-time">
          <div class="current-time-label">北京时间</div>
          <div class="current-time-value time-display">{{ beijingTime }}</div>
        </div>
        <button
          type="button"
          class="theme-toggle"
          @click="toggleTheme"
          :aria-label="isDark ? '当前夜间模式，切换到白天模式' : '当前白天模式，切换到夜间模式'"
          :title="isDark ? '切换白天模式' : '切换夜间模式'"
        >
          <span class="theme-icon" aria-hidden="true">{{ isDark ? '🌙' : '☀️' }}</span>
          <span class="theme-copy">
            <span class="theme-kicker">显示模式</span>
            <span class="theme-label">{{ isDark ? '夜间' : '白天' }}</span>
          </span>
        </button>
      </div>
    </aside>

    <!-- Main -->
    <main class="main-content">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <div
      v-if="globalReminder"
      class="global-reminder-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="global-reminder-title"
    >
      <div class="global-reminder-dialog card">
        <div class="global-reminder-icon">{{ globalReminder.icon }}</div>
        <h2 id="global-reminder-title" class="global-reminder-title">{{ globalReminder.title }}</h2>
        <p class="global-reminder-desc">{{ globalReminder.detail }}</p>
        <div class="global-reminder-actions">
          <button class="btn btn-red btn-lg" @click="dismissGlobalReminder">停止提醒</button>
          <button class="btn btn-ghost btn-lg" @click="openReminderTarget">{{ globalReminder.actionLabel }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

interface StoredCountdown {
  state: 'running' | 'paused'
  totalSet: number
  remaining: number
  endAtMs: number | null
}

interface Alarm {
  id: string
  time: string
  label: string
  note: string
  active: boolean
  ringing: boolean
}

interface GlobalReminder {
  type: 'countdown' | 'alarm'
  icon: string
  title: string
  detail: string
  actionLabel: string
  targetPath: string
}

const route = useRoute()
const router = useRouter()

// Theme
type ThemeMode = 'dark' | 'light'

const THEME_STORAGE_KEY = 'clock-theme'

function getInitialTheme(): ThemeMode {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

const isDark = ref(getInitialTheme() === 'dark')

function applyTheme(theme: ThemeMode) {
  isDark.value = theme === 'dark'
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(THEME_STORAGE_KEY, theme)
}

function toggleTheme() {
  applyTheme(isDark.value ? 'light' : 'dark')
}

const navItems = [
  { path: '/world-clock', icon: '🌍', label: '世界时钟', sub: 'World Clock' },
  { path: '/countdown', icon: '⏳', label: '倒计时', sub: 'Countdown' },
  { path: '/alarm', icon: '🔔', label: '闹钟', sub: 'Alarm' },
  { path: '/stopwatch', icon: '🏁', label: '秒表', sub: 'Stopwatch' },
  { path: '/market-calendar', icon: '📅', label: '美股日历', sub: 'Market Calendar' },
  { path: '/market-status', icon: '📊', label: '市场状态', sub: 'Market Status' },
]

const beijingTime = ref('')
const globalReminder = ref<GlobalReminder | null>(null)
const supportsNotification = 'Notification' in window
const notificationIcon = `${import.meta.env.BASE_URL}favicon.svg`
const COUNTDOWN_STORAGE_KEY = 'clock-countdown-state'
const ALARMS_STORAGE_KEY = 'clock-alarms'

let clockTimer: ReturnType<typeof setInterval>
let reminderTimer: ReturnType<typeof setInterval>
let reminderAudioCtx: AudioContext | null = null
let reminderRingTimer: ReturnType<typeof setInterval> | null = null
let lastAlarmCheckMs = Date.now()
const triggeredAlarmKeys = new Set<string>()

function updateTime() {
  const now = new Date()
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }
  beijingTime.value = new Intl.DateTimeFormat('en-GB', options).format(now)
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}小时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

function getAlarmLabel(alarm: Alarm) {
  return alarm.label === '自定义' && alarm.note ? alarm.note : alarm.label
}

function getBeijingParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minuteOfDay: Number(get('hour')) * 60 + Number(get('minute')),
    second: Number(get('second')),
  }
}

function parseAlarms(): Alarm[] {
  try {
    return JSON.parse(localStorage.getItem(ALARMS_STORAGE_KEY) || '[]')
  } catch (e) {
    return []
  }
}

function checkGlobalCountdown() {
  if (route.path === '/countdown') return
  try {
    const raw = localStorage.getItem(COUNTDOWN_STORAGE_KEY)
    if (!raw) return
    const countdown = JSON.parse(raw) as StoredCountdown
    if (countdown.state !== 'running' || !countdown.endAtMs) return
    if (countdown.endAtMs > Date.now()) return

    localStorage.removeItem(COUNTDOWN_STORAGE_KEY)
    showGlobalReminder({
      type: 'countdown',
      icon: '⏰',
      title: '倒计时结束',
      detail: `设定的 ${formatDuration(countdown.totalSet)} 已完成。`,
      actionLabel: '打开倒计时',
      targetPath: '/countdown',
    })
  } catch (e) {
    localStorage.removeItem(COUNTDOWN_STORAGE_KEY)
  }
}

function shouldTriggerAlarm(alarm: Alarm, previousMs: number, currentMs: number) {
  if (!alarm.active) return null

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

function checkGlobalAlarms() {
  const nowMs = Date.now()
  if (route.path === '/alarm') {
    lastAlarmCheckMs = nowMs
    return
  }

  const alarms = parseAlarms()
  for (const alarm of alarms) {
    const triggerKey = shouldTriggerAlarm(alarm, lastAlarmCheckMs, nowMs)
    if (!triggerKey) continue
    triggeredAlarmKeys.add(triggerKey)
    const label = getAlarmLabel(alarm)
    showGlobalReminder({
      type: 'alarm',
      icon: '🔔',
      title: '闹钟时间到',
      detail: `${alarm.time} · ${label}`,
      actionLabel: '打开闹钟',
      targetPath: '/alarm',
    })
    if (supportsNotification && Notification.permission === 'granted') {
      new Notification(`🔔 闹钟 - ${label}`, {
        body: `时间：${alarm.time}，请回到页面停止提醒。`,
        icon: notificationIcon,
      })
    }
  }
  lastAlarmCheckMs = nowMs
}

function runGlobalReminderChecks() {
  checkGlobalCountdown()
  checkGlobalAlarms()
}

function showGlobalReminder(reminder: GlobalReminder) {
  globalReminder.value = reminder
  startGlobalRinging()
  if (reminder.type === 'countdown' && supportsNotification && Notification.permission === 'granted') {
    new Notification('⏰ 倒计时结束！', {
      body: `${reminder.detail} 请回到页面停止提醒。`,
      icon: notificationIcon,
    })
  }
}

function prepareGlobalAudio() {
  try {
    reminderAudioCtx = reminderAudioCtx || new AudioContext()
    if (reminderAudioCtx.state === 'suspended') reminderAudioCtx.resume()
  } catch (e) {
    reminderAudioCtx = null
  }
}

function startGlobalRinging() {
  stopGlobalRinging()
  playGlobalBeep()
  reminderRingTimer = setInterval(playGlobalBeep, 1200)
}

function stopGlobalRinging() {
  if (reminderRingTimer) {
    clearInterval(reminderRingTimer)
    reminderRingTimer = null
  }
}

function playGlobalBeep() {
  try {
    prepareGlobalAudio()
    if (!reminderAudioCtx) return
    for (let i = 0; i < 2; i++) {
      const startAt = reminderAudioCtx.currentTime + i * 0.28
      const osc = reminderAudioCtx.createOscillator()
      const gain = reminderAudioCtx.createGain()
      osc.connect(gain)
      gain.connect(reminderAudioCtx.destination)
      osc.frequency.value = globalReminder.value?.type === 'alarm' ? 660 : 880
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

function dismissGlobalReminder() {
  stopGlobalRinging()
  globalReminder.value = null
}

function openReminderTarget() {
  const path = globalReminder.value?.targetPath
  dismissGlobalReminder()
  if (path) router.push(path)
}

onMounted(() => {
  updateTime()
  clockTimer = setInterval(updateTime, 1000)
  reminderTimer = setInterval(runGlobalReminderChecks, 1000)
  document.addEventListener('visibilitychange', runGlobalReminderChecks)
  window.addEventListener('focus', runGlobalReminderChecks)
  document.addEventListener('pointerdown', prepareGlobalAudio)
  runGlobalReminderChecks()
})
onUnmounted(() => {
  clearInterval(clockTimer)
  clearInterval(reminderTimer)
  stopGlobalRinging()
  document.removeEventListener('visibilitychange', runGlobalReminderChecks)
  window.removeEventListener('focus', runGlobalReminderChecks)
  document.removeEventListener('pointerdown', prepareGlobalAudio)
  if (reminderAudioCtx) reminderAudioCtx.close()
})
</script>

<style scoped>
#app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 220px;
  min-width: 220px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 20px 20px;
  border-bottom: 1px solid var(--border);
}

.logo-icon {
  font-size: 28px;
  line-height: 1;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.logo-sub {
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.05em;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary);
  transition: all 0.15s;
  position: relative;
}

.nav-item:hover {
  background: var(--bg-card);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-glow);
  color: var(--accent-light);
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

.nav-sublabel {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

.nav-item.active .nav-sublabel {
  color: rgba(129, 140, 248, 0.6);
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border);
}

.current-time {
  margin-bottom: 14px;
}

.current-time-label {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.current-time-value {
  font-size: 22px;
  font-weight: 600;
  color: var(--accent-light);
  letter-spacing: 0.02em;
}

.theme-toggle {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
  text-align: left;
  transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s;
}

.theme-toggle:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-bright);
}

.theme-toggle:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.theme-icon {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--accent-glow);
  color: var(--accent-light);
  font-size: 15px;
  flex-shrink: 0;
}

.theme-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.theme-kicker {
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.theme-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.main-content {
  flex: 1;
  margin-left: 220px;
  min-height: 100vh;
  padding: 32px;
  overflow-x: hidden;
}

.global-reminder-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.5);
}

.global-reminder-dialog {
  width: min(420px, 100%);
  padding: 28px;
  text-align: center;
  border-color: rgba(245, 158, 11, 0.4);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
}

.global-reminder-icon {
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
  animation: globalReminderPulse 0.8s ease-in-out infinite alternate;
}

.global-reminder-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.global-reminder-desc {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

.global-reminder-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.btn-lg {
  padding: 12px 28px;
  font-size: 15px;
}

@keyframes globalReminderPulse {
  from { transform: scale(1); }
  to { transform: scale(1.08); }
}
</style>
