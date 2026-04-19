import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/world-clock',
  },
  {
    path: '/world-clock',
    name: 'WorldClock',
    component: () => import('@/views/WorldClock.vue'),
  },
  {
    path: '/countdown',
    name: 'Countdown',
    component: () => import('@/views/Countdown.vue'),
  },
  {
    path: '/alarm',
    name: 'Alarm',
    component: () => import('@/views/Alarm.vue'),
  },
  {
    path: '/stopwatch',
    name: 'Stopwatch',
    component: () => import('@/views/Stopwatch.vue'),
  },
  {
    path: '/market-calendar',
    name: 'MarketCalendar',
    component: () => import('@/views/MarketCalendar.vue'),
  },
  {
    path: '/market-status',
    name: 'MarketStatus',
    component: () => import('@/views/MarketStatus.vue'),
  },
]

const router = createRouter({
  history: createWebHashHistory('/clock-tools/'),
  routes,
})

export default router
