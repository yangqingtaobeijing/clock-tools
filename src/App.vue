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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const navItems = [
  { path: '/world-clock', icon: '🌍', label: '世界时钟', sub: 'World Clock' },
  { path: '/countdown', icon: '⏳', label: '倒计时', sub: 'Countdown' },
  { path: '/alarm', icon: '🔔', label: '闹钟', sub: 'Alarm' },
  { path: '/stopwatch', icon: '🏁', label: '秒表', sub: 'Stopwatch' },
  { path: '/market-calendar', icon: '📅', label: '美股日历', sub: 'Market Calendar' },
  { path: '/market-status', icon: '📊', label: '市场状态', sub: 'Market Status' },
]

const beijingTime = ref('')

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

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})
onUnmounted(() => clearInterval(timer))
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

.main-content {
  flex: 1;
  margin-left: 220px;
  min-height: 100vh;
  padding: 32px;
  overflow-x: hidden;
}
</style>
