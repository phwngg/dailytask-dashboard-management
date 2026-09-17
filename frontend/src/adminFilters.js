export function filterAdminUsers(users, { status = 'all', member = 'all', position = 'all', role = 'all', query = '' } = {}) {
  const needle = query.trim().toLocaleLowerCase('vi')
  return users.filter(user =>
    (status === 'all' || (status === 'active' ? user.active !== false : user.active === false)) &&
    (member === 'all' || user.email === member) &&
    (position === 'all' || (position === '__empty__' ? !user.position?.trim() : user.position?.trim() === position)) &&
    (role === 'all' || user.role === role) &&
    (!needle || [user.name, user.email].some(value => String(value || '').toLocaleLowerCase('vi').includes(needle)))
  )
}
