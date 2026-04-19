<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">世界时钟</h1>
        <p class="page-desc">实时显示全球各地时间 · 美股交易时段高亮</p>
      </div>
      <div class="us-market-banner" :class="isUSMarketOpen ? 'open' : 'closed'">
        <span class="pulse-dot" v-if="isUSMarketOpen"></span>
        <span>{{ isUSMarketOpen ? '🟢 美股开盘中' : '🔴 美股已收盘' }}</span>
      </div>
    </div>

    <!-- Clock Grid -->
    <div class="clocks-grid">
      <div
        v-for="city in activeCities"
        :key="city.id"
        class="clock-card card"
        :class="{
          'glow-green': isUSMarketOpen && city.id === 'new-york',
          'beijing-card': city.id === 'beijing'
        }"
      >
        <div class="clock-card-header">
          <div class="city-info">
            <span class="city-flag">{{ city.flag }}</span>
            <div>
              <div class="city-name">{{ city.name }}</div>
              <div class="city-tz">{{ city.timezone }}</div>
            </div>
          </div>
          <button
            v-if="!city.preset"
            class="btn-remove"
            @click="removeCity(city.id)"
            title="删除"
          >✕</button>
        </div>

        <div class="clock-time time-display">{{ getCityTime(city.tz) }}</div>
        <div class="clock-date">{{ getCityDate(city.tz) }}</div>

        <div class="clock-footer">
          <span class="time-diff" v-if="city.id !== 'beijing'">
            {{ getTimeDiff(city.tz) }}
          </span>
          <span class="time-diff highlight" v-else>本地参考基准</span>

          <span v-if="city.id === 'new-york'" class="market-tag" :class="isUSMarketOpen ? 'open' : 'closed'">
            {{ isUSMarketOpen ? '开盘中' : '已收盘' }}
          </span>
        </div>
      </div>

      <!-- Add City Card -->
      <div class="clock-card card add-card" @click="showAddModal = true">
        <div class="add-icon">＋</div>
        <div class="add-text">添加城市</div>
      </div>
    </div>

    <!-- Add City Modal -->
    <Teleport to="body">
      <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
        <div class="modal card">
          <div class="modal-header">
            <h3>添加城市</h3>
            <button class="btn-remove" @click="showAddModal = false">✕</button>
          </div>
          <div class="modal-body">
            <input
              v-model="searchQuery"
              class="input"
              placeholder="搜索城市或时区..."
              style="margin-bottom: 12px;"
            />
            <div class="tz-list">
              <div
                v-for="tz in filteredTimezones"
                :key="tz.tz"
                class="tz-item"
                :class="{ disabled: isCityAdded(tz.tz) }"
                @click="addCity(tz)"
              >
                <span class="tz-flag">{{ tz.flag }}</span>
                <span class="tz-name">{{ tz.name }}</span>
                <span class="tz-offset">{{ getTimeDiffForTz(tz.tz) }}</span>
                <span v-if="isCityAdded(tz.tz)" class="tz-added">已添加</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface City {
  id: string
  name: string
  flag: string
  tz: string
  timezone: string
  preset?: boolean
}

const PRESET_CITIES: City[] = [
  { id: 'beijing', name: '北京', flag: '🇨🇳', tz: 'Asia/Shanghai', timezone: 'UTC+8', preset: true },
  { id: 'new-york', name: '纽约', flag: '🇺🇸', tz: 'America/New_York', timezone: 'EST/EDT', preset: true },
  { id: 'london', name: '伦敦', flag: '🇬🇧', tz: 'Europe/London', timezone: 'GMT/BST', preset: true },
  { id: 'tokyo', name: '东京', flag: '🇯🇵', tz: 'Asia/Tokyo', timezone: 'UTC+9', preset: true },
  { id: 'singapore', name: '新加坡', flag: '🇸🇬', tz: 'Asia/Singapore', timezone: 'UTC+8', preset: true },
]

const ALL_TIMEZONES = [
  { id: 'los-angeles', name: '洛杉矶', flag: '🇺🇸', tz: 'America/Los_Angeles' },
  { id: 'chicago', name: '芝加哥', flag: '🇺🇸', tz: 'America/Chicago' },
  { id: 'toronto', name: '多伦多', flag: '🇨🇦', tz: 'America/Toronto' },
  { id: 'sao-paulo', name: '圣保罗', flag: '🇧🇷', tz: 'America/Sao_Paulo' },
  { id: 'paris', name: '巴黎', flag: '🇫🇷', tz: 'Europe/Paris' },
  { id: 'berlin', name: '柏林', flag: '🇩🇪', tz: 'Europe/Berlin' },
  { id: 'moscow', name: '莫斯科', flag: '🇷🇺', tz: 'Europe/Moscow' },
  { id: 'dubai', name: '迪拜', flag: '🇦🇪', tz: 'Asia/Dubai' },
  { id: 'mumbai', name: '孟买', flag: '🇮🇳', tz: 'Asia/Kolkata' },
  { id: 'hong-kong', name: '香港', flag: '🇭🇰', tz: 'Asia/Hong_Kong' },
  { id: 'seoul', name: '首尔', flag: '🇰🇷', tz: 'Asia/Seoul' },
  { id: 'sydney', name: '悉尼', flag: '🇦🇺', tz: 'Australia/Sydney' },
  { id: 'auckland', name: '奥克兰', flag: '🇳🇿', tz: 'Pacific/Auckland' },
  { id: 'johannesburg', name: '约翰内斯堡', flag: '🇿🇦', tz: 'Africa/Johannesburg' },
  { id: 'cairo', name: '开罗', flag: '🇪🇬', tz: 'Africa/Cairo' },
  { id: 'istanbul', name: '伊斯坦布尔', flag: '🇹🇷', tz: 'Europe/Istanbul' },
  { id: 'bangkok', name: '曼谷', flag: '🇹🇭', tz: 'Asia/Bangkok' },
  { id: 'jakarta', name: '雅加达', flag: '🇮🇩', tz: 'Asia/Jakarta' },
  { id: 'kuala-lumpur', name: '吉隆坡', flag: '🇲🇾', tz: 'Asia/Kuala_Lumpur' },
  { id: 'taipei', name: '台北', flag: '🇹🇼', tz: 'Asia/Taipei' },
]

const now = ref(new Date())
const showAddModal = ref(false)
const searchQuery = ref('')

const customCities = ref<City[]>(
  JSON.parse(localStorage.getItem('clock-custom-cities') || '[]')
)

const activeCities = computed(() => [...PRESET_CITIES, ...customCities.value])

const filteredTimezones = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return ALL_TIMEZONES.filter(tz =>
    tz.name.toLowerCase().includes(q) || tz.tz.toLowerCase().includes(q)
  )
})

function isCityAdded(tz: string) {
  return activeCities.value.some(c => c.tz === tz)
}

function getCityTime(tz: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now.value)
}

function getCityDate(tz: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(now.value)
}

function getTimeDiff(tz: string) {
  const beijingOffset = getOffsetMinutes('Asia/Shanghai')
  const cityOffset = getOffsetMinutes(tz)
  const diff = cityOffset - beijingOffset
  const hours = Math.floor(Math.abs(diff) / 60)
  const mins = Math.abs(diff) % 60
  const sign = diff >= 0 ? '+' : '-'
  if (mins === 0) return `与北京时差 ${sign}${hours}h`
  return `与北京时差 ${sign}${hours}h${mins}m`
}

function getTimeDiffForTz(tz: string) {
  const beijingOffset = getOffsetMinutes('Asia/Shanghai')
  const cityOffset = getOffsetMinutes(tz)
  const diff = cityOffset - beijingOffset
  const hours = Math.floor(Math.abs(diff) / 60)
  const mins = Math.abs(diff) % 60
  const sign = diff >= 0 ? '+' : '-'
  if (mins === 0) return `${sign}${hours}h`
  return `${sign}${hours}h${mins}m`
}

function getOffsetMinutes(tz: string): number {
  const date = now.value
  const utcStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const tzStr = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const toObj = (parts: Intl.DateTimeFormatPart[]) => {
    const o: Record<string, number> = {}
    parts.forEach(p => { if (p.type !== 'literal') o[p.type] = parseInt(p.value) })
    return o
  }

  const u = toObj(utcStr)
  const t = toObj(tzStr)

  const uMs = Date.UTC(u.year, u.month - 1, u.day, u.hour, u.minute)
  const tMs = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute)

  return Math.round((tMs - uMs) / 60000)
}

// US Market open: Beijing 21:30 - next day 04:00
const isUSMarketOpen = computed(() => {
  const bjParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now.value)
  const h = parseInt(bjParts.find(p => p.type === 'hour')!.value)
  const m = parseInt(bjParts.find(p => p.type === 'minute')!.value)
  const totalMin = h * 60 + m
  // 21:30 = 1290, 04:00 next day = 240 (wrap around midnight)
  return totalMin >= 1290 || totalMin < 240
})

function addCity(tz: { id: string; name: string; flag: string; tz: string }) {
  if (isCityAdded(tz.tz)) return
  const city: City = {
    id: tz.id,
    name: tz.name,
    flag: tz.flag,
    tz: tz.tz,
    timezone: tz.tz.split('/')[1]?.replace('_', ' ') || tz.tz,
  }
  customCities.value.push(city)
  localStorage.setItem('clock-custom-cities', JSON.stringify(customCities.value))
  showAddModal.value = false
  searchQuery.value = ''
}

function removeCity(id: string) {
  customCities.value = customCities.value.filter(c => c.id !== id)
  localStorage.setItem('clock-custom-cities', JSON.stringify(customCities.value))
}

let timer: ReturnType<typeof setInterval>
onMounted(() => { timer = setInterval(() => { now.value = new Date() }, 1000) })
onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
.page { max-width: 1400px; }

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

.us-market-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
}

.us-market-banner.open {
  background: var(--green-glow);
  color: var(--green);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.us-market-banner.closed {
  background: rgba(85, 85, 112, 0.15);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.clocks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.clock-card {
  padding: 20px;
  position: relative;
}

.clock-card.beijing-card {
  border-color: rgba(99, 102, 241, 0.3);
  background: linear-gradient(135deg, var(--bg-card), rgba(99, 102, 241, 0.05));
}

.clock-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.city-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.city-flag {
  font-size: 24px;
}

.city-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.city-tz {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.btn-remove {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.btn-remove:hover {
  background: var(--red-glow);
  color: var(--red);
  border-color: rgba(239, 68, 68, 0.3);
}

.clock-time {
  font-size: 42px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 6px;
}

.clock-date {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 14px;
}

.clock-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.time-diff {
  font-size: 12px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.time-diff.highlight {
  color: var(--accent-light);
}

.market-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.market-tag.open {
  background: var(--green-glow);
  color: var(--green);
}

.market-tag.closed {
  background: rgba(85, 85, 112, 0.2);
  color: var(--text-muted);
}

.add-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  border-style: dashed;
  min-height: 200px;
  transition: all 0.2s;
}

.add-card:hover {
  border-color: var(--accent);
  background: var(--accent-glow);
}

.add-icon {
  font-size: 32px;
  color: var(--text-muted);
  transition: color 0.2s;
}

.add-card:hover .add-icon {
  color: var(--accent-light);
}

.add-text {
  font-size: 13px;
  color: var(--text-muted);
  transition: color 0.2s;
}

.add-card:hover .add-text {
  color: var(--accent-light);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.tz-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tz-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.tz-item:hover:not(.disabled) {
  background: var(--bg-card-hover);
}

.tz-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tz-flag {
  font-size: 18px;
  width: 24px;
}

.tz-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-primary);
}

.tz-offset {
  font-size: 12px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
  min-width: 40px;
  text-align: right;
}

.tz-added {
  font-size: 11px;
  color: var(--accent-light);
  background: var(--accent-glow);
  padding: 2px 8px;
  border-radius: 4px;
}
</style>
