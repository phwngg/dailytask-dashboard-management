export function payrollBreakdown(row) {
  try {
    const items = JSON.parse(row?.breakdown || '[]')
    return Array.isArray(items) ? items : []
  } catch {
    return []
  }
}
