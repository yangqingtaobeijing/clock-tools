<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">美股日历</h1>
        <p class="page-desc">NYSE 2025–2026 休市日历 · 交易日倒计时</p>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="summary-row">
      <div class="summary-card card">
        <div class="summary-label">今天</div>
        <div class="summary-value">{{ todayStr }}</div>
        <div class="summary-sub" :class="isTodayHoliday ? 'text-red' : isWeekendToday ? 'text-amber' : 'text-green'">
          {{ isTodayHoliday ? '休市（假日）' : isWeekendToday ? '休市（周末）' : '✓ 交易日' }}
        </div>
      </div>

      <div class="summary-card card">
        <div class="summary-label">下一个交易日</div>
        <div class="summary-value">{{ nextTradingDayStr }}</div>
        <div class="summary-countdown">
          <span class="countdown-val time-display">{{ nextTradingCountdown }}</span>
          <span class="countdown-unit">后开市</span>
        </div>
      </div>

      <div class="summary-card card">
        <div class="summary-label">下一个休市日</div>
        <div class="summary-value holiday-name">{{ nextHolidayName }}</div>
        <div class="summary-countdown">
          <span class="countdown-val time-display">{{ nextHolidayDate }}</span>
          <span class="countdown-unit text-red">{{ nextHolidayDays }}</span>
        </div>
      </div>
    </div>

    <!-- Calendar -->
    <div class="calendar-container card">
      <div class="cal-nav">
        <button class="btn btn-ghost btn-sm" @click="prevMonth">← 上月</button>
        <h2 class="cal-month">{{ monthLabel }}</h2>
        <button class="btn btn-ghost btn-sm" @click="nextMonth">下月 →</button>
      </div>

      <div class="cal-legend">
        <span class="legend-item"><span class="legend-dot dot-today"></span> 今天</span>
        <span class="legend-item"><span class="legend-dot dot-holiday"></span> 休市（假日）</span>
        <span class="legend-item"><span class="legend-dot dot-weekend"></span> 休市（周末）</span>
        <span class="legend-item"><span class="legend-dot dot-trade"></span> 交易日</span>
      </div>

      <div class="cal-weekdays">
        <div v-for="wd in ['日', '一', '二', '三', '四', '五', '六']" :key="wd" class="cal-wd">{{ wd }}</div>
      </div>

      <div class="cal-grid">
        <!-- Empty cells before first day -->
        <div v-for="n in firstDayOfWeek" :key="'e' + n" class="cal-cell empty"></div>

        <!-- Day cells -->
        <div
          v-for="day in daysInMonth"
          :key="day.dateStr"
          class="cal-cell"
          :class="{
            'day-today': day.isToday,
            'day-holiday': day.holiday,
            'day-weekend': day.isWeekend && !day.holiday,
            'day-trade': !day.isWeekend && !day.holiday,
          }"
        >
          <span class="cal-day-num">{{ day.num }}</span>
          <span class="cal-holiday-name" v-if="day.holiday">{{ day.holiday.nameZh }}</span>
        </div>
      </div>
    </div>

    <!-- Holiday list -->
    <div class="holiday-list card">
      <div class="section-title" style="margin-bottom: 16px;">{{ currentYear }}–{{ currentYear + 1 }} 完整休市日</div>
      <div class="hlist">
        <div
          v-for="h in allHolidays"
          :key="h.date"
          class="hlist-item"
          :class="{ 'hlist-past': h.date < todayDateKey }"
        >
          <span class="hlist-date time-display">{{ h.date }}</span>
          <span class="hlist-name">{{ h.nameZh }}</span>
          <span class="hlist-en">{{ h.name }}</span>
          <span class="hlist-past-tag" v-if="h.date < todayDateKey">已过</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  US_MARKET_HOLIDAYS,
  isMarketHoliday,
  isWeekend,
  formatDateKey,
  getNextTradingDay,
  getNextHoliday,
} from '@/data/marketHolidays'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval>

const viewYear = ref(now.value.getFullYear())
const viewMonth = ref(now.value.getMonth()) // 0-indexed

const todayDateKey = computed(() => formatDateKey(now.value))

const currentYear = computed(() => now.value.getFullYear())

const todayStr = computed(() => {
  return now.value.toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short'
  })
})

const isTodayHoliday = computed(() => !!isMarketHoliday(todayDateKey.value))
const isWeekendToday = computed(() => isWeekend(now.value))

const nextTradingDay = computed(() => getNextTradingDay(now.value))

const nextTradingDayStr = computed(() =>
  nextTradingDay.value.toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'short',
  })
)

const nextTradingCountdown = computed(() => {
  const diff = nextTradingDay.value.getTime() - now.value.getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `${d}天${h}小时`
  return `${h}小时`
})

const nextHoliday = computed(() => getNextHoliday(now.value))

const nextHolidayName = computed(() => nextHoliday.value?.nameZh || '-')
const nextHolidayDate = computed(() => nextHoliday.value?.date || '-')

const nextHolidayDays = computed(() => {
  if (!nextHoliday.value) return ''
  const parts = nextHoliday.value.date.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2])
  const diff = Math.ceil((d.getTime() - now.value.getTime()) / 86400000)
  return `还有 ${diff} 天`
})

const allHolidays = computed(() => US_MARKET_HOLIDAYS)

// Calendar
const monthLabel = computed(() => {
  const d = new Date(viewYear.value, viewMonth.value, 1)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
})

const firstDayOfWeek = computed(() => {
  return new Date(viewYear.value, viewMonth.value, 1).getDay()
})

const daysInMonth = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const count = new Date(year, month + 1, 0).getDate()
  const todayKey = todayDateKey.value

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(year, month, i + 1)
    const dateStr = formatDateKey(d)
    const holiday = isMarketHoliday(dateStr)
    return {
      num: i + 1,
      dateStr,
      isToday: dateStr === todayKey,
      isWeekend: isWeekend(d),
      holiday: holiday || null,
    }
  })
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 60000)
})
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.page { max-width: 1100px; }

.page-header {
  margin-bottom: 28px;
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

/* Summary cards */
.summary-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  padding: 20px;
}

.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.summary-sub {
  font-size: 13px;
  font-weight: 600;
}

.text-green { color: var(--green); }
.text-red { color: var(--red); }
.text-amber { color: var(--amber); }

.summary-countdown {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.countdown-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-light);
}

.countdown-unit {
  font-size: 13px;
  color: var(--text-muted);
}

.holiday-name {
  color: var(--red) !important;
}

/* Calendar */
.calendar-container {
  padding: 24px;
  margin-bottom: 24px;
}

.cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.cal-month {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.cal-legend {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.dot-today { background: var(--accent); }
.dot-holiday { background: var(--red); }
.dot-weekend { background: var(--border-bright); }
.dot-trade { background: var(--green); opacity: 0.5; }

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.cal-wd {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  padding: 4px 0;
  letter-spacing: 0.04em;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.cal-cell {
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  position: relative;
  font-size: 14px;
  min-height: 52px;
  cursor: default;
}

.cal-cell.empty {
  background: transparent;
}

.cal-day-num {
  font-weight: 500;
  line-height: 1;
}

.cal-holiday-name {
  font-size: 9px;
  line-height: 1.2;
  text-align: center;
  padding: 0 2px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-today {
  background: var(--accent);
  color: white;
  box-shadow: 0 0 16px var(--accent-glow);
}

.day-holiday {
  background: var(--red-glow);
  color: var(--red);
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.day-holiday .cal-holiday-name {
  color: rgba(239, 68, 68, 0.7);
}

.day-weekend {
  background: var(--bg-primary);
  color: var(--text-muted);
}

.day-trade {
  background: var(--bg-card-hover);
  color: var(--text-secondary);
}

.day-trade:hover {
  background: rgba(16, 185, 129, 0.1);
  color: var(--green);
}

/* Holiday list */
.holiday-list {
  padding: 24px;
}

.hlist {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.hlist-item {
  display: grid;
  grid-template-columns: 140px 1fr 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.hlist-item:last-child {
  border-bottom: none;
}

.hlist-date {
  color: var(--accent-light);
  font-size: 13px;
}

.hlist-name {
  color: var(--text-primary);
  font-weight: 500;
}

.hlist-en {
  color: var(--text-muted);
  font-size: 12px;
}

.hlist-past {
  opacity: 0.45;
}

.hlist-past-tag {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
}
</style>
