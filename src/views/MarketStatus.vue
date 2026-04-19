<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">市场状态看板</h1>
        <p class="page-desc">实时市场开收盘状态 · 纯前端计算，无需 API</p>
      </div>
      <div class="last-update">
        更新于 <span class="time-display">{{ currentBJTime }}</span> 北京时间
      </div>
    </div>

    <!-- Market cards grid -->
    <div class="markets-grid">
      <div
        v-for="market in markets"
        :key="market.id"
        class="market-card card"
        :class="{
          'card-open': market.status === 'open',
          'card-closed': market.status === 'closed',
          'card-holiday': market.status === 'holiday',
        }"
      >
        <!-- Header -->
        <div class="mc-header">
          <div class="mc-market-info">
            <span class="mc-flag">{{ market.flag }}</span>
            <div>
              <div class="mc-name">{{ market.name }}</div>
              <div class="mc-exchange">{{ market.exchange }}</div>
            </div>
          </div>
          <div class="badge" :class="`badge-${market.status === 'holiday' ? 'holiday' : market.status === 'open' ? 'open' : 'closed'}`">
            <span class="pulse-dot" v-if="market.status === 'open'"></span>
            {{ market.statusLabel }}
          </div>
        </div>

        <!-- Local time -->
        <div class="mc-time-row">
          <div class="mc-local-time time-display">{{ market.localTime }}</div>
          <div class="mc-local-date">{{ market.localDate }}</div>
        </div>

        <!-- Session hours -->
        <div class="mc-session">
          <div class="session-bar">
            <div
              class="session-fill"
              :style="{ width: market.sessionProgress + '%' }"
              :class="`fill-${market.status}`"
            ></div>
          </div>
          <div class="session-labels">
            <span>{{ market.openTime }}</span>
            <span>{{ market.closeTime }}</span>
          </div>
        </div>

        <!-- Countdown -->
        <div class="mc-footer">
          <div class="mc-countdown-label">{{ market.countdownLabel }}</div>
          <div class="mc-countdown time-display">{{ market.countdown }}</div>
        </div>

        <!-- Trading hours note -->
        <div class="mc-note" v-if="market.note">{{ market.note }}</div>
      </div>
    </div>

    <!-- Additional info -->
    <div class="info-row">
      <div class="card info-card">
        <div class="section-title" style="margin-bottom: 12px;">交易时段说明（北京时间）</div>
        <div class="info-list">
          <div class="info-item" v-for="item in tradingInfoBJ" :key="item.market">
            <span class="info-market">{{ item.market }}</span>
            <span class="info-hours time-display">{{ item.hours }}</span>
            <span class="info-note">{{ item.note }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isMarketHoliday } from '@/data/marketHolidays'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval>

function getLocalTime(tz: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now.value)
}

function getLocalDate(tz: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now.value)
}

function getTZParts(tz: string): { h: number; m: number; s: number; weekday: number; dateStr: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now.value)

  const get = (type: string) => parts.find(p => p.type === type)?.value || '0'
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  const year = get('year')
  const month = get('month')
  const day = get('day')

  return {
    h: parseInt(get('hour')),
    m: parseInt(get('minute')),
    s: parseInt(get('second')),
    weekday: weekdayMap[get('weekday')] ?? 0,
    dateStr: `${year}-${month}-${day}`,
  }
}

function toMin(h: number, m: number) {
  return h * 60 + m
}

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`
  return `${pad(m)}:${pad(s)}`
}

function pad(n: number) { return String(n).padStart(2, '0') }

function sessionProgress(current: number, open: number, close: number): number {
  if (current < open || current > close) return 0
  return Math.round(((current - open) / (close - open)) * 100)
}

interface Market {
  id: string
  name: string
  exchange: string
  flag: string
  status: 'open' | 'closed' | 'holiday'
  statusLabel: string
  localTime: string
  localDate: string
  openTime: string
  closeTime: string
  sessionProgress: number
  countdownLabel: string
  countdown: string
  note?: string
}

const currentBJTime = computed(() => getLocalTime('Asia/Shanghai'))

const markets = computed((): Market[] => {
  return [
    computeNYSE(),
    computeSSE(),
    computeHKEX(),
    computeLSE(),
  ]
})

function computeNYSE(): Market {
  const tz = 'America/New_York'
  const { h, m, s, weekday, dateStr } = getTZParts(tz)
  const holiday = isMarketHoliday(dateStr)
  const isWE = weekday === 0 || weekday === 6
  const curMin = toMin(h, m)
  // NYSE: 09:30 - 16:00
  const openMin = toMin(9, 30)
  const closeMin = toMin(16, 0)
  const isOpen = !holiday && !isWE && curMin >= openMin && curMin < closeMin

  let status: 'open' | 'closed' | 'holiday' = holiday ? 'holiday' : 'closed'
  if (isOpen) status = 'open'

  let countdownLabel: string
  let countdownSec: number

  if (isOpen) {
    countdownLabel = '距收盘'
    countdownSec = (closeMin - curMin) * 60 - s
  } else if (!holiday && !isWE) {
    if (curMin < openMin) {
      countdownLabel = '距开盘'
      countdownSec = (openMin - curMin) * 60 - s
    } else {
      // After close - find next trading day open
      countdownLabel = '次日开盘'
      countdownSec = (24 * 60 - curMin + openMin) * 60 - s
    }
  } else {
    countdownLabel = '休市中'
    countdownSec = (24 * 60 - curMin + openMin) * 60 - s
  }

  return {
    id: 'nyse',
    name: '美股 NYSE',
    exchange: 'New York Stock Exchange',
    flag: '🇺🇸',
    status,
    statusLabel: status === 'open' ? '开盘中' : status === 'holiday' ? `休市 · ${holiday?.nameZh}` : '已收盘',
    localTime: getLocalTime(tz),
    localDate: getLocalDate(tz),
    openTime: '09:30',
    closeTime: '16:00',
    sessionProgress: isOpen ? sessionProgress(curMin, openMin, closeMin) : 0,
    countdownLabel,
    countdown: formatCountdown(Math.max(0, countdownSec)),
    note: '夏令时 UTC-4 / 冬令时 UTC-5',
  }
}

function computeSSE(): Market {
  const tz = 'Asia/Shanghai'
  const { h, m, s, weekday } = getTZParts(tz)
  // A股: 周一~五，09:30-11:30，13:00-15:00（无法区分午休，合并计算为09:30-15:00含午休提示）
  const isWE = weekday === 0 || weekday === 6
  const curMin = toMin(h, m)
  const openAM = toMin(9, 30)
  const closeAM = toMin(11, 30)
  const openPM = toMin(13, 0)
  const closePM = toMin(15, 0)

  const isOpenAM = !isWE && curMin >= openAM && curMin < closeAM
  const isOpenPM = !isWE && curMin >= openPM && curMin < closePM
  const isOpen = isOpenAM || isOpenPM
  const isLunchBreak = !isWE && curMin >= closeAM && curMin < openPM

  let status: 'open' | 'closed' | 'holiday' = 'closed'
  if (isOpen) status = 'open'

  let countdownLabel: string
  let countdownSec: number

  if (isOpenAM) {
    countdownLabel = '距午休'
    countdownSec = (closeAM - curMin) * 60 - s
  } else if (isLunchBreak) {
    countdownLabel = '距下午开盘'
    countdownSec = (openPM - curMin) * 60 - s
  } else if (isOpenPM) {
    countdownLabel = '距收盘'
    countdownSec = (closePM - curMin) * 60 - s
  } else if (!isWE) {
    if (curMin < openAM) {
      countdownLabel = '距开盘'
      countdownSec = (openAM - curMin) * 60 - s
    } else {
      countdownLabel = '次日开盘'
      countdownSec = (24 * 60 - curMin + openAM) * 60 - s
    }
  } else {
    countdownLabel = '休市中'
    countdownSec = 0
  }

  const progress = isOpenAM
    ? sessionProgress(curMin, openAM, closeAM)
    : isOpenPM
    ? sessionProgress(curMin, openPM, closePM)
    : 0

  return {
    id: 'sse',
    name: 'A股 上交所',
    exchange: 'Shanghai Stock Exchange',
    flag: '🇨🇳',
    status,
    statusLabel: status === 'open' ? (isOpenAM ? '开盘中（上午）' : '开盘中（下午）') : isLunchBreak ? '午间休市' : '已收盘',
    localTime: getLocalTime(tz),
    localDate: getLocalDate(tz),
    openTime: '09:30',
    closeTime: '15:00',
    sessionProgress: progress,
    countdownLabel,
    countdown: formatCountdown(Math.max(0, countdownSec)),
    note: '午休 11:30–13:00 · UTC+8',
  }
}

function computeHKEX(): Market {
  const tz = 'Asia/Hong_Kong'
  const { h, m, s, weekday } = getTZParts(tz)
  const isWE = weekday === 0 || weekday === 6
  const curMin = toMin(h, m)
  // HKEX: 09:30-12:00, 13:00-16:00
  const openAM = toMin(9, 30)
  const closeAM = toMin(12, 0)
  const openPM = toMin(13, 0)
  const closePM = toMin(16, 0)

  const isOpenAM = !isWE && curMin >= openAM && curMin < closeAM
  const isOpenPM = !isWE && curMin >= openPM && curMin < closePM
  const isOpen = isOpenAM || isOpenPM
  const isLunch = !isWE && curMin >= closeAM && curMin < openPM

  let status: 'open' | 'closed' | 'holiday' = 'closed'
  if (isOpen) status = 'open'

  let countdownLabel: string
  let countdownSec: number

  if (isOpenAM) {
    countdownLabel = '距午休'
    countdownSec = (closeAM - curMin) * 60 - s
  } else if (isLunch) {
    countdownLabel = '距下午开盘'
    countdownSec = (openPM - curMin) * 60 - s
  } else if (isOpenPM) {
    countdownLabel = '距收盘'
    countdownSec = (closePM - curMin) * 60 - s
  } else if (!isWE && curMin < openAM) {
    countdownLabel = '距开盘'
    countdownSec = (openAM - curMin) * 60 - s
  } else {
    countdownLabel = '次日开盘'
    countdownSec = (24 * 60 - curMin + openAM) * 60 - s
  }

  return {
    id: 'hkex',
    name: '港股 HKEX',
    exchange: 'Hong Kong Exchanges',
    flag: '🇭🇰',
    status,
    statusLabel: status === 'open' ? '开盘中' : isLunch ? '午间休市' : '已收盘',
    localTime: getLocalTime(tz),
    localDate: getLocalDate(tz),
    openTime: '09:30',
    closeTime: '16:00',
    sessionProgress: isOpenAM
      ? sessionProgress(curMin, openAM, closeAM)
      : isOpenPM ? sessionProgress(curMin, openPM, closePM) : 0,
    countdownLabel,
    countdown: formatCountdown(Math.max(0, countdownSec)),
    note: '午休 12:00–13:00 · UTC+8',
  }
}

function computeLSE(): Market {
  const tz = 'Europe/London'
  const { h, m, s, weekday } = getTZParts(tz)
  const isWE = weekday === 0 || weekday === 6
  const curMin = toMin(h, m)
  // LSE: 08:00-16:30
  const openMin = toMin(8, 0)
  const closeMin = toMin(16, 30)
  const isOpen = !isWE && curMin >= openMin && curMin < closeMin

  let status: 'open' | 'closed' | 'holiday' = 'closed'
  if (isOpen) status = 'open'

  let countdownLabel: string
  let countdownSec: number

  if (isOpen) {
    countdownLabel = '距收盘'
    countdownSec = (closeMin - curMin) * 60 - s
  } else if (!isWE) {
    if (curMin < openMin) {
      countdownLabel = '距开盘'
      countdownSec = (openMin - curMin) * 60 - s
    } else {
      countdownLabel = '次日开盘'
      countdownSec = (24 * 60 - curMin + openMin) * 60 - s
    }
  } else {
    countdownLabel = '休市中'
    countdownSec = (24 * 60 - curMin + openMin) * 60 - s
  }

  return {
    id: 'lse',
    name: '欧股 LSE',
    exchange: 'London Stock Exchange',
    flag: '🇬🇧',
    status,
    statusLabel: status === 'open' ? '开盘中' : '已收盘',
    localTime: getLocalTime(tz),
    localDate: getLocalDate(tz),
    openTime: '08:00',
    closeTime: '16:30',
    sessionProgress: isOpen ? sessionProgress(curMin, openMin, closeMin) : 0,
    countdownLabel,
    countdown: formatCountdown(Math.max(0, countdownSec)),
    note: '夏令时 UTC+1 / 冬令时 UTC+0',
  }
}

const tradingInfoBJ = computed(() => {
  // Convert to Beijing time labels (approximate, no DST calc in label)
  return [
    { market: '🇺🇸 美股 NYSE', hours: '21:30 – 04:00+', note: '夏令时 20:30–03:00+' },
    { market: '🇨🇳 A股 上交所', hours: '09:30 – 15:00', note: '午休 11:30–13:00' },
    { market: '🇭🇰 港股 HKEX', hours: '09:30 – 16:00', note: '午休 12:00–13:00' },
    { market: '🇬🇧 欧股 LSE', hours: '16:00 – 00:30+', note: '夏令时 15:00–23:30' },
  ]
})

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.page { max-width: 1200px; }

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
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

.last-update {
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
}

.last-update .time-display {
  color: var(--accent-light);
  font-size: 13px;
}

/* Markets grid */
.markets-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 24px;
}

.market-card {
  padding: 24px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s;
}

.market-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--border);
  transition: background 0.3s;
}

.card-open::before {
  background: var(--green);
  box-shadow: 0 0 12px var(--green-glow);
}

.card-closed::before {
  background: var(--border-bright);
}

.card-holiday::before {
  background: var(--red);
}

.card-open {
  border-color: rgba(16, 185, 129, 0.25);
}

.card-holiday {
  border-color: rgba(239, 68, 68, 0.2);
}

/* Market card header */
.mc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.mc-market-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mc-flag {
  font-size: 28px;
}

.mc-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.mc-exchange {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Local time */
.mc-time-row {
  margin-bottom: 20px;
}

.mc-local-time {
  font-size: 44px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1;
}

.mc-local-date {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Session bar */
.mc-session {
  margin-bottom: 16px;
}

.session-bar {
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.session-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s ease;
}

.fill-open { background: var(--green); }
.fill-closed { background: var(--border-bright); }
.fill-holiday { background: var(--red); opacity: 0.5; }

.session-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

/* Footer countdown */
.mc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.mc-countdown-label {
  font-size: 12px;
  color: var(--text-muted);
}

.mc-countdown {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent-light);
}

.card-open .mc-countdown {
  color: var(--green);
}

.mc-note {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

/* Info section */
.info-row {
  margin-top: 4px;
}

.info-card {
  padding: 24px;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.info-item {
  display: grid;
  grid-template-columns: 200px 200px 1fr;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.info-item:last-child {
  border-bottom: none;
}

.info-market {
  color: var(--text-primary);
  font-weight: 500;
}

.info-hours {
  color: var(--accent-light);
  font-size: 13px;
}

.info-note {
  color: var(--text-muted);
  font-size: 12px;
}
</style>
