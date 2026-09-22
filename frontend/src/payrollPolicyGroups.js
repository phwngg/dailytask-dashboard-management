export function payrollPolicyGroups(policies, payrollRows) {
  const snapshots = new Map((Array.isArray(payrollRows) ? payrollRows : []).map(row => [row.email.toLowerCase(), row]))
  const groups = new Map()

  for (const policy of Array.isArray(policies) ? policies : []) {
    const email = policy.email.toLowerCase()
    if (!groups.has(email)) {
      const snapshot = snapshots.get(email)
      let breakdown = []
      try {
        const parsed = JSON.parse(snapshot?.breakdown || '[]')
        breakdown = Array.isArray(parsed) ? parsed : []
      } catch {}
      groups.set(email, {
        email: policy.email,
        name: policy.user_name || policy.email,
        total: snapshot ? Number(snapshot.total || 0) : null,
        policies: [],
        breakdown: new Map(breakdown.map(item => [item.code, item])),
      })
    }
    groups.get(email).policies.push(policy)
  }

  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}
