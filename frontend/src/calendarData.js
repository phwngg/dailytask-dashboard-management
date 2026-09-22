export function calendarMonths(today, span = 12) {
  const [year, month] = today.split('-').map(Number)
  return Array.from({length: span * 2 + 1}, (_, index) => {
    const first = new Date(Date.UTC(year, month - 1 + index - span, 1))
    const monthYear = first.getUTCFullYear()
    const monthNumber = first.getUTCMonth() + 1
    const key = `${monthYear}-${String(monthNumber).padStart(2, '0')}`
    const count = new Date(Date.UTC(monthYear, monthNumber, 0)).getUTCDate()
    const offset = (first.getUTCDay() + 6) % 7
    const days = Array(offset).fill(null)
    for (let day = 1; day <= count; day++) days.push(`${key}-${String(day).padStart(2, '0')}`)
    while (days.length < 42) days.push(null)
    return {
      key,
      label: new Intl.DateTimeFormat('vi-VN', {month: 'long', year: 'numeric', timeZone: 'UTC'}).format(first),
      days,
    }
  })
}
