import { dateWindow } from './overviewData.js'
import { WorkOverview, WorkTasks, WorkCalendar, PlanDetails } from './WorkPages.jsx'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pancakeTopPosts } from './pancakeTopPosts.js'
import { filterAdminUsers } from './adminFilters.js'
import { payrollBreakdown } from './payrollPolicyDetails.js'

const nav = [
  ['overview', 'Tổng quan', '◫'],
  ['plan', 'Kế hoạch', '▤'],
  ['tasks', 'Checklist', '✓'],
  ['shifts', 'Lịch làm việc', '▦'],
  ['calendar', 'Lịch quay & họp', '◷'],
  ['payroll', 'Lương thưởng', '◉'],
  ['channels', 'Chỉ số kênh', '⌁'],
  ['admin', 'Quản trị', '⚙'],
]

const demo = import.meta.env.DEV ? {
  me: { email: 'admin@example.com', name: 'Minh Anh', initials: 'MA', role: 'admin', color: '#7657e8', isAdmin: true, isLeader: true, caps: ['plan.view','plan.edit','plan.manage','checklist.viewAll','shifts.viewAll','shifts.manage','payroll.viewAll','users.manage','channel.view'] },
  users: [
    { email: 'admin@example.com', name: 'Minh Anh', initials: 'MA', role: 'admin', color: '#7657e8' },
    { email: 'an@example.com', name: 'Ngọc An', initials: 'NA', role: 'staff', color: '#ff9566' },
    { email: 'bao@example.com', name: 'Gia Bảo', initials: 'GB', role: 'staff', color: '#49b7a7' },
    { email: 'chi@example.com', name: 'Khánh Chi', initials: 'KC', role: 'staff', color: '#6e9ee8' },
  ],
  tasks: [
    { id:'t1', title:'Hoàn thiện nội dung tuần 38', assignee:'an@example.com', due:'Hôm nay · 16:00', priority:'Cao', status:'doing', kpi_key:'content', qty:1 },
    { id:'t2', title:'Duyệt video giới thiệu sản phẩm', assignee:'bao@example.com', due:'Hôm nay · 17:30', priority:'Vừa', status:'todo', kpi_key:'video', qty:1 },
    { id:'t3', title:'Lên lịch bài đăng fanpage', assignee:'chi@example.com', due:'Ngày mai', priority:'Thấp', status:'todo', kpi_key:'content', qty:1 },
    { id:'t4', title:'Báo cáo hiệu suất tuần', assignee:'admin@example.com', due:'Hôm nay · 18:00', priority:'Cao', status:'done', kpi_key:'report', qty:1 },
  ],
  contentPlan: [
    { id:'p1', channel:'Daily Stories', month:'2026-09', pillar:'Behind the scenes', key:'Một ngày cùng team sáng tạo', demo_date:'2026-09-16', post_date:'2026-09-18', status:'Đang thực hiện', message:'Tạo cảm giác gần gũi với thương hiệu.', assignee:'an@example.com' },
    { id:'p2', channel:'Daily Stories', month:'2026-09', pillar:'Product', key:'3 cách dùng sản phẩm mỗi ngày', demo_date:'2026-09-17', post_date:'2026-09-20', status:'Chưa thực hiện', message:'Nhấn mạnh lợi ích thực tế.', assignee:'bao@example.com' },
    { id:'p3', channel:'Daily Ideas', month:'2026-09', pillar:'Community', key:'Câu chuyện khách hàng', demo_date:'2026-09-12', post_date:'2026-09-14', status:'Đã đăng', message:'Lan tỏa phản hồi tích cực.', assignee:'chi@example.com' },
  ],
  shiftsWeek:'2026-09-14',
  shifts:[
    {email:'admin@example.com',T2:'S',T3:'S',T4:'C',T5:'S',T6:'S',T7:'Off',CN:'Off'},
    {email:'an@example.com',T2:'S',T3:'C',T4:'S',T5:'Quay',T6:'S',T7:'Off',CN:'Off'},
    {email:'bao@example.com',T2:'C',T3:'S',T4:'S',T5:'S',T6:'Live',T7:'Off',CN:'Off'},
    {email:'chi@example.com',T2:'S',T3:'S',T4:'C',T5:'S',T6:'C',T7:'Off',CN:'Off'},
  ],
  payrollMonth:'2026-08',
  currentMonth:'2026-09',
  payroll:[
    {email:'admin@example.com',base:22000000,fees:3200000,bonus:1000000,penalty:0,total:26200000,kpi_ok:true,kpi_rate:100},
    {email:'an@example.com',base:9000000,fees:1250000,bonus:500000,penalty:0,total:10750000,kpi_ok:true,kpi_rate:92},
    {email:'bao@example.com',base:9500000,fees:980000,bonus:0,penalty:300000,total:10180000,kpi_ok:false,kpi_rate:76},
  ],
} : null

const routePaths = { overview:'/overview', plan:'/content-plan', tasks:'/tasks', shifts:'/shifts', calendar:'/calendar', payroll:'/payroll', channels:'/channels', admin:'/admin' }
const routePages = Object.fromEntries(Object.entries(routePaths).map(([page,path]) => [path,page]))
const initialPage = () => routePages[window.location.pathname] || 'overview'

const demoLogin = demo ? { ...demo } : null

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch('/api' + path, {
      credentials: 'include',
      ...options,
      signal: options.signal || controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    const body = response.status === 204 ? null : await response.json()
    if (!response.ok) throw new Error(body?.error || 'Không thể xử lý yêu cầu')
    return body
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Hệ thống phản hồi quá lâu. Vui lòng thử lại.')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function Icon({ name }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></>,
  }
  return <svg viewBox="0 0 24 24" className="icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const money = n => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + ' ₫'
const initials = name => (name || '?').split(/\s+/).slice(-2).map(x => x[0]).join('').toUpperCase()
const today = new Intl.DateTimeFormat('vi-VN', { weekday:'long', day:'numeric', month:'long' }).format(new Date())

function App() {
  const [data, setData] = useState(null)
  const [overviewSummary, setOverviewSummary] = useState(null)
  const [page, setPage] = useState(initialPage)
  const [planRevision, setPlanRevision] = useState(0)
  const [routeSearch,setRouteSearch] = useState(window.location.search)
  const navigate = (key, replace = false, filters = {}) => {
    const search = new URLSearchParams(Object.entries(filters).filter(([,value])=>value!==''&&value!=null)).toString()
    const path = (routePaths[key] || routePaths.overview) + (search ? '?' + search : '')
    if (window.location.pathname + window.location.search !== path) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
      window.scrollTo(0,0)
    }
    setRouteSearch(search ? '?' + search : '')
    setPage(key in routePaths ? key : 'overview')
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [demoMode, setDemoMode] = useState(!import.meta.env.PROD && import.meta.env.VITE_DEMO === 'true')
  const [modal, setModal] = useState('')
  const [helpOpen, setHelpOpen] = useState(false)
  const [taskEditor, setTaskEditor] = useState(null)
  const [planEditor, setPlanEditor] = useState(null)
  const [query, setQuery] = useState('')
  const [adminUsers, setAdminUsers] = useState(null)
  const [adminLoading, setAdminLoading] = useState(false)

  const load = async () => {
    if (!import.meta.env.PROD && import.meta.env.VITE_DEMO === 'true') {
      setData(demo)
      setDemoMode(true)
      setLoading(false)
      return
    }
    try {
      const result = await request('/bootstrap')
      setData(result)
      setDemoMode(false)
    } catch (e) {
      if (e.message.includes('Phiên đăng nhập')) setData(null)
      else setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load().catch(()=>{}) }, [])

  useEffect(() => {
    if (!data || page !== 'overview' || demoMode) { setOverviewSummary(null); return }
    setOverviewSummary(null)
    let stale = false
    const routeQuery = new URLSearchParams(routeSearch)
    const apiQuery = new URLSearchParams()
    if (routeQuery.get('assignee')) apiQuery.set('assignee', routeQuery.get('assignee'))
    apiQuery.set('range', routeQuery.get('range') || '4w')
    request('/overview?' + apiQuery.toString())
      .then(result => { if (!stale) setOverviewSummary(result) })
      .catch(e => { if (!stale) setError(e.message) })
    return () => { stale = true }
  }, [data,page,routeSearch,demoMode])

  useEffect(() => {
    if (data && page === 'admin' && !data.me?.caps?.includes('users.manage')) navigate('overview', true)
  }, [data,page])

  const refreshAdminUsers = async () => {
    setAdminLoading(true)
    try {
      const users = demoMode
        ? (adminUsers || data?.users || []).map(user => ({ ...user, active: user.active !== false }))
        : (await request('/admin/users')).users || []
      setAdminUsers(users)
      setData(current => current ? { ...current, users: users.filter(user => user.active !== false) } : current)
      return users
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setAdminLoading(false)
    }
  }

  useEffect(() => {
    if (page === 'admin' && data?.me?.caps?.includes('users.manage')) refreshAdminUsers().catch(() => {})
  }, [page, demoMode, data?.me?.email])

  const saveAdminUser = async form => {
    setError('')
    try {
      if (demoMode) {
        const current = adminUsers || data.users || []
        const next = form.originalEmail
          ? current.map(user => user.email === form.originalEmail ? { ...user, name: form.name, position: form.position || '', role: form.role } : user)
          : [...current, { email: form.email.toLowerCase(), name: form.name, role: form.role, position: form.position || '', active: true, initials: initials(form.name), color: '#7657e8' }]
        setAdminUsers(next)
        setData(currentData => currentData ? { ...currentData, users: next.filter(user => user.active !== false) } : currentData)
        return
      }
      const { originalEmail, ...payload } = form
      await request(originalEmail ? '/admin/users/' + encodeURIComponent(originalEmail) : '/admin/users', {
        method: originalEmail ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      await refreshAdminUsers()
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  const updateAdminUser = async (email, payload) => {
    setError('')
    try {
      if (demoMode) {
        const next = (adminUsers || data.users || []).map(user => user.email === email ? { ...user, ...payload } : user)
        setAdminUsers(next)
        setData(currentData => currentData ? { ...currentData, users: next.filter(user => user.active !== false) } : currentData)
        return
      }
      await request('/admin/users/' + encodeURIComponent(email), { method: 'PATCH', body: JSON.stringify(payload) })
      await refreshAdminUsers()
    } catch (e) {
      setError(e.message)
      throw e
    }
  }

  useEffect(() => {
    const syncRoute = () => {
      setRouteSearch(window.location.search)
      const next = routePages[window.location.pathname]
      if (!next) { window.history.replaceState({}, '', routePaths.overview); setPage('overview') }
      else setPage(next)
    }
    syncRoute()
    window.addEventListener('popstate', syncRoute)
    return () => window.removeEventListener('popstate', syncRoute)
  }, [])

  const doLogin = async (email, password) => {
    setError('')
    if (demoMode) { setData(demoLogin); return }
    try {
      await request('/login', { method:'POST', body:JSON.stringify({ email, password }) })
      await load()
    } catch (e) { setError(e.message) }
  }

  const computePayroll = async () => {
    if (!window.confirm(`Tính lại sẽ thay thế snapshot payroll tháng ${data.payrollMonth} bằng dữ liệu Policy/Inputs hiện tại. Tiếp tục?`)) return
    try {
      await request('/payroll/compute', { method:'POST', body:JSON.stringify({ month:data.payrollMonth }) })
      await load()
    } catch (e) { setError(e.message) }
  }

  const connectPancake = async token => {
    setError('')
    try {
      const result = await request('/admin/pancake/connect', { method:'POST', body:JSON.stringify({ user_access_token:token }) })
      await load()
      return result
    } catch (e) { setError(e.message); throw e }
  }

  const syncPancake = async range => {
    setError('')
    try {
      const result = await request('/admin/pancake/sync', { method:'POST', body:JSON.stringify(range || {}) })
      await load()
      return result
    } catch (e) { setError(e.message); throw e }
  }

  const loadPancakeMetrics = async (from, to) => {
    const query = `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    try {
      const result = await request('/pancake/metrics' + query)
      setData(current => current ? {...current, pancakeMetrics:result.metrics || [], pancakeComparison:result.previousMetrics || [], pancakePeriod:result.period, pancakePreviousPeriod:result.previousPeriod, pancakeFrom:result.from, pancakeTo:result.to} : current)
      return result
    } catch (e) { setError(e.message); throw e }
  }

  const updatePancakeAssignment = (pageID, email) => setData(current => {
    if (!current) return current
    return {
      ...current,
      pancake: {...current.pancake, pages:(current.pancake?.pages||[]).map(page=>page.page_id===pageID?{...page,assigned_email:email,mapped:Boolean(email)}:page)},
      pancakeMetrics:(current.pancakeMetrics||[]).map(page=>page.page_id===pageID?{...page,email}:page),
    }
  })

  const mapPancakeChannel = async form => {
    setError('')
    try {
      const result = await request('/admin/channels', { method:'PUT', body:JSON.stringify(form) })
      updatePancakeAssignment(result.page_id,result.email)
      return result
    } catch (e) { setError(e.message); throw e }
  }

  const unmapPancakeChannel = async pageID => {
    setError('')
    try {
      const result = await request('/admin/pancake/pages/'+encodeURIComponent(pageID)+'/assignment', { method:'DELETE' })
      updatePancakeAssignment(result.page_id,'')
      return result
    } catch (e) { setError(e.message); throw e }
  }

  const logout = async () => {
    if (!demoMode) { try { await request('/logout', { method:'POST', body:'{}' }) } catch {} }
    setData(null)
    navigate('overview', true)
  }

  const updateTask = async (id, status) => {
    if (demoMode) {
      setData(d => ({ ...d, tasks:d.tasks.map(t => t.id === id ? { ...t, status, done_at:status==='done'?new Date().toISOString():'' } : t) }))
      return
    }
    try {
      const updated = await request('/tasks/' + encodeURIComponent(id), { method:'PATCH', body:JSON.stringify({ status }) })
      setData(current => current ? { ...current, tasks:(current.tasks || []).map(task => task.id === id ? { ...task, ...updated } : task) } : current)
    } catch (e) { setError(e.message); throw e }
  }

  const saveTask = async form => {
    const editing=Boolean(form.id)
    if (demoMode) {
      setData(d => ({ ...d, tasks:editing?d.tasks.map(t=>t.id===form.id?{...t,...form}:t):[{ id:crypto.randomUUID(), status:'todo', ...form }, ...d.tasks] }))
      setTaskEditor(null)
      setModal('')
      return
    }
    try {
      await request(editing?'/tasks/' + encodeURIComponent(form.id):'/tasks', { method:editing?'PATCH':'POST', body:JSON.stringify(form) })
      setTaskEditor(null)
      setModal('')
      await load()
    } catch (e) { setError(e.message); throw e }
  }

  const deleteTask = async id => {
    if (demoMode) {
      setData(d => ({ ...d, tasks:d.tasks.filter(t=>t.id!==id) }))
      return
    }
    try { await request('/tasks/' + encodeURIComponent(id), { method:'DELETE' }); await load() }
    catch (e) { setError(e.message); throw e }
  }

  const savePlan = async form => {
    if (demoMode) {
      setData(d => ({ ...d, contentPlan:[{ id:crypto.randomUUID(), status:'Chưa thực hiện', ...form }, ...d.contentPlan] }))
      setPlanRevision(v => v + 1)
      setModal('')
      return
    }
    try {
      await request('/plans', { method:'POST', body:JSON.stringify(form) })
      setPlanRevision(v => v + 1)
      setModal('')
      await load()
    } catch (e) { setError(e.message); throw e }
  }

  const savePlanEdit = async form => {
    if (!form.id) return savePlan(form)
    if (demoMode) {
      setData(d => ({ ...d, contentPlan:d.contentPlan.map(p=>p.id===form.id?{...p,...form}:p) }))
      setPlanEditor(null)
      setPlanRevision(v => v + 1)
      return
    }
    try {
      await request('/plans/' + encodeURIComponent(form.id), { method:'PATCH', body:JSON.stringify(form) })
      setPlanEditor(null)
      setPlanRevision(v => v + 1)
      await load()
    } catch (e) { setError(e.message); throw e }
  }

  const deletePlan = async id => {
    if (demoMode) {
      setData(d => ({ ...d, contentPlan:d.contentPlan.filter(p=>p.id!==id) }))
      setPlanRevision(v => v + 1)
      return
    }
    try { await request('/plans/' + encodeURIComponent(id), { method:'DELETE' }); setPlanRevision(v=>v+1); await load() }
    catch (e) { setError(e.message); throw e }
  }

  const reviewPlan = async (id, action, note='') => {
    const nextStatus={submit:'Chờ duyệt',approve:'Đã duyệt',request_changes:'Yêu cầu sửa',publish:'Đã đăng'}[action]
    if (demoMode) {
      setData(d => ({ ...d, contentPlan:d.contentPlan.map(p=>p.id===id?{...p,status:nextStatus,reviewed_by:d.me.email,reviewed_at:new Date().toISOString(),review_note:note,reviews:[{id:Date.now(),action,note,actor:d.me.email,actor_name:d.me.name,created_at:new Date().toISOString()},...(p.reviews||[])]}:p) }))
      setPlanRevision(v=>v+1)
      return
    }
    try { await request('/plans/' + encodeURIComponent(id) + '/review', { method:'PATCH', body:JSON.stringify({ action, note }) }); setPlanRevision(v=>v+1); await load() }
    catch (e) { setError(e.message); throw e }
  }

  if (loading) return <div className="loading-screen"><span className="loader"/><span>Đang tải DailyTask</span></div>
  if (!data && error && !error.includes('Phiên đăng nhập') && !error.includes('mật khẩu')) return <div className="loading-screen"><p role="alert">{error}</p><button onClick={()=>{setError('');setLoading(true);load().catch(()=>{})}}>Thử lại</button></div>
  if (!data) return <Login onLogin={doLogin} error={error} setDemo={() => { setDemoMode(true); setData(demo) }} />

  const current = nav.find(x => x[0] === page)?.[1] || 'Tổng quan'
  const visibleNav = nav.filter(([key]) => key !== 'admin' || data.me?.caps?.includes('users.manage'))

  return (
    <div className="app-shell min-h-screen bg-slate-50 text-slate-900">
      <aside className="sidebar">
        <button className="brand" aria-label="DailyTask — về Tổng quan" onClick={() => navigate('overview')}><span className="brand-mark">d</span><span>daily<span className="brand-light">task</span></span></button>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch" aria-label="Daily Studio — về Tổng quan" onClick={() => navigate('overview')}><span className="workspace-dot">D</span><span><b>Daily Studio</b><small>Không gian làm việc</small></span><span className="workspace-caret">⌄</span></button>
        <div className="nav-label">MENU CHÍNH</div>
        <nav className="side-nav">
          {visibleNav.map(([key,label,glyph]) => (
            <button key={key} className={'nav-item ' + (page === key ? 'active' : '')} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}>
              <span className="nav-glyph">{glyph}</span><span>{label}</span>{key === 'tasks' && <span className="nav-count">{data.tasks?.filter(t => t.status !== 'done').length || 0}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon">✦</span><b>Cần trợ giúp?</b><p>Xem hướng dẫn sử dụng DailyTask.</p><button onClick={() => setHelpOpen(true)}>Mở hướng dẫn nhanh <Icon name="chevron"/></button></div>
          <button className="profile-row" onClick={logout}><Avatar user={data.me}/><span className="profile-text"><b>{data.me?.name || 'Thành viên'}</b><small>{data.me?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</small></span><Icon name="logout"/></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><button onClick={() => navigate('overview')}>Daily Studio</button><Icon name="chevron"/><b>{current}</b></div>
          <div className="top-actions">
            <label className="search-box"><Icon name="search"/><input value={page==='plan'||page==='tasks'?new URLSearchParams(routeSearch).get('q')||'':query} onChange={e=>{if(page==='plan'||page==='tasks')navigate(page,true,{...Object.fromEntries(new URLSearchParams(routeSearch)),q:e.target.value});else setQuery(e.target.value)}} onKeyDown={e=>{if(e.key==='Enter'&&page!=='plan'&&page!=='tasks')navigate('tasks',false,{q:query})}} placeholder="Tìm công việc, nội dung..." /><kbd>Enter</kbd></label>
            <button className="icon-button notification" aria-label="Thông báo" disabled title="Thông báo sẽ được bổ sung"><Icon name="bell"/></button>
            <span className="today-chip"><Icon name="calendar"/>{today}</span>
            <details className="account-menu">
              <summary aria-label="Mở menu tài khoản"><Avatar user={data.me}/><span className="account-caret">⌄</span></summary>
              <div className="account-popover">
                <div className="account-identity"><Avatar user={data.me}/><span><b>{data.me?.name || 'Thành viên'}</b><small>{data.me?.email}</small></span></div>
                <div className="account-role">{data.me?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</div>
                <button className="account-logout" onClick={logout}><Icon name="logout"/> Đăng xuất</button>
              </div>
            </details>
          </div>
        </header>
        {error && <button className="notice-bar" onClick={()=>setError('')}>{error}<span>×</span></button>}
        <div className="page-content">
          {page === 'overview' && <WorkOverview data={data} overview={overviewSummary} go={navigate} params={new URLSearchParams(routeSearch)} onAdd={()=>setModal('task')} onStatus={updateTask}/>}
          {page === 'plan' && <PlanPage routeSearch={routeSearch} go={navigate} data={data} onAdd={()=>setModal('plan')} onEdit={plan=>setPlanEditor(plan)} onDelete={deletePlan} onReview={reviewPlan} demoMode={demoMode} refreshKey={planRevision}/>}
          {page === 'tasks' && <WorkTasks data={data} go={navigate} params={new URLSearchParams(routeSearch)} onAdd={()=>setModal('task')} onStatus={updateTask} onEdit={task=>setTaskEditor(task)} onDelete={deleteTask}/>}
          {page === 'shifts' && <ShiftPage data={data}/> }
          {page === 'calendar' && <WorkCalendar data={data} go={navigate} params={new URLSearchParams(routeSearch)}/>}
          {page === 'payroll' && <PayrollPage data={data} onCompute={computePayroll} demo={demoMode}/>}
          {page === 'channels' && <ChannelPage data={data} demo={demoMode} onConnect={connectPancake} onSync={syncPancake} onLoadMetrics={loadPancakeMetrics} onMap={mapPancakeChannel} onUnmap={unmapPancakeChannel}/>}
          {page === 'admin' && <AdminPage data={data} users={adminUsers || data.users || []} loading={adminLoading} onRefresh={refreshAdminUsers} onSave={saveAdminUser} onUpdate={updateAdminUser}/>}
        </div>
      </main>
      {modal === 'task' && <TaskModal initialAssignee={new URLSearchParams(routeSearch).get('assignee')} users={data.users || []} me={data.me} onClose={()=>setModal('')} onSave={saveTask}/>}
      {modal === 'plan' && <PlanModal channels={[...new Set((data.contentPlan || []).map(p => (p.channel || '').trim()).filter(Boolean))]} users={data.users || []} me={data.me} onClose={()=>setModal('')} onSave={savePlan}/>} {helpOpen && <HelpModal onClose={()=>setHelpOpen(false)}/>}{taskEditor && <TaskModal task={taskEditor} users={data.users || []} me={data.me} onClose={()=>setTaskEditor(null)} onSave={saveTask}/>}{planEditor && <PlanModal plan={planEditor} channels={[...new Set((data.contentPlan || []).map(p => (p.channel || '').trim()).filter(Boolean))]} users={data.users || []} me={data.me} onClose={()=>setPlanEditor(null)} onSave={savePlanEdit}/>}
    </div>
  )
}

function HelpModal({onClose}) {
  return <Modal title="Hướng dẫn nhanh" onClose={onClose}><div className="quick-help"><p>Bắt đầu từ Tổng quan để xem việc cần xử lý trong ngày.</p><ol><li>Bấm một thẻ chỉ số để mở đúng danh sách đã lọc.</li><li>Chọn thành viên để xem riêng phạm vi công việc.</li><li>Bấm tên công việc hoặc nội dung để xem chi tiết.</li><li>Dùng Bắt đầu, Hoàn thành hoặc Gửi duyệt để cập nhật trạng thái.</li></ol><div className="modal-actions"><button className="primary-button" onClick={onClose}>Đã hiểu</button></div></div></Modal>
}

function Login({ onLogin, error, setDemo }) {
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [forgotMessage,setForgotMessage] = useState('')
  return <div className="login-shell">
    <section className="login-visual">
      <div className="login-brand"><span className="brand-mark">d</span> daily<span className="brand-light">task</span></div>
      <div className="login-copy"><span className="eyebrow light">TEAM WORKSPACE</span><h1>Đưa mọi kế hoạch<br/>về đúng quỹ đạo.</h1><p>Một không gian gọn gàng để đội ngũ cùng tập trung, phối hợp và hoàn thành công việc.</p><div className="login-art"><div className="art-card art-back"><span className="art-mini-dot"/> Daily Studio <b>TEAM</b></div><div className="art-card art-front"><span className="art-check">✓</span><span><b>Công việc và kế hoạch</b><small>Theo dõi tiến độ mỗi ngày</small></span><span className="art-spark">✦</span></div><div className="art-orb"/></div></div>
      <div className="login-foot">© 2026 DailyTask <span>•</span> Làm việc cùng nhau, tốt hơn mỗi ngày.</div>
    </section>
    <section className="login-form-wrap"><div className="login-form">
      <span className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</span><h2>Đăng nhập</h2><p className="muted">Nhập thông tin tài khoản để vào workspace.</p>
      <form onSubmit={e=>{e.preventDefault();onLogin(email,password)}}>
        <label>Email hoặc tên đăng nhập<input autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ten@congty.vn" required/></label>
        <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nhập mật khẩu" required/></label>
        <div className="form-meta"><label className="checkline"><input type="checkbox"/> Ghi nhớ đăng nhập</label><button type="button" className="text-button" onClick={()=>setForgotMessage('Hãy liên hệ quản trị viên để cấp lại mật khẩu.')}>Quên mật khẩu?</button></div>
        {forgotMessage && <div className="form-help">{forgotMessage}</div>}
        {error && <div className="form-error">{error}</div>}
        <button className="primary-button w-full" type="submit">Đăng nhập <Icon name="arrow"/></button>
      </form>
      {!import.meta.env.PROD && import.meta.env.VITE_DEMO !== 'true' && <button className="demo-link" onClick={setDemo}>Xem giao diện demo</button>}
      <p className="login-terms">Bằng việc tiếp tục, bạn đồng ý với <a>Điều khoản sử dụng</a> và <a>Chính sách bảo mật</a>.</p>
    </div></section>
  </div>
}

function Avatar({user}) { return <span className="avatar" style={{background:user?.color || '#7657e8'}}>{user?.initials || initials(user?.name)}</span> }
function PageHeading({eyebrow,title,description,action}) { return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function Metric({label,value,delta,color,icon}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><i className={'metric-icon '+color}>{icon}</i></div><div className="metric-value">{value}</div>{delta && <div className="metric-foot"><span className={typeof delta==='object'?delta.tone:''}>{typeof delta==='object'?delta.text:delta}</span></div>}</div> }

function Status({value}) {
  const cls=value==='Đã đăng'||value==='Đã duyệt'||value==='done'?'success':value==='Đang thực hiện'||value==='doing'?'warning':value==='Đã khóa'||value==='Yêu cầu sửa'?'danger':value==='Chưa thực hiện'||value==='todo'?'neutral':'info'
  return <span className={'status '+cls}><i/>{value||'Chưa thực hiện'}</span>
}

function formatPlanDate(value) {
  if (!value) return 'Chưa có lịch đăng'
  const date = new Date(`${value}T00:00:00+07:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', {day:'numeric', month:'short', timeZone:'Asia/Ho_Chi_Minh'}).format(date)
}

function groupPlanItems(items) {
  const today = dateWindow().today
  const groups = new Map()
  for (const plan of items) {
    const key = (plan.channel || '').trim()
    const group = groups.get(key) || {key, name:key || 'Chưa gán Kênh', total:0, upcoming:0, overdue:0, next_post:'', by_status:{}, assignees:[]}
    const status = plan.status || 'Chưa thực hiện'
    group.total++
    group.by_status[status] = (group.by_status[status] || 0) + 1
    if (plan.assignee && !group.assignees.includes(plan.assignee)) group.assignees.push(plan.assignee)
    if (status !== 'Đã đăng' && plan.post_date) {
      if (plan.post_date < today) group.overdue++
      else { group.upcoming++; if (!group.next_post || plan.post_date < group.next_post) group.next_post = plan.post_date }
    }
    groups.set(key, group)
  }
  return [...groups.values()].sort((a,b) => (a.next_post ? 0 : 1) - (b.next_post ? 0 : 1) || (a.next_post || '').localeCompare(b.next_post || '') || b.total - a.total || a.name.localeCompare(b.name))
}

function PlanChannelDialog({channelName,group,items,total,loading,loadingMore,hasMore,loadMore,sentinel,loadError,personName,onClose,onSelectPlan,onClearFilters,filters,setFilters,query,onQueryChange,users,statuses,publicationFilter,onPublicationFilter}) {
  const byStatus = group?.by_status || {}
  const filter = (key,value) => setFilters(current => ({...current,[key]:value}))
  return <Modal title={`Chi tiết Kênh · ${channelName}`} className="plan-channel-modal" onClose={onClose} portal>
    <div className="plan-channel-modal-summary"><div className="plan-channel-detail-title"><i className="channel-card-icon">{channelName[0]||'K'}</i><div><span className="eyebrow">KẾ HOẠCH NỘI DUNG</span><h3>{channelName}</h3><p>{group?.total||total} nội dung trong bộ lọc hiện tại</p></div></div><div className="plan-channel-detail-stats"><span><b>{group?.upcoming||0}</b>Sắp đăng</span><span><b>{group?.overdue||0}</b>Đang trễ</span><span><b>{byStatus['Đã đăng']||0}</b>Đã đăng</span></div></div>
    <div className="plan-channel-modal-list"><div className="table-toolbar plan-channel-inline-toolbar"><h3>Nội dung trong Kênh <small>{items.length} / {total}</small></h3><div className="plan-channel-inline-filters"><input type="search" value={query} onChange={e=>onQueryChange(e.target.value)} placeholder="Tìm nội dung…" aria-label="Tìm nội dung"/><select value={publicationFilter} onChange={e=>onPublicationFilter(e.target.value)} aria-label="Trạng thái xuất bản"><option value="">Tất cả bài</option><option value="unpublished">Chưa đăng</option><option value="overdue">Đang trễ</option></select><input type="date" value={filters.from} onChange={e=>filter('from',e.target.value)} aria-label="Ngày đăng từ"/><input type="date" value={filters.to} onChange={e=>filter('to',e.target.value)} aria-label="Đến ngày đăng"/><select value={filters.assignee} onChange={e=>filter('assignee',e.target.value)} aria-label="Người phụ trách"><option value="">Tất cả phụ trách</option>{users.map(user=><option key={user.email} value={user.email}>{user.name}</option>)}</select><select value={filters.status} onChange={e=>filter('status',e.target.value)} aria-label="Trạng thái nội dung"><option value="">Tất cả trạng thái</option>{statuses.map(status=><option key={status} value={status}>{status}</option>)}</select><button type="button" className="text-button plan-inline-clear" onClick={onClearFilters}>Xóa lọc</button></div></div>
      <div className="simple-table plan-table plan-channel-detail-table"><div className="table-head"><span>CONTENT PILLAR / KEY</span><span>NGÀY ĐĂNG</span><span>PHỤ TRÁCH</span><span>TRẠNG THÁI</span></div>{items.map(p=><div className="table-row" key={p.id}><span className="plan-title"><button className="work-title" onClick={()=>onSelectPlan(p.id)}>{p.pillar||'Nội dung'}</button><small>{p.key}</small></span><span>{p.post_date||'—'}</span><span>{personName(p.assignee)}</span><Status value={p.status}/></div>)}{!items.length&&!loading&&<div className="plan-empty">{loadError?'Không tải được nội dung.':'Kênh này chưa có nội dung phù hợp.'}</div>}{loading&&!items.length&&<div className="plan-empty">Đang tải nội dung của Kênh…</div>}</div>
      {loadError&&<div className="plan-load-error">{loadError}</div>}
      {hasMore&&<div ref={sentinel} className="plan-load-trigger" aria-live="polite">{loadingMore?'Đang tải thêm nội dung…':<button className="secondary-button" onClick={loadMore}>Tải thêm</button>}</div>}
      {!hasMore&&items.length>0&&<div className="plan-end-note">Đã hiển thị hết {total} nội dung phù hợp.</div>}
    </div>
    <div className="plan-channel-modal-footer"><button className="text-button" onClick={onClose}>← Tất cả Kênh</button></div>
  </Modal>
}

function PlanPage({data,onAdd,onEdit,onDelete,onReview,demoMode,refreshKey,routeSearch,go}) {
  const routeParams = new URLSearchParams(routeSearch)
  const filters = Object.fromEntries(['channel','from','to','assignee','status','unpublished','overdue','id'].map(key=>[key,routeParams.get(key)||'']))
  const query = routeParams.get('q')||''
  const view = routeParams.get('view') || (filters.channel ? 'detail' : 'channels')
  const channelView = view === 'channels'
  const detailView = view === 'detail' && Boolean(filters.channel)
  const listView = view === 'list'
  const onQueryChange = q => go('plan',true,{...filters,q,view})
  const setFilters = update => { const next=typeof update==='function'?update(filters):update; go('plan',false,{...next,q:query,view:next.view||view}) }
  const [debouncedQuery,setDebouncedQuery] = useState(query)
  const [items,setItems] = useState([])
  const [groups,setGroups] = useState([])
  const [channels,setChannels] = useState([...new Set((data.contentPlan||[]).map(p=>p.channel).filter(Boolean))])
  const [statuses,setStatuses] = useState([...new Set((data.contentPlan||[]).map(p=>p.status).filter(Boolean))])
  const [stats,setStats] = useState({total:0,published:0,in_progress:0,planned:0})
  const [total,setTotal] = useState(0)
  const [nextCursor,setNextCursor] = useState(null)
  const [hasMore,setHasMore] = useState(false)
  const [loading,setLoading] = useState(true)
  const [loadingMore,setLoadingMore] = useState(false)
  const [loadError,setLoadError] = useState('')
  const sentinel = useRef(null)
  const generation = useRef(0)
  const requestLock = useRef(false)
  const params = new URLSearchParams({limit:'40',view})
  if (channelView) params.set('groupsOnly','1')
  if (debouncedQuery.trim()) params.set('q',debouncedQuery.trim())
  for (const [key,value] of Object.entries(filters)) if (value) params.set(key,value)
  const filterKey = params.toString()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 250)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    const current = ++generation.current
    requestLock.current = false
    setLoading(true)
    setLoadingMore(false)
    setItems([])
    setGroups([])
    setTotal(0)
    setStats({total:0,published:0,in_progress:0,planned:0})
    setHasMore(false)
    setNextCursor(null)
    setLoadError('')
    const loadFirst = async () => {
      try {
        let result
        if (demoMode) {
          const q = (params.get('q')||'').toLowerCase()
          const filtered = (data.contentPlan||[]).filter(p => {
            const content = [p.key,p.pillar,p.message].join(' ').toLowerCase()
            return (!q || content.includes(q)) && (!filters.channel || (filters.channel==='__empty' ? !(p.channel||'').trim() : (p.channel||'').trim()===filters.channel)) && (!filters.from || p.post_date>=filters.from) && (!filters.to || p.post_date<=filters.to) && (!filters.assignee || p.assignee===filters.assignee) && (!filters.status || p.status===filters.status) && (!filters.id || p.id===filters.id) && (!filters.unpublished || p.status!=='Đã đăng') && (!filters.overdue || (p.status!=='Đã đăng' && p.post_date && p.post_date<dateWindow().today))
          })
          result = {items:channelView?[]:filtered.slice(0,40),groups:groupPlanItems(filtered),total:filtered.length,channels:[...new Set((data.contentPlan||[]).map(p=>(p.channel||'').trim()).filter(Boolean))],statuses:[...new Set((data.contentPlan||[]).map(p=>p.status).filter(Boolean))],hasMore:false,stats:{total:filtered.length,published:filtered.filter(p=>p.status==='Đã đăng').length,in_progress:filtered.filter(p=>p.status==='Đang thực hiện').length,planned:filtered.filter(p=>p.status==='Chưa thực hiện').length,by_status:Object.fromEntries([...new Set(filtered.map(p=>p.status))].map(status=>[status,filtered.filter(p=>p.status===status).length]))}}
        } else result = await request('/plans?'+filterKey)
        if (current !== generation.current) return
        setItems(result.items||[])
        setGroups(result.groups||groupPlanItems(result.items||[]))
        setTotal(result.total||0)
        setStats(result.stats||{total:0,published:0,in_progress:0,planned:0,by_status:{}})
        setChannels(result.channels||[])
        setStatuses(result.statuses||[])
        setHasMore(Boolean(result.hasMore))
        setNextCursor(result.nextCursor||null)
      } catch (e) {
        if (current === generation.current) setLoadError(e.message)
      } finally {
        if (current === generation.current) setLoading(false)
      }
    }
    loadFirst()
    return () => { generation.current++ }
  }, [filterKey,demoMode,refreshKey])

  const loadMore = async () => {
    if (!hasMore || loading || loadingMore || requestLock.current || !nextCursor) return
    requestLock.current = true
    const current = generation.current
    setLoadingMore(true)
    const pageParams = new URLSearchParams(filterKey)
    pageParams.set('cursorDate',nextCursor.date)
    pageParams.set('cursorID',nextCursor.id)
    try {
      const result = await request('/plans?'+pageParams.toString())
      if (current === generation.current) {
        setItems(rows => [...rows,...(result.items||[])])
        setHasMore(Boolean(result.hasMore))
        setNextCursor(result.nextCursor||null)
      }
    } catch (e) {
      if (current === generation.current) setLoadError(e.message)
    } finally {
      if (current === generation.current) {
        requestLock.current = false
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    const node = sentinel.current
    if (!node || !hasMore || loading || loadingMore) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadMore()
    },{rootMargin:'320px'})
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMore,loading,loadingMore,filterKey,nextCursor])

  const personName = email => data.users?.find(u=>u.email===email)?.name||email||'—'
  const selectedGroup = groups.find(group => group.key === (filters.channel === '__empty' ? '' : filters.channel))
  const channelName = selectedGroup?.name || (filters.channel === '__empty' ? 'Chưa gán Kênh' : filters.channel)
  const openChannel = key => go('plan',false,{...filters,channel:key||'__empty',id:'',view:'detail',q:query})
  const backToChannels = () => go('plan',false,{...filters,channel:'',id:'',view:'channels',q:query})
  const publicationFilter = filters.overdue ? 'overdue' : (filters.unpublished ? 'unpublished' : '')
  const setPublicationFilter = value => setFilters(current => ({...current,unpublished:value==='unpublished'?'1':'',overdue:value==='overdue'?'1':''}))
  const openChannelTag = (key,update) => go('plan',false,{...filters,channel:key||'__empty',id:'',...update,view:'detail',q:query})
  const openChannelStatus = (key,status) => openChannelTag(key,{status,unpublished:'',overdue:''})
  const openChannelOverdue = key => openChannelTag(key,{status:'',unpublished:'',overdue:'1'})
  const statusChips = [['Chưa thực hiện','Chưa thực hiện'],['Đang thực hiện','Đang thực hiện'],['Chờ duyệt','Chờ duyệt'],['Yêu cầu sửa','Yêu cầu sửa'],['Đã đăng','Đã đăng']]
  const viewActions = <div className="plan-filter-actions"><div className="plan-view-switch" role="tablist" aria-label="Cách xem kế hoạch"><button role="tab" aria-selected={channelView} className={channelView?'selected':''} onClick={()=>go('plan',true,{...filters,channel:'',id:'',q:query,view:'channels'})}>Theo Kênh</button><button role="tab" aria-selected={listView} className={listView?'selected':''} onClick={()=>go('plan',true,{...filters,q:query,view:'list'})}>Danh sách</button></div><button className="text-button" onClick={()=>go('plan',false,{view:'channels'})}>Xóa bộ lọc</button></div>
  return <div>
    <PageHeading eyebrow="LỊCH BIÊN TẬP" title="Kế hoạch nội dung" description="Lập kế hoạch, phân công và theo dõi lịch xuất bản." action={<button className="primary-button" onClick={onAdd}><Icon name="plus"/> Thêm nội dung</button>}/>
    <section className="plan-stats" aria-label="Thống kê theo bộ lọc">
      <div><span>Tổng nội dung khớp lọc</span><b>{stats.total}</b></div>{Object.entries(stats.by_status||{}).map(([status,count])=><div key={status}><span>{status||'Chưa đặt trạng thái'}</span><b>{count}</b></div>)}
    </section>
    {listView&&<section className="panel plan-filter-panel">
      <div className="plan-filter-heading"><div><h2>Lọc nội dung</h2><span>{items.length} / {total} kết quả đang tải</span></div>{viewActions}</div>
      <div className="plan-filter-grid">
        <label className="plan-search-field">Nội dung<input type="search" value={query} onChange={e=>onQueryChange(e.target.value)} placeholder="Tìm chủ đề, key, mô tả..."/></label>
        <label>Xuất bản<select value={publicationFilter} onChange={e=>setPublicationFilter(e.target.value)}><option value="">Tất cả</option><option value="unpublished">Chưa đăng</option><option value="overdue">Đang trễ</option></select></label>
        <label>Kênh<select value={filters.channel} onChange={e=>setFilters(f=>({...f,channel:e.target.value,view:e.target.value?'detail':'channels'}))}><option value="">Tất cả kênh</option><option value="__empty">Chưa gán Kênh</option>{channels.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label>Ngày đăng từ<input type="date" value={filters.from} onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/></label>
        <label>Đến ngày<input type="date" value={filters.to} onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/></label>
        <label>Phụ trách<select value={filters.assignee} onChange={e=>setFilters(f=>({...f,assignee:e.target.value}))}><option value="">Tất cả thành viên</option>{(data.users||[]).map(u=><option key={u.email} value={u.email}>{u.name}</option>)}</select></label>
        <label>Trạng thái<select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}><option value="">Tất cả trạng thái</option>{statuses.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      </div>
    </section>}
    {detailView&&<PlanChannelDialog channelName={channelName} group={selectedGroup} items={items} total={total} loading={loading} loadingMore={loadingMore} hasMore={hasMore} loadMore={loadMore} sentinel={sentinel} loadError={loadError} personName={personName} onClose={backToChannels} onSelectPlan={id=>setFilters(f=>({...f,id}))} onClearFilters={()=>go('plan',false,{...filters,q:'',from:'',to:'',assignee:'',status:'',unpublished:'',overdue:'',id:'',view:'detail'})} filters={filters} setFilters={setFilters} query={query} onQueryChange={onQueryChange} users={data.users||[]} statuses={statuses} publicationFilter={publicationFilter} onPublicationFilter={setPublicationFilter}/>}
    {channelView&&<section className="panel plan-channel-panel"><div className="table-toolbar"><div><h2>Các Kênh nội dung</h2><span className="plan-section-note">{groups.length} Kênh · Sắp xếp theo lịch đăng gần nhất</span></div>{viewActions}</div><div className="plan-channel-grid">{groups.map(group=><article className="plan-channel-card" key={group.key||'__empty'} onClick={()=>openChannel(group.key)}><div className="plan-channel-card-top"><i className="channel-card-icon">{group.name[0]||'K'}</i><span className="channel-card-arrow">→</span></div><div className="plan-channel-card-title"><h3>{group.name}</h3><span>{group.total} nội dung</span></div><div className="channel-card-statuses">{statusChips.filter(([status])=>group.by_status?.[status]).map(([status,label])=><button type="button" className="channel-card-filter" key={status} onClick={e=>{e.stopPropagation();openChannelStatus(group.key,status)}} aria-label={`${label} trong ${group.name}`}>{label} <b>{group.by_status[status]}</b></button>)}{group.by_status?.['']&&<span>Chưa đặt trạng thái <b>{group.by_status['']}</b></span>}{!Object.keys(group.by_status||{}).length&&<span>Chưa có trạng thái</span>}</div><div className="channel-card-meta"><span>{group.next_post?`Bài tiếp theo · ${formatPlanDate(group.next_post)}`:'Chưa có lịch đăng'}</span>{group.overdue>0&&<button type="button" className="channel-card-overdue" onClick={e=>{e.stopPropagation();openChannelOverdue(group.key)}} aria-label={`Xem ${group.overdue} nội dung đang trễ trong ${group.name}`}>{group.overdue} đang trễ</button>}</div><div className="channel-card-owner">{(group.assignees||[]).slice(0,3).map(email=><i key={email} title={personName(email)}>{initials(personName(email))}</i>)}<span>{group.assignees?.length?group.assignees.slice(0,2).map(personName).join(', '):'Chưa phân công'}</span></div><button type="button" className="channel-card-cta" onClick={e=>{e.stopPropagation();openChannel(group.key)}}>Xem chi tiết Kênh →</button></article>)}{!groups.length&&!loading&&<div className="plan-empty">{loadError?'Không tải được nhóm Kênh.':'Không có Kênh nào khớp bộ lọc.'}</div>}{loading&&!groups.length&&<div className="plan-empty">Đang tải các Kênh…</div>}</div></section>}
    {listView&&<section className="panel table-panel plan-results-panel"><div className="table-toolbar"><h2>{detailView?`Nội dung trong ${channelName}`:'Danh sách nội dung'}</h2><span>{items.length} / {total} nội dung</span></div><div className="simple-table plan-table"><div className="table-head"><span>CONTENT PILLAR / KEY</span><span>KÊNH</span><span>DEMO</span><span>NGÀY ĐĂNG</span><span>PHỤ TRÁCH</span><span>TRẠNG THÁI</span></div>{items.map(p=><div className="table-row" key={p.id}><span className="plan-title"><button className="work-title" onClick={()=>setFilters(f=>({...f,id:p.id}))}>{p.pillar||'Nội dung'}</button><small>{p.key}</small></span><span><i className="table-avatar">{(p.channel||'D')[0]}</i>{p.channel||'Chưa gán Kênh'}</span><span>{p.demo_date||'—'}</span><span>{p.post_date||'—'}</span><span>{personName(p.assignee)}</span><Status value={p.status}/></div>)}{!items.length&&!loading&&<div className="plan-empty">{loadError?'Không tải được nội dung.':'Không tìm thấy nội dung phù hợp.'}</div>}{loading&&!items.length&&<div className="plan-empty">Đang tải nội dung…</div>}</div>{loadError&&<div className="plan-load-error">{loadError}</div>}{hasMore&&<div ref={sentinel} className="plan-load-trigger" aria-live="polite">{loadingMore?'Đang tải thêm nội dung…':<button className="secondary-button" onClick={loadMore}>Tải thêm</button>}</div>}{!hasMore&&items.length>0&&<div className="plan-end-note">Đã hiển thị hết {total} nội dung phù hợp.</div>}</section>}
    {filters.id&&!loading&&(items.find(p=>p.id===filters.id)?<PlanDetails plan={items.find(p=>p.id===filters.id)} users={data.users||[]} me={data.me} onReview={onReview} onEdit={onEdit} onDelete={onDelete} onClose={()=>setFilters(f=>({...f,id:''}))}/>:<p role="alert">Không tìm thấy nội dung hoặc bạn không có quyền xem. <button className="text-button" onClick={()=>setFilters(f=>({...f,id:''}))}>Đóng chi tiết</button></p>)}
  </div>
}

function ShiftPage({data}) {
  const days=['T2','T3','T4','T5','T6','T7','CN']
  return <div><PageHeading eyebrow="VẬN HÀNH NHÓM" title="Lịch làm việc" description="Lịch phân ca của nhóm trong tuần." action={<button className="secondary-button"><Icon name="calendar"/> Tuần này <span>⌄</span></button>}/><section className="panel table-panel"><div className="shift-heading"><div><h2>Tuần bắt đầu {data.shiftsWeek||'—'}</h2><p>Phân ca làm việc và lịch sản xuất nội dung.</p></div><div className="shift-legend"><span><i className="shift-pill s"/>Sáng</span><span><i className="shift-pill c"/>Chiều</span><span><i className="shift-pill live"/>Live / Quay</span><span><i className="shift-pill off"/>Nghỉ</span></div></div><div className="shift-table"><div className="shift-row shift-head"><span>THÀNH VIÊN</span>{days.map(d=><span key={d}>{d}</span>)}</div>{(data.shifts||[]).map(row=>{const u=data.users?.find(x=>x.email===row.email);return <div className="shift-row" key={row.email}><span className="title-cell"><Avatar user={u}/><b>{u?.name||row.email}</b></span>{days.map(d=><span key={d}><i className={'shift-cell '+(row[d]==='S'?'s':row[d]==='C'?'c':row[d]==='Live'?'live':row[d]==='Quay'?'live':'off')}>{row[d]||'—'}</i></span>)}</div>})}</div></section></div>
}

const payrollPolicyLabels={fixed:'Cố định theo tháng',per_unit:'Theo sản lượng',per_unit_tenure:'Theo sản lượng + thâm niên',tier:'Thưởng theo mốc',percent:'Theo phần trăm',penalty_below:'Phạt dưới tối thiểu',penalty_per_unit:'Phạt theo số lượng'}

function PayrollPage({data,onCompute,demo}) {
  const rows=data.payroll||[]
  const canManage=!demo && Boolean(data.me?.isAdmin||data.me?.caps?.includes('payroll.compute'))
  return <div><PageHeading eyebrow="TỔNG HỢP THU NHẬP" title="Lương thưởng" description="Kết quả KPI và thu nhập theo kỳ tính lương." action={<button className="secondary-button" disabled title="Chưa có bộ chọn kỳ lương"><Icon name="calendar"/> {data.payrollMonth||'Chưa có kỳ lương'} <span>⌄</span></button>}/><div className="metric-grid three"><Metric label="Tổng quỹ lương" value={money(rows.reduce((s,r)=>s+Number(r.total||0),0))} delta="Kỳ hiện tại" color="purple" icon="₫"/><Metric label="KPI đạt trung bình" value={rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.kpi_rate||0),0)/rows.length)+'%':'—'} delta="Toàn nhóm" color="green" icon="◉"/><Metric label="Thành viên" value={rows.length} delta="Trong kỳ" color="blue" icon="♙"/></div><section className="panel table-panel"><div className="table-toolbar"><h2>Bảng lương tháng {data.payrollMonth||''}</h2><div className="flex gap-2">{canManage&&<button className="secondary-button" onClick={onCompute}>Tính lại từ Policy</button>}<button className="secondary-button" disabled title="Tính năng xuất báo cáo sẽ được bổ sung">Xuất báo cáo <Icon name="arrow"/></button></div></div><div className="simple-table payroll-table"><div className="table-head"><span>THÀNH VIÊN</span><span>LƯƠNG CƠ BẢN</span><span>PHỤ CẤP</span><span>THƯỞNG / PHẠT</span><span>KPI</span><span>TỔNG NHẬN</span></div>{rows.map(r=>{const u=data.users?.find(x=>x.email===r.email);return <div className="table-row" key={r.email}><span className="title-cell"><Avatar user={u}/><b>{u?.name||r.email}</b></span><span>{money(r.base)}</span><span>{money(r.fees)}</span><span>{money(Number(r.bonus||0)-Number(r.penalty||0))}</span><span><span className="kpi-mini"><i style={{width:(r.kpi_rate||0)+'%'}}/></span>{Math.round(r.kpi_rate||0)}%</span><b>{money(r.total)}</b></div>})}</div></section>{canManage&&<PayrollPolicyPanel users={data.users||[]} payrollRows={rows} month={data.payrollMonth}/>}</div>
}

function PayrollPolicyPanel({users,payrollRows,month}) {
  const blank=()=>({id:0,email:users[0]?.email||'',code:'',label:'',type:'per_unit',input_key:'',rate:0,tiers:'',minimum:0,note:'',active:true})
  const [policies,setPolicies]=useState([])
  const [form,setForm]=useState(blank)
  const [editing,setEditing]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [selectedEmail,setSelectedEmail]=useState('')
  const groups=payrollPolicyGroups(policies,payrollRows)
  const selectedGroup=groups.find(group=>group.email.toLowerCase()===selectedEmail.toLowerCase())
  const load=async()=>{try{const result=await request('/payroll/policies');setPolicies(result.policies||[])}catch(e){setError(e.message)}}
  useEffect(()=>{void load()},[])
  const change=(key,value)=>setForm(current=>({...current,[key]:value}))
  const edit=policy=>{setForm({...policy,active:Boolean(policy.active)});setEditing(true);setError('')}
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('')
    try{
      const payload={...form,rate:Number(form.rate||0),minimum:Number(form.minimum||0)}
      await request(form.id?`/payroll/policies/${form.id}`:'/payroll/policies',{method:form.id?'PUT':'POST',body:JSON.stringify(payload)})
      setEditing(false);setForm(blank());await load()
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <section className="panel policy-panel"><div className="table-toolbar"><div><span className="eyebrow">CẤU HÌNH TÍNH LƯƠNG</span><h2>Công thức KPI theo nhân sự</h2></div><button className="primary-button" onClick={()=>{setForm(blank());setEditing(true);setError('')}}>Thêm công thức</button></div><p className="muted policy-help">Tổng tiền lấy từ snapshot kỳ {month||'lương'} gần nhất. Bấm vào nhân sự để xem chi tiết; sau khi đổi công thức, hãy “Tính lại từ Policy”.</p>{error&&<div className="form-error">{error}</div>}{editing&&<form className="policy-editor" onSubmit={save}><div className="form-two"><label>Nhân sự<select value={form.email} onChange={e=>change('email',e.target.value)} required>{users.map(user=><option key={user.email} value={user.email}>{user.name}</option>)}</select></label><label>Loại công thức<select value={form.type} onChange={e=>change('type',e.target.value)}>{Object.entries(payrollPolicyLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><div className="form-two"><label>Mã công thức<input value={form.code} onChange={e=>change('code',e.target.value)} placeholder="vd: content_fee" required/></label><label>Tên hiển thị<input value={form.label} onChange={e=>change('label',e.target.value)} placeholder="vd: Phí sản xuất video" required/></label></div><div className="form-two"><label>Chỉ số đầu vào<input value={form.input_key} onChange={e=>change('input_key',e.target.value)} placeholder={form.type==='fixed'?'Không cần với lương cố định':'vd: videos'} required={form.type!=='fixed'}/></label><label>Đơn giá / tỷ lệ<input type="number" min="0" step="any" value={form.rate} onChange={e=>change('rate',e.target.value)}/></label></div><div className="form-two"><label>Mức tối thiểu<input type="number" min="0" step="any" value={form.minimum} onChange={e=>change('minimum',e.target.value)}/></label><label>Ngưỡng thưởng<input value={form.tiers} onChange={e=>change('tiers',e.target.value)} placeholder="vd: 10:500000;20:1000000"/></label></div><label>Ghi chú<textarea value={form.note} onChange={e=>change('note',e.target.value)} rows="2" placeholder="Giải thích cách tính để người rà soát hiểu."/></label><label className="checkline"><input type="checkbox" checked={form.active} onChange={e=>change('active',e.target.checked)}/> Đang áp dụng</label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setEditing(false)}>Huỷ</button><button className="primary-button" disabled={busy}>{busy?'Đang lưu…':'Lưu công thức'}</button></div></form>}
    <div className="policy-people">{groups.map(group=><button type="button" className="policy-person" key={group.email} onClick={()=>setSelectedEmail(group.email)}><span><b>{group.name}</b><small>{group.policies.length} công thức</small></span><strong>{group.total===null?'Chưa tính':money(group.total)}</strong><span className="policy-person-arrow">→</span></button>)}{!groups.length&&<div className="policy-empty">Chưa có công thức. Thêm công thức đầu tiên để bắt đầu tính.</div>}</div>
    {selectedGroup&&<Modal title={selectedGroup.name} onClose={()=>setSelectedEmail('')} className="policy-detail-modal"><p className="policy-detail-total">Tổng đã tính tháng {month||'—'} <b>{selectedGroup.total===null?'Chưa có snapshot':money(selectedGroup.total)}</b></p><div className="policy-detail-list">{selectedGroup.policies.map(policy=>{const item=selectedGroup.breakdown.get(policy.code);return <article key={policy.id}><div><b>{item?.label||policy.label}</b><small>{payrollPolicyLabels[policy.type]||policy.type} · {policy.input_key||'Không có đầu vào'} · Đơn giá {money(policy.rate)}</small><small>{item?.how|| (selectedGroup.total===null?'Chưa tính kỳ này':'Không phát sinh trong snapshot')}</small></div><strong>{item?money(item.amount):'—'}</strong><button type="button" className="dots-button" onClick={()=>{setSelectedEmail('');edit(policy)}}>Sửa</button></article>})}</div></Modal>}
  </section>
}

function compactNumber(value) {
  const n = Number(value || 0)
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 2).replace(/\.00$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString('vi-VN')
}

function pancakePayloadRows(payload, key='data') {
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload?.[key]) ? payload[key] : []
}

function pancakeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  let text = value.trim().replace(/[^\d,.-]/g, '')
  if (!text) return 0
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (text.includes(',')) {
    const parts=text.split(',')
    text=parts.length===2&&parts[1].length===3?parts.join(''):text.replace(',', '.')
  } else if (text.split('.').length>2) text=text.replace(/\./g,'')
  const number = Number(text)
  return Number.isFinite(number) ? number : 0
}

function pancakePostType(post) {
  const type=String(post?.type||post?.post_type||post?.content_type||'').toLowerCase()
  if(type.includes('video')||post?.video_id||post?.video_url||post?.video) return 'video'
  const attachments=Array.isArray(post?.attachments)?post.attachments:[]
  if(attachments.some(item=>String(item?.type||item?.media_type||'').toLowerCase().includes('video'))) return 'video'
  return type
}

function pancakePostLink(post) {
  const value=post?.link||post?.permalink_url||post?.permalink||post?.url||post?.video_url||''
  return /^https?:\/\//i.test(String(value)) ? String(value) : ''
}

function pancakeSum(rows, field) {
  return rows.reduce((sum,row)=>sum+pancakeNumber(row?.[field]),0)
}

function pancakePageReport(page) {
  const metrics=page.metrics||{}
  const pageRows=pancakePayloadRows(metrics.pages)
  const posts=pancakePayloadRows(metrics.posts,'posts')
  const reactions=posts.reduce((sum,post)=>sum+Object.values(post.reactions||{}).reduce((n,value)=>n+pancakeNumber(value),0),0)
  return {
    hasPageStats:Boolean(metrics.pages)&&!page.errors?.pages,
    hasPosts:Boolean(metrics.posts)&&!page.errors?.posts,
    pageRows,
    posts,
    customers:pancakeSum(pageRows,'new_customer_count'),
    inboxes:pancakeSum(pageRows,'new_inbox_count'),
    phones:pancakeSum(pageRows,'phone_number_count'),
    uniquePhones:pancakeSum(pageRows,'uniq_phone_number_count'),
    videos:posts.filter(post=>pancakePostType(post)==='video').length,
    comments:pancakeSum(posts,'comment_count'),
    reactions,
  }
}

function pancakeRangeParts(period) {
  const text=String(period||'')
  const range=text.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/)
  if(range) return {from:range[1],to:range[2]}
  const month=text.match(/^(\d{4})-(\d{2})$/)
  if(!month) return null
  const days=new Date(Number(month[1]),Number(month[2]),0).getDate()
  return {from:`${month[1]}-${month[2]}-01`,to:`${month[1]}-${month[2]}-${String(days).padStart(2,'0')}`}
}

function pancakeLocalDate(value) {
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match?new Date(Number(match[1]),Number(match[2])-1,Number(match[3])):null
}

function pancakeWeekBars(rows, field, period) {
  const range=pancakeRangeParts(period)
  if(!range) return []
  const start=pancakeLocalDate(range.from)
  const end=pancakeLocalDate(range.to)
  if(!start||!end||start>end) return []
  const totalDays=Math.round((end-start)/86400000)+1
  const weeks=Array.from({length:Math.ceil(totalDays/7)},(_,i)=>{
    const from=new Date(start); from.setDate(start.getDate()+i*7)
    const to=new Date(from); to.setDate(to.getDate()+Math.min(6,totalDays-i*7-1))
    return {label:from.getMonth()===to.getMonth()?`${from.getDate()}–${to.getDate()}`:`${from.getDate()}/${from.getMonth()+1}–${to.getDate()}/${to.getMonth()+1}`,value:0}
  })
  rows.forEach(row=>{
    const date=pancakeLocalDate(row.hour||row.date||row.time)
    if(!date||date<start||date>end) return
    weeks[Math.floor((date-start)/86400000/7)].value+=pancakeNumber(row[field])
  })
  return weeks
}

function pancakeDate(value) {
  const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match?`${match[3]}/${match[2]}/${match[1]}`:'—'
}

function pancakePeriod(period) {
  const range=pancakeRangeParts(period)
  if(!range) return period||'Kỳ hiện tại'
  return `${pancakeDate(range.from)} – ${pancakeDate(range.to)}`
}

function pancakeAverageResponse(milliseconds) {
  const seconds=Math.round(pancakeNumber(milliseconds)/1000)
  if(!seconds) return '—'
  if(seconds<60) return `${seconds} giây`
  const minutes=Math.floor(seconds/60)
  return `${minutes} phút${seconds%60?` ${seconds%60} giây`:''}`
}

function pancakeStaffRows(page) {
  const staff=page.metrics?.users?.data?.users||{}
  const engagements=page.metrics?.customer_engagements?.users_engagements||[]
  const byId=new Map(engagements.map(row=>[row.user_id,row]))
  const ids=new Set([...Object.keys(staff),...engagements.map(row=>row.user_id).filter(Boolean)])
  return [...ids].map(id=>{
    const user=staff[id]||{}
    const engagement=byId.get(id)||{}
    return {
      name:user.user_name||engagement.name||'Nhân viên',
      inbox:pancakeNumber(user.inbox_count??engagement.inbox_count),
      comments:pancakeNumber(user.comment_count),
      phones:pancakeNumber(user.phone_number_count),
      orders:pancakeNumber(engagement.order_count),
      response:user.average_response_time,
    }
  }).sort((a,b)=>(b.inbox+b.comments)-(a.inbox+a.comments))
}

function pancakeFeedback(page) {
  const payloads=Object.entries(page.metrics||{}).filter(([name])=>name==='customer_feedbacks'||name.startsWith('customer_feedbacks_part_')).map(([,payload])=>payload||{})
  const count=payloads.reduce((sum,payload)=>sum+pancakeNumber(payload.feedback_count),0)
  const ratings=payloads.reduce((all,payload)=>{
    Object.entries(payload.feedback_rating_counts||{}).forEach(([rating,value])=>all[rating]=(all[rating]||0)+pancakeNumber(value))
    return all
  },{})
  const people=new Map()
  payloads.flatMap(payload=>payload.customer_average_feedback||[]).forEach(row=>{
    const key=row.admin_id||row.employee_name||'unknown'
    const current=people.get(key)||{name:row.employee_name||'Nhân viên',count:0,weighted:0,automatic:0}
    const amount=pancakeNumber(row.feedback_count)
    current.count+=amount
    current.weighted+=pancakeNumber(row.avg_feedback)*amount
    current.automatic+=pancakeNumber(row.botcake_count)
    people.set(key,current)
  })
  const staff=[...people.values()]
  const averageCount=staff.reduce((sum,row)=>sum+row.count,0)
  return {available:payloads.length>0,count,ratings,average:averageCount?staff.reduce((sum,row)=>sum+row.weighted,0)/averageCount:0,hasAverage:averageCount>0,people:staff.map(row=>({...row,average:row.count?row.weighted/row.count:0}))}
}

function pancakeTagRows(page) {
  const payload=page.metrics?.tags||{}
  const series=payload.data?.series||{}
  return (payload.tags||[]).map(tag=>({
    name:tag.text||'Thẻ không tên',
    count:(series[tag.id]||[]).reduce((sum,value)=>sum+pancakeNumber(value),0),
  })).sort((a,b)=>b.count-a.count)
}

function pancakeCurrency(value,currency) {
  const formatted=pancakeNumber(value).toLocaleString('vi-VN',{maximumFractionDigits:0})
  return currency?`${formatted} ${currency}`:formatted
}

function pancakeStatusLabel(value) {
  const status=String(value||'').toLowerCase()
  if(status==='active') return 'Đang chạy'
  if(status==='paused') return 'Tạm dừng'
  if(status==='completed') return 'Đã kết thúc'
  return value||'—'
}

function PancakeTrendCard({title,values,available}) {
  const max=Math.max(1,...values.map(item=>item.value))
  return <section className="pancake-trend-card">
    <h4>{title}</h4>
    {available&&values.length?<div className="pancake-week-bars">{values.map(item=><div className="pancake-week-bar" key={item.label} title={`${item.label}: ${compactNumber(item.value)}`}><span>{compactNumber(item.value)}</span><i style={{height:`${Math.max(item.value?7:3,item.value/max*76)}%`}}/><small>{item.label}</small></div>)}</div>:<p className="pancake-report-empty">Chưa có dữ liệu theo ngày trong kỳ này.</p>}
  </section>
}

function PancakeReportTable({title,note,columns,rows,empty='Chưa có dữ liệu trong kỳ này.'}) {
  return <section className="pancake-report-table">
    <div className="pancake-report-table-head"><div><h4>{title}</h4>{note&&<small>{note}</small>}</div><span>{rows.length}</span></div>
    {rows.length?<div className="pancake-report-table-scroll"><table><thead><tr>{columns.map(column=><th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={row.id||row.key||index}>{columns.map(column=><td key={column.key}>{column.render?column.render(row):row[column.key]??'—'}</td>)}</tr>)}</tbody></table></div>:<p className="pancake-report-empty">{empty}</p>}
  </section>
}

function ChannelPage({data,demo,onConnect,onSync,onLoadMetrics,onMap,onUnmap}) {
  const [connectOpen,setConnectOpen] = useState(false)
  const [syncing,setSyncing] = useState(false)
  const [syncResult,setSyncResult] = useState(null)
  const [syncError,setSyncError] = useState('')
  const [selectedPageId,setSelectedPageId] = useState('')
  const initialRange=pancakeRangeParts(data.pancakePeriod||data.currentMonth)||{from:'',to:''}
  const [from,setFrom]=useState(data.pancakeFrom||initialRange.from)
  const [to,setTo]=useState(data.pancakeTo||initialRange.to)
  const stats=data.channelStats||[]
  const pancake=data.pancake||{pages:[],configured:0,connected:0,needs_reconnect:0}
  const metricPages=data.pancakeMetrics||[]
  const comparisonPages=data.pancakeComparison||[]
  const period=data.pancakePeriod||data.currentMonth
  const usersByEmail=new Map((data.users||[]).map(user=>[user.email,user]))
  const reportsByPage=new Map(metricPages.map(page=>[page.page_id,pancakePageReport(page)]))
  const comparisonByPage=new Map(comparisonPages.map(page=>[page.page_id,pancakePageReport(page)]))
  const assignedMetrics=metricPages.filter(page=>page.email)
  const reports=assignedMetrics.map(page=>reportsByPage.get(page.page_id))
  const isAdmin=!demo && Boolean(data.me?.isAdmin||data.me?.caps?.includes('channel.sync'))
  const total=(key)=>stats.reduce((sum,row)=>sum+Number(row[key]||0),0)
  const reportTotal=key=>reports.reduce((sum,report)=>sum+report[key],0)
  const selectedPage=metricPages.find(page=>page.page_id===selectedPageId)
  const hasPosts=reports.some(report=>report.hasPosts)
  const hasPageStats=reports.some(report=>report.hasPageStats)
  const customRange=String(period||'').includes('..')
  const videos=demo?86:(hasPosts?reportTotal('videos'):(customRange?'—':total('videos')))
  const views=demo?compactNumber(2840000):(!customRange&&total('views')?compactNumber(total('views')):'—')
  const followers=demo?compactNumber(12480):(!customRange&&total('followers')?compactNumber(total('followers')):'—')
  const runLoad=async()=>{
    setSyncError('')
    if(!from||!to||from>to){setSyncError('Vui lòng chọn khoảng ngày hợp lệ.');return}
    try { await onLoadMetrics(from,to) } catch (e) { setSyncError(e.message) }
  }
  const runSync=async()=>{
    setSyncError('')
    if(!from||!to||from>to){setSyncError('Vui lòng chọn khoảng ngày hợp lệ.');return}
    try {
      setSyncing(true)
      setSyncResult(await onSync({from,to}))
      await onLoadMetrics(from,to)
    } catch (e) { setSyncError(e.message) } finally { setSyncing(false) }
  }
  const newCustomers=demo?0:reportTotal('customers')
  const newInboxes=demo?0:reportTotal('inboxes')
  const phoneNumbers=demo?0:reportTotal('phones')
  const comments=demo?0:reportTotal('comments')
  const interactions=demo?0:reportTotal('reactions')
  const change=(key)=>{
    if(demo) return {text:'Kỳ hiện tại',tone:''}
    const current=reports.reduce((sum,report)=>sum+Number(report[key]||0),0)
    const previous=[...comparisonByPage.values()].reduce((sum,report)=>sum+Number(report[key]||0),0)
    if(!comparisonPages.length||previous===0) return {text:'Chưa có cơ sở so sánh',tone:''}
    const percent=(current-previous)/previous*100
    return {text:`${percent>=0?'↑':'↓'} ${Math.abs(percent).toFixed(1)}% so với kỳ trước`,tone:percent>0?'delta-positive':'delta-negative'}
  }
  return <div>
    <PageHeading eyebrow="HIỆU SUẤT KÊNH" title="Chỉ số kênh" description="Số liệu page và bài đăng trong khoảng ngày từ API Pancake." action={<div className="pancake-range-actions"><div className="pancake-range-controls"><label>Từ<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><span>→</span><label>Đến<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="secondary-button" onClick={runLoad}>Xem dữ liệu</button></div>{isAdmin&&<button className="primary-button" onClick={runSync} disabled={syncing}><Icon name="calendar"/> {syncing?'Đang đồng bộ…':'Đồng bộ khoảng ngày'}</button>}</div>}/>
    {syncError&&<div className="form-error pancake-sync-result pancake-range-error">Đồng bộ thất bại: {syncError}</div>}
    <div className="metric-grid">
      <Metric label="Lượt xem" value={views} delta={views==='—'?'Chưa có trong schema API Pancake':change('views')} color="purple" icon="◉"/>
      <Metric label="Người theo dõi" value={followers} delta={followers==='—'?'Chưa có trong schema API Pancake':change('followers')} color="green" icon="♙"/>
      <Metric label="Video đã đăng" value={videos==='—'?'—':(hasPosts||demo||total('videos')?compactNumber(videos):'—')} delta={hasPosts||demo?change('videos'):'Bài có type video'} color="orange" icon="▶"/>
      <Metric label="Khách mới" value={hasPageStats||demo?compactNumber(newCustomers):'—'} delta={hasPageStats||demo?change('customers'):'Thống kê page'} color="blue" icon="♙"/>
      <Metric label="Hội thoại mới" value={hasPageStats||demo?compactNumber(newInboxes):'—'} delta={hasPageStats||demo?change('inboxes'):'Thống kê page'} color="purple" icon="⌁"/>
      <Metric label="Số điện thoại" value={hasPageStats||demo?compactNumber(phoneNumbers):'—'} delta={hasPageStats||demo?change('phones'):'Thống kê page'} color="green" icon="☎"/>
      <Metric label="Bình luận bài đăng" value={hasPosts||demo?compactNumber(comments):'—'} delta={hasPosts||demo?change('comments'):'Bài đăng đã lấy'} color="orange" icon="☰"/>
      <Metric label="Lượt cảm xúc" value={hasPosts||demo?compactNumber(interactions):'—'} delta={hasPosts||demo?change('reactions'):'Bài đăng đã lấy'} color="blue" icon="♥"/>
    </div>
    {!demo&&<section className="panel pancake-metrics-panel"><div className="pancake-metrics-heading"><div><span className="eyebrow">BÁO CÁO PAGE</span><h2>Số liệu theo từng page</h2><p>{metricPages.length} page · {pancakePeriod(period)}</p></div><span className="pancake-period-badge">{pancakePeriod(period)}</span></div>{metricPages.length?<PancakePageComparison pages={metricPages} usersByEmail={usersByEmail} reportsByPage={reportsByPage} period={period} onSelect={setSelectedPageId}/>:<div className="channel-empty">Chưa có page Pancake trong khoảng ngày này.</div>}<p className="muted channel-note">Chọn tên page để mở báo cáo chi tiết trong popup. Lượt xem video và follower không có trong dữ liệu Pancake đã tích hợp.</p><details className="pancake-formula"><summary>Cách tính</summary><p>% thay đổi = (Kỳ này − Kỳ trước) / Kỳ trước × 100. Kỳ trước có cùng số ngày; nếu kỳ trước = 0 thì hiển thị “Chưa có cơ sở so sánh”.</p></details></section>}
    {!demo && <section className="panel table-panel"><div className="table-toolbar"><h2>Kênh nguồn khác</h2><span>{data.channels?.length||0} kênh</span></div><div className="simple-table channel-mapping-table"><div className="table-head"><span>NHÂN SỰ</span><span>KÊNH</span><span>PAGE ID</span><span>NỀN TẢNG</span><span>VỊ TRÍ</span><span>TRẠNG THÁI</span></div>{(data.channels||[]).map(c=>{const u=usersByEmail.get(c.email);return <div className="table-row" key={c.email+'-'+c.slot}><span className="title-cell"><Avatar user={u}/><b>{u?.name||c.email}</b></span><span>{c.page_name||'Đã liên kết'}</span><code className="pancake-page-id">{c.page_id||'—'}</code><span>{c.platform}</span><span>{c.slot===2?'Kênh 2':'Kênh chính'}</span><Status value="Đang hoạt động"/></div>})}</div></section>}
    {isAdmin && <section className="panel pancake-panel">
      <div className="panel-heading"><div><span className="eyebrow">TÍCH HỢP PANCAKE</span><h2>{pancake.configured?(pancake.connected+'/'+pancake.configured+' page đã kết nối'):'Chưa kết nối Pancake'}</h2></div><button className="primary-button" onClick={()=>setConnectOpen(true)}>Cập nhật token</button></div>
      <p className="muted pancake-help">{pancake.needs_reconnect?(pancake.needs_reconnect+' page cần kết nối lại. '):''}Gán nhân sự trực tiếp theo page ID; không giới hạn số page mỗi người. “Gỡ gán” chỉ bỏ người phụ trách; kết nối và lịch sử số liệu vẫn được giữ.</p>
      {syncResult&&<div className="pancake-sync-result" role="status"><b>{pancakePeriod(syncResult.period||syncResult.month)}: {syncResult.found} page · {syncResult.synced} nhóm API đã lưu · {syncResult.failed} lỗi</b>{syncResult.errors?.length>0&&<ul>{syncResult.errors.slice(0,8).map((e,i)=><li key={i}>{pancakeUserFacingError(e)}</li>)}</ul>}</div>}
      {pancake.pages?.length>0 && <div className="pancake-pages">{pancake.pages.map(page=><PancakePageRow key={page.page_id} page={page} users={data.users||[]} onMap={onMap} onUnmap={onUnmap}/>)}</div>}
    </section>}
    {selectedPage&&<PancakeMetricsModal page={selectedPage} user={usersByEmail.get(selectedPage.email)} totals={reportsByPage.get(selectedPage.page_id)} period={period} onClose={()=>setSelectedPageId('')}/>}
    {connectOpen && <PancakeConnectModal onClose={()=>setConnectOpen(false)} onConnect={onConnect}/>}
  </div>
}

function PancakeMetricsPage({page,user,totals,period,modal=false}) {
  const person=user?.name||page.email||'Chưa gán nhân sự'
  const metricErrors=Object.entries(page.errors||{})
  const seriesAvailable=Boolean(page.metrics?.customer_engagements)&&!page.errors?.customer_engagements
  const staffRows=pancakeStaffRows(page)
  const tags=pancakeTagRows(page)
  const feedback=pancakeFeedback(page)
  const adRows=pancakePayloadRows(page.metrics?.ads_by_id).map((row,index)=>({...row,id:row.id||index}))
  const timeAdRows=pancakePayloadRows(page.metrics?.ads_by_time).map((row,index)=>({...row,id:row.id||index,label:row.hour||row.time||row.name||`Mốc ${index+1}`}))
  const campaignRows=pancakePayloadRows(page.metrics?.pages_campaigns).map((row,index)=>({...row,id:row.adset_id||row.ad_id||index}))
  const topPosts=pancakeTopPosts(totals.posts,pancakeNumber)
  const summary=[
    {label:'Khách hàng mới',value:totals.hasPageStats?compactNumber(totals.customers):'—',tone:'violet'},
    {label:'Hội thoại mới',value:totals.hasPageStats?compactNumber(totals.inboxes):'—',tone:'blue'},
    {label:'Số điện thoại thu được',value:totals.hasPageStats?compactNumber(totals.phones):'—',tone:'teal'},
    {label:'Video đã đăng',value:totals.hasPosts?compactNumber(totals.videos):'—',tone:'orange'},
    {label:'Bình luận bài đăng',value:totals.hasPosts?compactNumber(totals.comments):'—',tone:'rose'},
    {label:'Lượt cảm xúc',value:totals.hasPosts?compactNumber(totals.reactions):'—',tone:'violet'},
  ]
  const pageRows=[
    ['Khách hàng mới','new_customer_count'],['Hội thoại mới','new_inbox_count'],['Tin nhắn từ khách','customer_inbox_count'],
    ['Bình luận từ khách','customer_comment_count'],['Tin nhắn trên page','page_inbox_count'],['Bình luận trên page','page_comment_count'],
    ['Số điện thoại thu được','phone_number_count'],['Số điện thoại riêng biệt','uniq_phone_number_count'],
    ['Khách tương tác qua inbox','inbox_interactive_count'],['Giới thiệu website duy nhất','today_uniq_website_referral'],['Lượt truy cập website','today_website_guest_referral'],
  ].map(([label,key])=>({label,key,value:pancakeSum(totals.pageRows,key)})).filter(row=>totals.pageRows.some(item=>item[row.key]!==undefined)||row.value>0)
  return <details open={modal||undefined} className="pancake-metric-page">
    <summary className="pancake-metric-summary">
      <span className="pancake-report-identity"><b>{page.page_name||page.page_id}</b><small>{page.platform||'Pancake'} · {person} · ID {page.page_id}</small></span>
      <span className="pancake-report-summary-metrics"><span>Khách mới <b>{totals.hasPageStats?compactNumber(totals.customers):'—'}</b></span><span>Hội thoại <b>{totals.hasPageStats?compactNumber(totals.inboxes):'—'}</b></span><span>Video <b>{totals.hasPosts?compactNumber(totals.videos):'—'}</b></span></span>
      <span className="pancake-report-updated">{page.last_sync_at?'Cập nhật '+new Date(page.last_sync_at).toLocaleString('vi-VN'):'Chưa đồng bộ'}</span>
    </summary>
    <div className="pancake-report-body">
      <div className="pancake-report-period">Số liệu từ {pancakePeriod(period)}</div>
      {metricErrors.length>0&&<div className="pancake-report-warning">Một số thống kê chưa lấy được: {metricErrors.map(([name,error])=>`${({pages:'hoạt động page',pages_campaigns:'chiến dịch',ads_by_id:'quảng cáo',ads_by_time:'quảng cáo theo thời gian',customer_engagements:'tương tác khách hàng',customer_engagements_hourly:'tương tác theo giờ',customer_feedbacks:'đánh giá',tags:'thẻ',users:'nhân viên',posts:'bài đăng'})[name]||'đánh giá'} (${error})`).join(' · ')}.</div>}
      <div className="pancake-report-kpis">{summary.map(item=><div className={`pancake-report-kpi ${item.tone}`} key={item.label}><span>{item.label}</span><b>{item.value}</b><small>Trong kỳ</small></div>)}</div>
      <div className="pancake-report-section-title"><h3>Xu hướng theo tuần</h3><span>Số liệu cộng theo ngày trong kỳ</span></div>
      <div className="pancake-report-trends">
        <PancakeTrendCard title="Khách hàng mới" values={pancakeWeekBars(totals.pageRows,'new_customer_count',period)} available={totals.hasPageStats}/>
        <PancakeTrendCard title="Hội thoại mới" values={pancakeWeekBars(totals.pageRows,'new_inbox_count',period)} available={totals.hasPageStats}/>
        <PancakeTrendCard title="Số điện thoại thu được" values={pancakeWeekBars(totals.pageRows,'phone_number_count',period)} available={totals.hasPageStats}/>
      </div>
      <div className="pancake-report-detail-grid">
        <PancakeReportTable title="Hoạt động page" note="Tổng hợp số liệu trong kỳ" rows={pageRows} columns={[{key:'label',label:'Chỉ số'},{key:'value',label:'Số lượng',render:row=>compactNumber(row.value)}]} empty={page.errors?.pages||'Chưa có số liệu page trong kỳ này.'}/>
        <PancakeReportTable title="Tương tác khách hàng" note="Tổng hội thoại, bình luận và đơn hàng" rows={seriesAvailable?(page.metrics?.customer_engagements?.data?.series||[]).map(row=>({name:({inbox:'Hội thoại qua inbox',comment:'Tương tác qua bình luận',total:'Tổng tương tác',new_customer_replied:'Khách mới đã được phản hồi',customer_engagement_new_inbox:'Khách mở hội thoại mới',order_count:'Đơn hàng tạo mới',old_order_count:'Đơn từ khách quay lại'})[row.name]||row.name,value:(row.data||[]).reduce((sum,value)=>sum+pancakeNumber(value),0)})):[]} columns={[{key:'name',label:'Hoạt động'},{key:'value',label:'Số lượng',render:row=>compactNumber(row.value)}]} empty={page.errors?.customer_engagements||'Chưa có dữ liệu tương tác trong kỳ này.'}/>
        <PancakeReportTable title="Hiệu suất nhân viên" note="Tin nhắn, bình luận và đơn hàng được xử lý" rows={staffRows} columns={[{key:'name',label:'Nhân viên'},{key:'inbox',label:'Hội thoại',render:row=>compactNumber(row.inbox)},{key:'comments',label:'Bình luận',render:row=>compactNumber(row.comments)},{key:'orders',label:'Đơn hàng',render:row=>compactNumber(row.orders)},{key:'phones',label:'SĐT',render:row=>compactNumber(row.phones)},{key:'response',label:'Phản hồi TB',render:row=>pancakeAverageResponse(row.response)}]} empty={page.errors?.users||page.errors?.customer_engagements||'Chưa có dữ liệu nhân viên trong kỳ này.'}/>
        <PancakeReportTable title="Bài đăng nổi bật" note="Xếp theo tổng bình luận và cảm xúc" rows={topPosts.map((post,index)=>({...post,title:`${({video:'Video',photo:'Ảnh',text:'Bài viết',livestream:'Livestream',rating:'Đánh giá'})[pancakePostType(post)]||'Bài đăng'} ${index+1}`,date:pancakeDate(post.inserted_at),url:pancakePostLink(post)}))} columns={[{key:'title',label:'Bài đăng',render:row=><span><b>{row.url?<a className="pancake-post-link" href={row.url} target="_blank" rel="noreferrer">{row.title} ↗</a>:row.title}</b><small className="pancake-cell-subtitle">{row.date}{row.url?' · Có link video/bài đăng':''}</small></span>},{key:'comment_count',label:'Bình luận',render:row=>compactNumber(row.comment_count)},{key:'interactions',label:'Cảm xúc',render:row=>compactNumber(row.interactions)}]} empty={page.errors?.posts||'Chưa có bài đăng trong kỳ này.'}/>
        <PancakeReportTable title="Hiệu quả quảng cáo" note="Theo từng quảng cáo" rows={adRows} columns={[{key:'name',label:'Quảng cáo',render:row=>row.name||`Quảng cáo ${row.id+1}`},{key:'status',label:'Trạng thái',render:row=>pancakeStatusLabel(row.status)},{key:'reach',label:'Tiếp cận',render:row=>compactNumber(pancakeNumber(row.reach))},{key:'impressions',label:'Hiển thị',render:row=>compactNumber(pancakeNumber(row.impressions))},{key:'spend',label:'Chi tiêu',render:row=>pancakeCurrency(row.spend,row.currency)}]} empty={page.errors?.ads_by_id||'Chưa có số liệu quảng cáo trong kỳ này.'}/>
        <PancakeReportTable title="Chiến dịch quảng cáo" note="Ngân sách và trạng thái chiến dịch" rows={campaignRows} columns={[{key:'adset_id',label:'Nhóm quảng cáo',render:row=>row.adset_id||row.ad_id||'—'},{key:'status',label:'Trạng thái',render:row=>pancakeStatusLabel(row.status)},{key:'daily_budget',label:'Ngân sách/ngày',render:row=>pancakeCurrency(row.daily_budget,row.currency)},{key:'budget_remaining',label:'Còn lại',render:row=>pancakeCurrency(row.budget_remaining,row.currency)}]} empty={page.errors?.pages_campaigns||'Chưa có chiến dịch trong kỳ này.'}/>
        <PancakeReportTable title="Thẻ hội thoại" note="Số lượt sử dụng thẻ trong kỳ" rows={tags} columns={[{key:'name',label:'Thẻ'},{key:'count',label:'Lượt dùng',render:row=>compactNumber(row.count)}]} empty={page.errors?.tags||'Chưa có số liệu thẻ trong kỳ này.'}/>
        <PancakeReportTable title="Đánh giá khách hàng" note={feedback.available?`${compactNumber(feedback.count)} lượt đánh giá · trung bình ${feedback.hasAverage?feedback.average.toFixed(1):'—'} / 5 sao`:'Điểm hài lòng và phản hồi trong kỳ'} rows={feedback.people} columns={[{key:'name',label:'Nhân viên'},{key:'count',label:'Lượt đánh giá',render:row=>compactNumber(row.count)},{key:'average',label:'Điểm TB',render:row=>row.count?`${row.average.toFixed(1)} / 5`:'—'},{key:'automatic',label:'Botcake',render:row=>compactNumber(row.automatic)}]} empty={page.errors?.customer_feedbacks||'Chưa có đánh giá khách hàng trong kỳ này.'}/>
        {timeAdRows.length>0&&<PancakeReportTable title="Quảng cáo theo thời điểm" note="Hiển thị và chi tiêu theo mốc Pancake trả về" rows={timeAdRows} columns={[{key:'label',label:'Mốc thời gian'},{key:'reach',label:'Tiếp cận',render:row=>compactNumber(pancakeNumber(row.reach))},{key:'impressions',label:'Hiển thị',render:row=>compactNumber(pancakeNumber(row.impressions))},{key:'spend',label:'Chi tiêu',render:row=>pancakeCurrency(row.spend,row.currency)}]}/>}
      </div>
      {feedback.available&&Object.keys(feedback.ratings).length>0&&<div className="pancake-rating-summary"><b>Phân bố sao</b>{[5,4,3,2,1].map(rating=><span key={rating}>★ {rating} <b>{compactNumber(feedback.ratings[String(rating)]||0)}</b></span>)}</div>}
    </div>
  </details>
}

function PancakePageComparison({pages,usersByEmail,reportsByPage,period,onSelect}) {
  if(pages.length<2) return null
  const rows=pages.map(page=>({page,totals:reportsByPage.get(page.page_id),person:usersByEmail.get(page.email)?.name||'Chưa gán'})).sort((a,b)=>b.totals.customers-a.totals.customers)
  return <section className="pancake-page-comparison">
    <div className="pancake-report-section-title"><h3>So sánh nhanh các page</h3><span>{pancakePeriod(period)} · cùng một kỳ dữ liệu</span></div>
    <div className="pancake-report-table-scroll"><table><thead><tr><th>PAGE</th><th>KHÁCH MỚI</th><th>HỘI THOẠI MỚI</th><th>SỐ ĐIỆN THOẠI</th><th>VIDEO</th><th>BÌNH LUẬN</th></tr></thead><tbody>{rows.map(({page,totals,person})=><tr key={page.page_id}><td><button type="button" className="pancake-page-link" onClick={()=>onSelect?.(page.page_id)}>{page.page_name||page.page_id}</button><small className="pancake-cell-subtitle">{person}</small></td><td>{totals.hasPageStats?compactNumber(totals.customers):'—'}</td><td>{totals.hasPageStats?compactNumber(totals.inboxes):'—'}</td><td>{totals.hasPageStats?compactNumber(totals.phones):'—'}</td><td>{totals.hasPosts?compactNumber(totals.videos):'—'}</td><td>{totals.hasPosts?compactNumber(totals.comments):'—'}</td></tr>)}</tbody></table></div>
  </section>
}

function PancakeMetricsModal({page,user,totals,period,onClose}) {
  return <Modal title={page.page_name||page.page_id} className="pancake-report-modal" onClose={onClose}>
    <PancakeMetricsPage page={page} user={user} totals={totals} period={period} modal/>
  </Modal>
}

function PancakeConnectionStatus({status}) {
  const states={
    connected:['connected','Đã kết nối'],
    needs_reconnect:['reconnect','Cần kết nối lại'],
    not_visible:['unavailable','Không còn thấy'],
    error:['error','Lỗi kết nối'],
  }
  const [tone,label]=states[status]||states.error
  return <span className={`pancake-connection-status ${tone}`}><i/>{label}</span>
}

function pancakeUserFacingError(message) {
  return /page access token/i.test(message||'')?'Token đã lưu không dùng được. Bấm “Cập nhật token” để cấp lại tự động.':message
}

function PancakeConnectModal({onClose,onConnect}) {
  const [token,setToken]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [result,setResult]=useState(null)
  const submit=async e=>{
    e.preventDefault()
    setError('')
    setBusy(true)
    try { setResult(await onConnect(token)); setToken('') } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const summary=result?.summary
  return <Modal title="Kết nối Pancake" onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <label>User Access Token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Dán User Access Token" required/></label>
      <div className="pancake-token-guide">
        <b>Cách lấy token trong Pancake</b>
        <ol><li>Đăng nhập vào Pancake.</li><li>Mở <b>Tài khoản → Cài đặt cá nhân</b>.</li><li>Sao chép mục <b>API Access Token</b> rồi dán vào ô phía trên.</li></ol>
        <p>Chỉ cần User Access Token. DailyTask sẽ tự kết nối các page và bảo vệ thông tin xác thực của từng page.</p>
        <a href="https://developer.pancake.biz/" target="_blank" rel="noreferrer">Xem tài liệu Pancake</a>
      </div>
      {error&&<div className="form-error">{pancakeUserFacingError(error)}</div>}
      {summary&&<div className="connect-result"><b>{summary.found} page tìm thấy</b><span>{summary.reused} giữ nguyên · {summary.created} tạo mới · {summary.refreshed} cấp lại · {summary.not_visible} không còn thấy</span>{result.status?.pages?.map(page=><div className="pancake-result-row" key={page.page_id}><code>{page.page_id}</code><span>{page.page_name||'Page không tên'}</span><PancakeConnectionStatus status={page.status}/></div>)}</div>}
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Đóng</button><button className="primary-button" disabled={busy}>{busy?'Đang kiểm tra…':'Lấy page ID & kết nối'}</button></div>
    </form>
  </Modal>
}

function PancakePageRow({page,users,onMap,onUnmap}) {
  const [email,setEmail]=useState(page.assigned_email||'')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const actionsMenu=useRef(null)
  useEffect(()=>setEmail(page.assigned_email||''),[page.assigned_email])
  const map=async(nextEmail=email,force=false)=>{
    if(!nextEmail||(!force&&nextEmail===(page.assigned_email||''))) return
    setError('')
    setBusy(true)
    try { await onMap({page_id:page.page_id,page_name:page.page_name,email:nextEmail}) }
    catch (e) { setError(e.message); setEmail(page.assigned_email||'') }
    finally { setBusy(false) }
  }
  const unmap=async()=>{
    setError('')
    setBusy(true)
    try { await onUnmap(page.page_id) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const chooseUser=e=>{
    const nextEmail=e.target.value
    setEmail(nextEmail)
    if(nextEmail) void map(nextEmail)
  }
  const closeMenu=()=>{if(actionsMenu.current) actionsMenu.current.open=false}
  const lastError=pancakeUserFacingError(page.last_error)
  return <div className="pancake-page-row">
    <div className="pancake-page-copy"><code>{page.page_id}</code><b>{page.page_name||'Page không tên'}</b><small>{page.platform||'pancake'}{page.last_sync_at?' · '+new Date(page.last_sync_at).toLocaleString('vi-VN'):''}</small></div>
    <PancakeConnectionStatus status={page.status}/>
    <div className="pancake-page-actions">
      <select aria-label={'Nhân sự phụ trách '+page.page_id} value={email} onChange={chooseUser} disabled={busy}>
        <option value="" disabled={page.mapped}>Chọn người phụ trách</option>
        {users.map(user=><option key={user.email} value={user.email}>{user.name}</option>)}
      </select>
      <details className="pancake-row-menu" ref={actionsMenu}>
        <summary aria-label={'Thao tác với '+(page.page_name||page.page_id)}><Icon name="more"/></summary>
        <div className="pancake-row-menu-items">
          <button type="button" onClick={()=>{closeMenu();void map(email,true)}} disabled={busy||!email}>Cập nhật</button>
          {page.mapped&&<button type="button" className="danger" onClick={()=>{closeMenu();void unmap()}} disabled={busy}>Gỡ gán</button>}
        </div>
      </details>
    </div>
    {busy&&<small className="pancake-row-feedback saving" role="status">Đang lưu người phụ trách…</small>}
    {page.metric_error_count>0&&<small className="pancake-row-feedback">{page.metric_error_count} nhóm thống kê chưa lấy được — xem báo cáo bên dưới.</small>}
    {lastError&&<small className="pancake-row-feedback error">{lastError}</small>}
    {error&&<small className="pancake-row-feedback error">{pancakeUserFacingError(error)}</small>}
  </div>
}

function AdminPage({data,users,loading,onRefresh,onSave,onUpdate}) {
  const [filter, setFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState('all')
  const [positionFilter, setPositionFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [showRoles, setShowRoles] = useState(false)
  const [busyEmail, setBusyEmail] = useState('')
  const currentEmail = (data.me?.email || '').toLowerCase()
  const roleLabel = role => role === 'admin' ? 'Quản trị viên' : 'Nhân viên'
  const positions = [...new Set(users.map(user => user.position?.trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'vi'))
  const roles = [...new Set(users.map(user => user.role).filter(Boolean))]
  const counts = {
    all: users.length,
    active: users.filter(user => user.active !== false).length,
    inactive: users.filter(user => user.active === false).length,
  }
  const visibleUsers = filterAdminUsers(users, { status:filter, member:memberFilter, position:positionFilter, role:roleFilter, query:search })
  const hasFilters = filter !== 'all' || memberFilter !== 'all' || positionFilter !== 'all' || roleFilter !== 'all' || search.trim() !== ''
  const clearFilters = () => { setFilter('all'); setMemberFilter('all'); setPositionFilter('all'); setRoleFilter('all'); setSearch('') }
  const changeStatus = async user => {
    if (user.email.toLowerCase() === currentEmail) return
    const nextActive = user.active === false
    if (!nextActive && !window.confirm(`Khóa tài khoản ${user.name || user.email}? Người này sẽ không thể đăng nhập.`)) return
    setBusyEmail(user.email)
    try { await onUpdate(user.email, { active: nextActive }) } catch {} finally { setBusyEmail('') }
  }

  return <div className="admin-page">
    <PageHeading eyebrow="WORKSPACE SETTINGS" title="Quản trị thành viên" description="Thêm người vào workspace, phân vai trò và kiểm soát quyền truy cập." action={<button className="primary-button" onClick={() => setEditor({mode:'create'})}><Icon name="plus"/> Thêm thành viên</button>}/>
    <section className="admin-role-guide panel" id="admin-role-guide" hidden={!showRoles}>
      <div><span className="eyebrow">QUYỀN DỄ HIỂU</span><h2>Chọn vai trò theo việc người đó cần làm</h2><p><b>Vị trí</b> mô tả chuyên môn như Content, Media hoặc Ads; <b>Vai trò</b> mới quyết định quyền truy cập.</p></div>
      <div className="admin-role-cards">
        <article><span className="admin-role-icon purple">⚙</span><div><b>Quản trị viên</b><small>Quản lý thành viên, kế hoạch, lịch, lương và kênh.</small></div></article>
        <article><span className="admin-role-icon green">✓</span><div><b>Nhân viên</b><small>Xem và cập nhật công việc, kế hoạch và nội dung được giao.</small></div></article>
      </div>
    </section>
    <section className="panel table-panel admin-members-panel">
      <div className="table-toolbar admin-toolbar"><div><h2>Danh sách thành viên</h2><p>Chỉ người có quyền Quản trị viên mới thấy và thay đổi phần này.</p></div><div className="admin-toolbar-actions"><label className="member-search"><Icon name="search"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm tên hoặc email" aria-label="Tìm tên hoặc email thành viên"/></label><button className="secondary-button" onClick={() => setShowRoles(value => !value)}>{showRoles ? 'Ẩn hướng dẫn' : 'Xem quyền'} <span>⌄</span></button><button className="icon-button" onClick={() => onRefresh().catch(() => {})} disabled={loading} title="Làm mới danh sách" aria-label="Làm mới danh sách">↻</button></div></div>
      <div className="admin-filters" role="tablist" aria-label="Lọc theo trạng thái">{[['all','Tất cả'],['active','Đang hoạt động'],['inactive','Đã khóa']].map(([key,label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)} role="tab" aria-selected={filter === key}>{label} <b>{counts[key]}</b></button>)}</div>
      <div className="admin-filter-controls">
        <label>Thành viên<select value={memberFilter} onChange={event => setMemberFilter(event.target.value)}><option value="all">Tất cả thành viên</option>{users.map(user => <option key={user.email} value={user.email}>{user.name || user.email}</option>)}</select></label>
        <label>Vị trí<select value={positionFilter} onChange={event => setPositionFilter(event.target.value)}><option value="all">Tất cả vị trí</option>{positions.map(position => <option key={position} value={position}>{position}</option>)}{users.some(user => !user.position?.trim()) && <option value="__empty__">Chưa có vị trí</option>}</select></label>
        <label>Vai trò<select value={roleFilter} onChange={event => setRoleFilter(event.target.value)}><option value="all">Tất cả vai trò</option>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
        <span className="admin-filter-result">Hiển thị {visibleUsers.length}/{users.length} thành viên</span>
        {hasFilters && <button className="text-button admin-clear-filters" onClick={clearFilters}>Xóa bộ lọc</button>}
      </div>
      {loading && <div className="admin-empty"><span className="loader"/> Đang tải danh sách thành viên…</div>}
      {!loading && <div className="simple-table admin-table"><div className="table-head"><span>THÀNH VIÊN</span><span>EMAIL</span><span>VỊ TRÍ</span><span>VAI TRÒ</span><span>TRẠNG THÁI</span><span>THAO TÁC</span></div>{visibleUsers.map(user => { const isSelf = user.email.toLowerCase() === currentEmail; const busy = busyEmail === user.email; return <div className="table-row" key={user.email}><span className="title-cell"><Avatar user={user}/><b>{user.name || 'Chưa đặt tên'}</b>{isSelf && <small className="self-label">Bạn</small>}</span><span>{user.email}</span><span>{user.position || '—'}</span><span>{roleLabel(user.role)}</span><Status value={user.active === false ? 'Đã khóa' : 'Đang hoạt động'}/><span className="admin-member-actions"><button className="row-action" onClick={() => setEditor({mode:'edit', user, isSelf})} disabled={busy} title="Sửa tên, vị trí, vai trò và mật khẩu">Sửa</button><button className="row-action danger" onClick={() => void changeStatus(user)} disabled={isSelf || busy} title={isSelf ? 'Bạn không thể khóa tài khoản của mình' : user.active === false ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}>{busy ? '…' : user.active === false ? 'Mở khóa' : 'Khóa'}</button></span></div>})}{visibleUsers.length === 0 && <div className="admin-empty">Không tìm thấy thành viên phù hợp.</div>}</div>}
    </section>
    {editor && <MemberModal member={editor.mode === 'edit' ? editor.user : null} isSelf={editor.isSelf} onClose={() => setEditor(null)} onSave={async form => { await onSave(form); setEditor(null) }}/>}
  </div>
}

function MemberModal({member,isSelf,onClose,onSave}) {
  const editing = Boolean(member)
  const [form,setForm] = useState(editing ? { originalEmail:member.email, email:member.email, name:member.name || '', position:member.position || '', role:member.role || 'staff', password:'' } : { name:'', email:'', position:'', role:'staff', password:'' })
  const [saving,setSaving] = useState(false)
  const change=(key,value)=>setForm(current=>({...current,[key]:value}))
  const submit=async event=>{ event.preventDefault(); setSaving(true); try { await onSave(form) } catch {} finally { setSaving(false) } }
  return <Modal title={editing ? 'Cập nhật thành viên' : 'Thêm thành viên'} onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <label>Họ và tên<input autoFocus value={form.name} onChange={event=>change('name',event.target.value)} placeholder="Ví dụ: Nguyễn Minh An" required/></label>
    {editing ? <label>Email đăng nhập<input value={form.email} readOnly/></label> : <label>Email đăng nhập<input type="email" value={form.email} onChange={event=>change('email',event.target.value)} placeholder="ten@congty.vn" required/></label>}
    <label>Vị trí trong team<input value={form.position} onChange={event=>change('position',event.target.value)} placeholder="Ví dụ: Content, Media, Ads"/><small className="form-help">Giúp phân công đúng chuyên môn; không thay đổi quyền truy cập.</small></label>
    <label>Vai trò<select value={form.role} onChange={event=>change('role',event.target.value)} disabled={isSelf}><option value="staff">Nhân viên — làm việc theo phần được giao</option><option value="admin">Quản trị viên — quản lý workspace</option></select>{isSelf && <small className="form-help">Bạn đang đăng nhập bằng tài khoản này nên không thể đổi vai trò tại đây.</small>}</label>
    {editing ? <label>Mật khẩu mới (tùy chọn)<input type="password" minLength="8" maxLength="72" value={form.password} onChange={event=>change('password',event.target.value)} placeholder="Để trống nếu không đổi"/><small className="form-help">Dùng khi cần cấp lại mật khẩu cho thành viên.</small></label> : <label>Mật khẩu tạm thời<input type="password" minLength="8" maxLength="72" value={form.password} onChange={event=>change('password',event.target.value)} placeholder="Ít nhất 8 ký tự" required/><small className="form-help">Gửi mật khẩu này cho thành viên qua kênh riêng.</small></label>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
  </form></Modal>
}

function TaskModal({task,users,me,onClose,onSave,initialAssignee}) {
  const editing=Boolean(task)
  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('')
  const [form,setForm]=useState(()=>editing?{id:task.id,title:task.title||'',assignee:task.assignee,due:task.due||'',due_date:task.due_date||'',priority:task.priority||'Vừa',qty:task.qty||1,kpi_key:task.kpi_key||''}:{title:'',assignee:(me?.isLeader&&users.some(u=>u.email===initialAssignee)?initialAssignee:me?.email)||users[0]?.email||'',due:'',due_date:'',priority:'Vừa',qty:1,kpi_key:''})
  const change=(key,value)=>setForm(f=>({...f,[key]:value}))
  const submit=async e=>{e.preventDefault();if(saving)return;setSaving(true);setSaveError('');try{await onSave(form)}catch(error){setSaveError(error.message)}finally{setSaving(false)}}
  const canAssign=Boolean(me?.isLeader)
  return <Modal title={editing?'Cập nhật công việc':'Tạo công việc mới'} onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Tên công việc<input autoFocus value={form.title} onChange={e=>change('title',e.target.value)} placeholder="Ví dụ: Hoàn thiện kế hoạch tuần" required/></label><div className="form-two"><label>Người phụ trách{canAssign?<select value={form.assignee} onChange={e=>change('assignee',e.target.value)}>{users.map(u=><option value={u.email} key={u.email}>{u.name}</option>)}</select>:<input value={users.find(u=>u.email===form.assignee)?.name||me?.name||me?.email||''} readOnly/>}</label><label>Ngày đến hạn<input type="date" value={form.due_date} onChange={e=>change('due_date',e.target.value)}/></label></div><label>Ưu tiên<select value={form.priority} onChange={e=>change('priority',e.target.value)}><option>Cao</option><option>Vừa</option><option>Thấp</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>{saveError&&<p role="alert" className="form-error">{saveError}</p>}<button className="primary-button" disabled={saving}>{saving?'Đang lưu…':editing?'Lưu thay đổi':'Tạo công việc'}</button></div></form></Modal>
}

function PlanModal({plan,channels=[],users,me,onClose,onSave}) {
  const editing=Boolean(plan)
  const channelOptions=[...new Set([...channels,plan?.channel || ''].map(channel => (channel || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'))
  const initialChannel=editing ? (plan.channel || '').trim() : (channelOptions.includes('Daily Stories') ? 'Daily Stories' : (channelOptions[0] || ''))
  const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('')
  const [channelMode,setChannelMode]=useState('select')
  const previousChannel=useRef(initialChannel)
  const [form,setForm]=useState(()=>editing?{id:plan.id,channel:initialChannel,month:plan.month||dateWindow().today.slice(0,7),pillar:plan.pillar||'',key:plan.key||'',demo_date:plan.demo_date||'',post_date:plan.post_date||'',message:plan.message||'',assignee:plan.assignee||me?.email||'',status:plan.status||'Chưa thực hiện'}:{channel:initialChannel,month:dateWindow().today.slice(0,7),pillar:'',key:'',demo_date:'',post_date:'',message:'',assignee:me?.email||users[0]?.email||''})
  const change=(key,value)=>setForm(f=>({...f,[key]:value}))
  const selectChannel=value=>{previousChannel.current=value;setChannelMode('select');change('channel',value)}
  const addChannel=()=>{previousChannel.current=form.channel;setChannelMode('new');change('channel','')}
  const cancelNewChannel=()=>{setChannelMode('select');change('channel',previousChannel.current || channelOptions[0] || '')}
  const submit=async e=>{e.preventDefault();if(saving)return;const payload={...form,channel:(form.channel||'').trim()};if(channelMode==='new'&&!payload.channel){setSaveError('Nhập tên Kênh mới');return}setSaving(true);setSaveError('');try{await onSave(payload)}catch(error){setSaveError(error.message)}finally{setSaving(false)}}
  const canAssign=Boolean(me?.isLeader)
  return <Modal title={editing?'Chỉnh sửa nội dung':'Thêm nội dung vào kế hoạch'} onClose={onClose}><form className="modal-form" onSubmit={submit}><label>Content Pillar<input autoFocus value={form.pillar} onChange={e=>change('pillar',e.target.value)} placeholder="Ví dụ: Behind the scenes" required/></label><label>Ý tưởng / Key<input value={form.key} onChange={e=>change('key',e.target.value)} placeholder="Mô tả ngắn nội dung"/></label><div className="form-two"><label>Kênh<div className="channel-picker"><select value={channelMode==='new' ? '' : form.channel} onChange={e=>selectChannel(e.target.value)}><option value="">{channelOptions.length ? 'Chọn Kênh' : 'Chưa có Kênh'}</option>{channelOptions.map(channel=><option value={channel} key={channel}>{channel}</option>)}</select><button type="button" className="secondary-button channel-add-button" onClick={addChannel} aria-label="Thêm Kênh mới" title="Thêm Kênh mới">＋</button></div>{channelMode==='new'&&<div className="channel-picker-new"><input autoFocus value={form.channel} onChange={e=>change('channel',e.target.value)} placeholder="Nhập tên Kênh mới" required={channelMode==='new'}/><button type="button" className="text-button" onClick={cancelNewChannel}>Hủy</button></div>}</label><label>Người phụ trách{canAssign?<select value={form.assignee} onChange={e=>change('assignee',e.target.value)}>{users.map(u=><option value={u.email} key={u.email}>{u.name}</option>)}</select>:<input value={users.find(u=>u.email===form.assignee)?.name||me?.name||me?.email||''} readOnly/>}</label></div><div className="form-two"><label>Ngày gửi demo<input type="date" value={form.demo_date} onChange={e=>change('demo_date',e.target.value)}/></label><label>Ngày đăng<input type="date" value={form.post_date} onChange={e=>change('post_date',e.target.value)}/></label></div><label>Thông điệp<textarea value={form.message} onChange={e=>change('message',e.target.value)} rows="3" placeholder="Thông điệp chính của nội dung"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Huỷ</button>{saveError&&<p role="alert" className="form-error">{saveError}</p>}<button className="primary-button" disabled={saving}>{saving?'Đang lưu…':editing?'Lưu thay đổi':'Thêm vào kế hoạch'}</button></div></form></Modal>
}

function Modal({title,onClose,children,className='',portal=true}) {
  const dialog=useRef(null)
  useEffect(()=>{const node=dialog.current;node.showModal();return()=>node.close()},[])
  const content=<dialog ref={dialog} className={`modal-card work-form-dialog ${className}`} aria-label={title} onCancel={onClose} onClick={e=>e.target===e.currentTarget&&onClose()}><div className="modal-title"><div><span className="eyebrow">DAILYTASK</span><h2>{title}</h2></div><button className="icon-button" aria-label="Đóng" onClick={onClose}>×</button></div>{children}</dialog>
  return portal ? createPortal(content, document.body) : content
}

export default App
