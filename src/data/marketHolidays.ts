// US Stock Market Holidays (NYSE) 2025-2026
// Source: NYSE holiday schedule

export interface Holiday {
  date: string // YYYY-MM-DD
  name: string
  nameZh: string
}

export const US_MARKET_HOLIDAYS: Holiday[] = [
  // 2025
  { date: '2025-01-01', name: "New Year's Day", nameZh: '元旦' },
  { date: '2025-01-20', name: 'Martin Luther King Jr. Day', nameZh: '马丁·路德·金纪念日' },
  { date: '2025-02-17', name: "Presidents' Day", nameZh: '总统日' },
  { date: '2025-04-18', name: 'Good Friday', nameZh: '耶稣受难日' },
  { date: '2025-05-26', name: 'Memorial Day', nameZh: '阵亡将士纪念日' },
  { date: '2025-06-19', name: 'Juneteenth', nameZh: '六月节' },
  { date: '2025-07-04', name: 'Independence Day', nameZh: '独立日' },
  { date: '2025-09-01', name: 'Labor Day', nameZh: '劳工节' },
  { date: '2025-11-27', name: 'Thanksgiving Day', nameZh: '感恩节' },
  { date: '2025-12-25', name: 'Christmas Day', nameZh: '圣诞节' },

  // 2026
  { date: '2026-01-01', name: "New Year's Day", nameZh: '元旦' },
  { date: '2026-01-19', name: 'Martin Luther King Jr. Day', nameZh: '马丁·路德·金纪念日' },
  { date: '2026-02-16', name: "Presidents' Day", nameZh: '总统日' },
  { date: '2026-04-03', name: 'Good Friday', nameZh: '耶稣受难日' },
  { date: '2026-05-25', name: 'Memorial Day', nameZh: '阵亡将士纪念日' },
  { date: '2026-06-19', name: 'Juneteenth', nameZh: '六月节' },
  { date: '2026-07-03', name: 'Independence Day (observed)', nameZh: '独立日（补休）' },
  { date: '2026-09-07', name: 'Labor Day', nameZh: '劳工节' },
  { date: '2026-11-26', name: 'Thanksgiving Day', nameZh: '感恩节' },
  { date: '2026-12-25', name: 'Christmas Day', nameZh: '圣诞节' },
]

export function isMarketHoliday(dateStr: string): Holiday | undefined {
  return US_MARKET_HOLIDAYS.find(h => h.date === dateStr)
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

export function isMarketClosed(dateStr: string, date: Date): boolean {
  return isWeekend(date) || !!isMarketHoliday(dateStr)
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getNextTradingDay(from: Date): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  while (true) {
    const key = formatDateKey(d)
    if (!isMarketClosed(key, d)) return d
    d.setDate(d.getDate() + 1)
  }
}

export function getNextHoliday(from: Date): Holiday | null {
  const fromKey = formatDateKey(from)
  const future = US_MARKET_HOLIDAYS
    .filter(h => h.date > fromKey)
    .sort((a, b) => a.date.localeCompare(b.date))
  return future[0] || null
}
