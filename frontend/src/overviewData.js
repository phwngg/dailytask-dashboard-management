export const vietnamDate = value => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))
export function dateWindow(now = new Date()) {
  const today = vietnamDate(now)
  const day = new Date(today+'T00:00:00Z')
  const offset = (day.getUTCDay()+6)%7
  const add = n => new Date(day.getTime()+n*86400000).toISOString().slice(0,10)
  return {today, through:add(6), monday:add(-offset), sunday:add(6-offset)}
}
export function matchesTask(task, view, dates) {
  const open = task.status !== 'done'
  if(view==='overdue') return open && Boolean(task.due_date) && task.due_date < dates.today
  if(view==='today') return open && task.due_date===dates.today
  if(view==='week') { const completed = task.done_at && !Number.isNaN(Date.parse(task.done_at)) ? vietnamDate(task.done_at) : ''; return !open && completed>=dates.monday && completed<=dates.sunday }
  if(view==='dueweek') return Boolean(task.due_date) && task.due_date>=dates.monday && task.due_date<=dates.sunday
  if(view==='open') return open
  return !view || task.status===view
}
export function priorityTasks(tasks, dates) {
  const rank = t => matchesTask(t,'overdue',dates)?0:matchesTask(t,'today',dates)?1:2
  const priority = {Cao:0,'Vừa':1,'Thấp':2}
  return tasks.filter(t=>t.status!=='done').sort((a,b)=>rank(a)-rank(b)||(priority[a.priority]??1)-(priority[b.priority]??1)||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.id.localeCompare(b.id))
}

export const formatVietnamDate = value => {
  if (!value) return 'Chưa có ngày'
  const date = new Date(`${value}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(date)
}
