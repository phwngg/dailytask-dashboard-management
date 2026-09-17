import { useEffect, useRef, useState } from 'react'
import { pancakeTopPosts } from './pancakeTopPosts.js'

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
  const response = await fetch('/api' + path, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  })
  const body = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(body?.error || 'Không thể xử lý yêu cầu')
  return body
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
  const [page, setPage] = useState(initialPage)
  const [planRevision, setPlanRevision] = useState(0)
  const navigate = (key, replace = false) => {
    const path = routePaths[key] || routePaths.overview
    if (window.location.pathname !== path) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
      window.scrollTo(0,0)
    }
    setPage(key in routePaths ? key : 'overview')
  }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [demoMode, setDemoMode] = useState(!import.meta.env.PROD && import.meta.env.VITE_DEMO === 'true')
  const [modal, setModal] = useState('')
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
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
          ? current.map(user => user.email === form.originalEmail ? { ...user, name: form.name, role: form.role } : user)
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
      setData(d => ({ ...d, tasks:d.tasks.map(t => t.id === id ? { ...t, status } : t) }))
      return
    }
    try {
      await request('/tasks/' + encodeURIComponent(id), { method:'PATCH', body:JSON.stringify({ status }) })
      await load()
    } catch (e) { setError(e.message) }
  }

  const saveTask = async form => {
    if (demoMode) {
      setData(d => ({ ...d, tasks:[{ id:crypto.randomUUID(), status:'todo', ...form }, ...d.tasks] }))
      setModal('')
      return
    }
    try {
      await request('/tasks', { method:'POST', body:JSON.stringify(form) })
      setModal('')
      await load()
    } catch (e) { setError(e.message) }
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
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div className="loading-screen"><span className="loader"/><span>Đang tải DailyTask</span></div>
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
          <div className="help-card"><span className="help-icon">✦</span><b>Cần trợ giúp?</b><p>Xem hướng dẫn sử dụng DailyTask.</p><button onClick={() => setError('Hướng dẫn sẽ được bổ sung.')}>Mở trung tâm trợ giúp <Icon name="chevron"/></button></div>
          <button className="profile-row" onClick={logout}><Avatar user={data.me}/><span className="profile-text"><b>{data.me?.name || 'Thành viên'}</b><small>{data.me?.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}</small></span><Icon name="logout"/></button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><button onClick={() => navigate('overview')}>Daily Studio</button><Icon name="chevron"/><b>{current}</b></div>
          <div className="top-actions">
            <label className="search-box"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm công việc, nội dung..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification"><Icon name="bell"/><i/></button>
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
          {page === 'overview' && <Overview data={data} go={navigate} onStatus={updateTask} demo={demoMode}/>}
          {page === 'plan' && <PlanPage data={data} onAdd={()=>setModal('plan')} query={query} onQueryChange={setQuery} demoMode={demoMode} refreshKey={planRevision}/>}
          {page === 'tasks' && <TaskPage data={data} onAdd={()=>setModal('task')} onStatus={updateTask} query={query}/>}
          {page === 'shifts' && <ShiftPage data={data}/> }
          {page === 'calendar' && <CalendarPage data={data}/>}
          {page === 'payroll' && <PayrollPage data={data} onCompute={computePayroll} demo={demoMode}/>}
          {page === 'channels' && <ChannelPage data={data} demo={demoMode} onConnect={connectPancake} onSync={syncPancake} onLoadMetrics={loadPancakeMetrics} onMap={mapPancakeChannel} onUnmap={unmapPancakeChannel}/>}
          {page === 'admin' && <AdminPage data={data} users={adminUsers || data.users || []} loading={adminLoading} onRefresh={refreshAdminUsers} onSave={saveAdminUser} onUpdate={updateAdminUser}/>}
        </div>
      </main>
      {modal === 'task' && <TaskModal users={data.users || []} me={data.me} onClose={()=>setModal('')} onSave={saveTask}/>}
      {modal === 'plan' && <PlanModal users={data.users || []} onClose={()=>setModal('')} onSave={savePlan}/>}
    </div>
  )
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

function Overview({data,go,onStatus,demo}) {
  const tasks=data.tasks||[], open=tasks.filter(t=>t.status!=='done'), done=tasks.length-open.length
  const late=tasks.filter(t=>t.status!=='done'&&/hôm nay/i.test(t.due||'')).length
  const pending=(data.contentPlan||[]).filter(p=>p.status!=='Đã đăng').slice(0,3)
  return <div>
    <PageHeading eyebrow={today.toLocaleUpperCase('vi-VN')} title={'Chào buổi sáng, '+(data.me?.name||'bạn')+' 👋'} description="Đây là những gì đang diễn ra trong workspace hôm nay." action={<button className="secondary-button" onClick={()=>go('plan')}><Icon name="calendar"/> Xem lịch tuần</button>}/>
    <div className="metric-grid">
      <Metric label="Công việc đang mở" value={open.length} delta={demo?"+12.8%":""} color="purple" icon="▤"/>
      <Metric label="Hoàn thành tuần này" value={done} delta={demo?"+8.4%":""} color="green" icon="✓"/>
      <Metric label="Nội dung chờ duyệt" value={data.pendingPlanCount ?? pending.length} delta={demo?"2 mới":""} color="orange" icon="◷"/>
      <Metric label="Tiến độ KPI trung bình" value={demo?"86%":"—"} delta={demo?"+5.2%":""} color="blue" icon="◉"/>
    </div>
    <div className="content-grid overview-grid">
      <section className="panel welcome-panel">
        <div className="panel-heading"><div><span className="eyebrow">TUẦN NÀY</span><h2>Tiến độ công việc</h2></div><button className="dots-button"><Icon name="more"/></button></div>
        <div className="progress-main"><div><strong>{tasks.length ? Math.round(done/tasks.length*100) : 0}%</strong><span>hoàn thành</span></div><div className="progress-ring"><div><b>{done}<small>/{tasks.length}</small></b><span>đầu việc</span></div></div></div>
        <div className="progress-track"><i style={{width:(tasks.length?Math.round(done/tasks.length*100):0)+'%'}}/></div>
        <div className="progress-legend"><span><i className="dot purple-dot"/>Hoàn thành <b>{done}</b></span><span><i className="dot gray-dot"/>Còn lại <b>{open.length}</b></span><span><i className="dot coral-dot"/>Cần chú ý <b>{late}</b></span></div>
        <div className="team-avatars">{data.users?.slice(0,5).map(u=><Avatar key={u.email} user={u}/>)}<span className="more-avatars">+{Math.max(0,(data.users?.length||0)-5)}</span><span className="team-caption">đang cùng thực hiện</span></div>
      </section>
      <section className="panel focus-panel">
        <div className="panel-heading"><div><span className="eyebrow">TẬP TRUNG HÔM NAY</span><h2>Việc cần ưu tiên</h2></div><button className="text-button" onClick={()=>go('tasks')}>Xem tất cả <Icon name="chevron"/></button></div>
        <div className="focus-list">{tasks.filter(t=>t.status!=='done').slice(0,4).map((t,i)=><div className="focus-item" key={t.id}><button className={'task-check '+(t.status==='done'?'checked':'')} onClick={()=>onStatus(t.id,t.status==='doing'?'done':'doing')}>{t.status==='done'?'✓':''}</button><span className={'priority-line p-'+(i===0?'high':i===1?'medium':'low')}/><div className="focus-copy"><b>{t.title}</b><small>{t.due || 'Chưa đặt hạn'}</small></div><Avatar user={data.users?.find(u=>u.email===t.assignee)}/></div>)}</div>
        <button className="add-inline" onClick={()=>go('tasks')}><Icon name="plus"/> Tạo công việc mới</button>
      </section>
      <section className="panel plan-panel">
        <div className="panel-heading"><div><span className="eyebrow">NỘI DUNG</span><h2>Kế hoạch sắp tới</h2></div><button className="text-button" onClick={()=>go('plan')}>Mở kế hoạch <Icon name="chevron"/></button></div>
        <div className="simple-table"><div className="table-head"><span>CHỦ ĐỀ</span><span>KÊNH</span><span>NGÀY ĐĂNG</span><span>TRẠNG THÁI</span></div>{pending.slice(0,3).map(p=><div className="table-row" key={p.id}><span className="title-cell"><i className="table-avatar">{(p.channel||'D')[0]}</i><b>{p.key||p.pillar}</b></span><span>{p.channel}</span><span>{p.post_date}</span><Status value={p.status}/></div>)}</div>
      </section>
    </div>
  </div>
}

function Status({value}) {
  const cls=value==='Đã đăng'||value==='done'?'success':value==='Đang thực hiện'||value==='doing'?'warning':value==='Đã khóa'?'danger':value==='Chưa thực hiện'||value==='todo'?'neutral':'info'
  return <span className={'status '+cls}><i/>{value||'Chưa thực hiện'}</span>
}

function TaskPage({data,onAdd,onStatus,query}) {
  const tasks=(data.tasks||[]).filter(t=>(t.title||'').toLowerCase().includes(query.toLowerCase()))
  const groups=[['todo','Cần làm'],['doing','Đang thực hiện'],['done','Hoàn thành']]
  return <div><PageHeading eyebrow="CÔNG VIỆC" title="Checklist" description="Theo dõi đầu việc và cập nhật tiến độ của cả nhóm." action={<button className="primary-button" onClick={onAdd}><Icon name="plus"/> Tạo công việc</button>}/><div className="filter-row"><div className="filter-tabs"><button className="selected">Tất cả <b>{tasks.length}</b></button><button>Của tôi</button><button>Đến hạn</button></div><button className="secondary-button">Bộ lọc <span>⌄</span></button></div><div className="task-board">{groups.map(([status,title])=><section className="task-column" key={status}><div className="column-heading"><span><i className={'column-dot '+status}/>{title}</span><b>{tasks.filter(t=>t.status===status).length}</b><button className="dots-button"><Icon name="more"/></button></div>{tasks.filter(t=>t.status===status).map(t=><TaskCard key={t.id} task={t} users={data.users||[]} onStatus={onStatus}/>)}</section>)}</div></div>
}

function TaskCard({task,users,onStatus}) {
  const user=users.find(u=>u.email===task.assignee)
  const next=task.status==='todo'?'doing':task.status==='doing'?'done':'todo'
  return <article className="task-card"><div className="task-card-top"><span className={'priority-tag '+(task.priority==='Cao'?'high':task.priority==='Thấp'?'low':'medium')}>{task.priority||'Vừa'} ưu tiên</span><button className="dots-button"><Icon name="more"/></button></div><h3>{task.title}</h3><p>{task.description||'Chưa có mô tả cho công việc này.'}</p><div className="task-tags"><span>▤ {task.kpi_key||'Công việc'}</span></div><div className="task-card-foot"><span className="due-label"><Icon name="calendar"/>{task.due||'Chưa đặt hạn'}</span><button className="avatar-button" title={'Cập nhật: '+next} onClick={()=>onStatus(task.id,next)}><Avatar user={user}/></button></div></article>
}

function PlanPage({data,onAdd,query,onQueryChange,demoMode,refreshKey}) {
  const [filters,setFilters] = useState({channel:'',from:'',to:'',assignee:'',status:''})
  const [debouncedQuery,setDebouncedQuery] = useState(query)
  const [items,setItems] = useState([])
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
  const params = new URLSearchParams({limit:'40'})
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
            return (!q || content.includes(q)) && (!filters.channel || p.channel===filters.channel) && (!filters.from || p.post_date>=filters.from) && (!filters.to || p.post_date<=filters.to) && (!filters.assignee || p.assignee===filters.assignee) && (!filters.status || p.status===filters.status)
          })
          result = {items:filtered.slice(0,40),total:filtered.length,channels:[...new Set((data.contentPlan||[]).map(p=>p.channel).filter(Boolean))],statuses:[...new Set((data.contentPlan||[]).map(p=>p.status).filter(Boolean))],hasMore:false,stats:{total:filtered.length,published:filtered.filter(p=>p.status==='Đã đăng').length,in_progress:filtered.filter(p=>p.status==='Đang thực hiện').length,planned:filtered.filter(p=>p.status==='Chưa thực hiện').length,by_status:Object.fromEntries([...new Set(filtered.map(p=>p.status))].map(status=>[status,filtered.filter(p=>p.status===status).length]))}}
        } else result = await request('/plans?'+filterKey)
        if (current !== generation.current) return
        setItems(result.items||[])
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
  return <div>
    <PageHeading eyebrow="LỊCH BIÊN TẬP" title="Kế hoạch nội dung" description="Lập kế hoạch, phân công và theo dõi lịch xuất bản." action={<button className="primary-button" onClick={onAdd}><Icon name="plus"/> Thêm nội dung</button>}/>
    <section className="plan-stats" aria-label="Thống kê theo bộ lọc">
      <div><span>Tổng nội dung khớp lọc</span><b>{stats.total}</b></div>{Object.entries(stats.by_status||{}).map(([status,count])=><div key={status}><span>{status||'Chưa đặt trạng thái'}</span><b>{count}</b></div>)}
    </section>
    <section className="panel plan-filter-panel">
      <div className="plan-filter-heading"><div><h2>Lọc nội dung</h2><span>{items.length} / {total} kết quả đang tải</span></div><button className="text-button" onClick={()=>{onQueryChange('');setFilters({channel:'',from:'',to:'',assignee:'',status:''})}}>Xóa bộ lọc</button></div>
      <div className="plan-filter-grid">
        <label className="plan-search-field">Nội dung<input type="search" value={query} onChange={e=>onQueryChange(e.target.value)} placeholder="Tìm chủ đề, key, mô tả..."/></label>
        <label>Kênh<select value={filters.channel} onChange={e=>setFilters(f=>({...f,channel:e.target.value}))}><option value="">Tất cả kênh</option>{channels.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
        <label>Ngày đăng từ<input type="date" value={filters.from} onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/></label>
        <label>Đến ngày<input type="date" value={filters.to} onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/></label>
        <label>Phụ trách<select value={filters.assignee} onChange={e=>setFilters(f=>({...f,assignee:e.target.value}))}><option value="">Tất cả thành viên</option>{(data.users||[]).map(u=><option key={u.email} value={u.email}>{u.name}</option>)}</select></label>
        <label>Trạng thái<select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}><option value="">Tất cả trạng thái</option>{statuses.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      </div>
    </section>
    <section className="panel table-panel plan-results-panel"><div className="table-toolbar"><h2>Danh sách nội dung</h2><span>{items.length} / {total} nội dung</span></div>
      <div className="simple-table plan-table"><div className="table-head"><span>CONTENT PILLAR / KEY</span><span>KÊNH</span><span>DEMO</span><span>NGÀY ĐĂNG</span><span>PHỤ TRÁCH</span><span>TRẠNG THÁI</span></div>
        {items.map(p=><div className="table-row" key={p.id}><span className="plan-title"><b>{p.pillar||'Nội dung'}</b><small>{p.key}</small></span><span><i className="table-avatar">{(p.channel||'D')[0]}</i>{p.channel}</span><span>{p.demo_date||'—'}</span><span>{p.post_date||'—'}</span><span>{personName(p.assignee)}</span><Status value={p.status}/></div>)}
        {!items.length && !loading && <div className="plan-empty">{loadError?'Không tải được nội dung.':'Không tìm thấy nội dung phù hợp.'}</div>}
        {loading && !items.length && <div className="plan-empty">Đang tải nội dung…</div>}
      </div>
      {loadError && <div className="plan-load-error">{loadError}</div>}
      {hasMore && <div ref={sentinel} className="plan-load-trigger" aria-live="polite">{loadingMore?'Đang tải thêm nội dung…':<button className="secondary-button" onClick={loadMore}>Tải thêm</button>}</div>}
      {!hasMore && items.length>0 && <div className="plan-end-note">Đã hiển thị hết {total} nội dung phù hợp.</div>}
    </section>
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
  return <div><PageHeading eyebrow="TỔNG HỢP THU NHẬP" title="Lương thưởng" description="Kết quả KPI và thu nhập theo kỳ tính lương." action={<button className="secondary-button"><Icon name="calendar"/> {data.payrollMonth||'Chưa có kỳ lương'} <span>⌄</span></button>}/><div className="metric-grid three"><Metric label="Tổng quỹ lương" value={money(rows.reduce((s,r)=>s+Number(r.total||0),0))} delta="Kỳ hiện tại" color="purple" icon="₫"/><Metric label="KPI đạt trung bình" value={rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.kpi_rate||0),0)/rows.length)+'%':'—'} delta="Toàn nhóm" color="green" icon="◉"/><Metric label="Thành viên" value={rows.length} delta="Trong kỳ" color="blue" icon="♙"/></div><section className="panel table-panel"><div className="table-toolbar"><h2>Bảng lương tháng {data.payrollMonth||''}</h2><div className="flex gap-2">{canManage&&<button className="secondary-button" onClick={onCompute}>Tính lại từ Policy</button>}<button className="secondary-button">Xuất báo cáo <Icon name="arrow"/></button></div></div><div className="simple-table payroll-table"><div className="table-head"><span>THÀNH VIÊN</span><span>LƯƠNG CƠ BẢN</span><span>PHỤ CẤP</span><span>THƯỞNG / PHẠT</span><span>KPI</span><span>TỔNG NHẬN</span></div>{rows.map(r=>{const u=data.users?.find(x=>x.email===r.email);return <div className="table-row" key={r.email}><span className="title-cell"><Avatar user={u}/><b>{u?.name||r.email}</b></span><span>{money(r.base)}</span><span>{money(r.fees)}</span><span>{money(Number(r.bonus||0)-Number(r.penalty||0))}</span><span><span className="kpi-mini"><i style={{width:(r.kpi_rate||0)+'%'}}/></span>{Math.round(r.kpi_rate||0)}%</span><b>{money(r.total)}</b></div>})}</div></section>{canManage&&<PayrollPolicyPanel users={data.users||[]}/>}</div>
}

function PayrollPolicyPanel({users}) {
  const blank=()=>({id:0,email:users[0]?.email||'',code:'',label:'',type:'per_unit',input_key:'',rate:0,tiers:'',minimum:0,note:'',active:true})
  const [policies,setPolicies]=useState([])
  const [form,setForm]=useState(blank)
  const [editing,setEditing]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
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
  return <section className="panel policy-panel"><div className="table-toolbar"><div><span className="eyebrow">CẤU HÌNH TÍNH LƯƠNG</span><h2>Công thức KPI theo nhân sự</h2></div><button className="primary-button" onClick={()=>{setForm(blank());setEditing(true);setError('')}}>Thêm công thức</button></div><p className="muted policy-help">Quản lý nhập từng khoản theo người, chỉ số đầu vào và cách tính. Sau khi lưu, bấm “Tính lại từ Policy” để tạo lại snapshot kỳ lương.</p>{error&&<div className="form-error">{error}</div>}{editing&&<form className="policy-editor" onSubmit={save}><div className="form-two"><label>Nhân sự<select value={form.email} onChange={e=>change('email',e.target.value)} required>{users.map(user=><option key={user.email} value={user.email}>{user.name}</option>)}</select></label><label>Loại công thức<select value={form.type} onChange={e=>change('type',e.target.value)}>{Object.entries(payrollPolicyLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div><div className="form-two"><label>Mã công thức<input value={form.code} onChange={e=>change('code',e.target.value)} placeholder="vd: content_fee" required/></label><label>Tên hiển thị<input value={form.label} onChange={e=>change('label',e.target.value)} placeholder="vd: Phí sản xuất video" required/></label></div><div className="form-two"><label>Chỉ số đầu vào<input value={form.input_key} onChange={e=>change('input_key',e.target.value)} placeholder={form.type==='fixed'?'Không cần với lương cố định':'vd: videos'} required={form.type!=='fixed'}/></label><label>Đơn giá / tỷ lệ<input type="number" min="0" step="any" value={form.rate} onChange={e=>change('rate',e.target.value)}/></label></div><div className="form-two"><label>Mức tối thiểu<input type="number" min="0" step="any" value={form.minimum} onChange={e=>change('minimum',e.target.value)}/></label><label>Ngưỡng thưởng<input value={form.tiers} onChange={e=>change('tiers',e.target.value)} placeholder="vd: 10:500000;20:1000000"/></label></div><label>Ghi chú<textarea value={form.note} onChange={e=>change('note',e.target.value)} rows="2" placeholder="Giải thích cách tính để người rà soát hiểu."/></label><label className="checkline"><input type="checkbox" checked={form.active} onChange={e=>change('active',e.target.checked)}/> Đang áp dụng</label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setEditing(false)}>Huỷ</button><button className="primary-button" disabled={busy}>{busy?'Đang lưu…':'Lưu công thức'}</button></div></form>}<div className="simple-table policy-table"><div className="table-head"><span>NHÂN SỰ</span><span>KHOẢN TÍNH</span><span>KIỂU</span><span>ĐẦU VÀO</span><span>ĐƠN GIÁ</span><span>THAO TÁC</span></div>{policies.map(policy=><div className="table-row" key={policy.id}><span>{policy.user_name||policy.email}</span><span><b>{policy.label}</b><small>{policy.code}</small></span><span>{payrollPolicyLabels[policy.type]||policy.type}</span><span>{policy.input_key||'—'}</span><span>{money(policy.rate)}</span><button className="dots-button" onClick={()=>edit(policy)} aria-label={'Sửa '+policy.label}>Sửa</button></div>)}{!policies.length&&<div className="policy-empty">Chưa có công thức. Thêm công thức đầu tiên để bắt đầu tính.</div>}</div></section>
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

function CalendarPage({data}) {
  const entries=[...(data.shoots||[]).map(x=>({...x,kindLabel:'Quay'})),...(data.lives||[]).map(x=>({...x,kindLabel:'Livestream'})),...(data.meetings||[]).map(x=>({...x,kindLabel:'Họp'}))].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''))
  const people=value=>(value||[]).map(email=>data.users?.find(u=>u.email===email)?.name||email).join(', ')||'—'
  return <div><PageHeading eyebrow="LỊCH SẢN XUẤT" title="Lịch quay & họp" description="Các buổi quay, livestream và cuộc họp đã chuyển từ workbook cũ."/><section className="panel table-panel"><div className="table-toolbar"><h2>Lịch đã lên</h2><span>{entries.length} sự kiện</span></div><div className="simple-table plan-table"><div className="table-head"><span>SỰ KIỆN</span><span>LOẠI</span><span>NGÀY</span><span>GIỜ</span><span>ĐỊA ĐIỂM</span><span>PHỤ TRÁCH</span></div>{entries.map(e=><div className="table-row" key={e.id}><span className="plan-title"><b>{e.title}</b><small>{people(e.attendees)}</small></span><span>{e.kindLabel}</span><span>{e.date||'—'}</span><span>{e.time||'—'}</span><span>{e.location||'—'}</span><span>{data.users?.find(u=>u.email===e.lead)?.name||e.lead||'—'}</span></div>)}</div></section></div>
}

function AdminPage({data,users,loading,onRefresh,onSave,onUpdate}) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const [showRoles, setShowRoles] = useState(false)
  const [busyEmail, setBusyEmail] = useState('')
  const currentEmail = (data.me?.email || '').toLowerCase()
  const roleLabel = role => role === 'admin' ? 'Quản trị viên' : 'Nhân viên'
  const counts = {
    all: users.length,
    active: users.filter(user => user.active !== false).length,
    inactive: users.filter(user => user.active === false).length,
  }
  const visibleUsers = users.filter(user => {
    const matchesFilter = filter === 'all' || (filter === 'active' ? user.active !== false : user.active === false)
    const needle = search.trim().toLowerCase()
    const matchesSearch = !needle || [user.name, user.email, user.position, roleLabel(user.role)].some(value => String(value || '').toLowerCase().includes(needle))
    return matchesFilter && matchesSearch
  })
  const changeStatus = async user => {
    if (user.email.toLowerCase() === currentEmail) return
    const nextActive = user.active === false
    if (!nextActive && !window.confirm(`Khóa tài khoản ${user.name || user.email}? Người này sẽ không thể đăng nhập.`)) return
    setBusyEmail(user.email)
    try { await onUpdate(user.email, { active: nextActive }) } catch {} finally { setBusyEmail('') }
  }

  return <div className="admin-page">
    <PageHeading eyebrow="WORKSPACE SETTINGS" title="Quản trị thành viên" description="Thêm người vào workspace, phân vai trò và kiểm soát quyền truy cập." action={<button className="primary-button" onClick={() => setEditor({mode:'create'})}><Icon name="plus"/> Thêm thành viên</button>}/>
    <div className="summary-strip admin-summary"><span><b>{counts.all}</b> thành viên</span><span className="summary-sep"/><span><b>{counts.active}</b> đang hoạt động</span><span className="summary-sep"/><span><b>{counts.inactive}</b> đã khóa</span><span className="admin-summary-note">Khóa tài khoản không xóa dữ liệu công việc.</span></div>
    <section className="admin-role-guide panel" id="admin-role-guide" hidden={!showRoles}>
      <div><span className="eyebrow">QUYỀN DỄ HIỂU</span><h2>Chọn vai trò theo việc người đó cần làm</h2><p>Quản trị viên điều hành workspace. Nhân viên tập trung vào phần việc được giao.</p></div>
      <div className="admin-role-cards">
        <article><span className="admin-role-icon purple">⚙</span><div><b>Quản trị viên</b><small>Quản lý thành viên, kế hoạch, lịch, lương và kênh.</small></div></article>
        <article><span className="admin-role-icon green">✓</span><div><b>Nhân viên</b><small>Xem và cập nhật công việc, kế hoạch và nội dung được giao.</small></div></article>
      </div>
    </section>
    <section className="panel table-panel admin-members-panel">
      <div className="table-toolbar admin-toolbar"><div><h2>Danh sách thành viên</h2><p>Chỉ người có quyền Quản trị viên mới thấy và thay đổi phần này.</p></div><div className="admin-toolbar-actions"><label className="member-search"><Icon name="search"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm tên hoặc email" aria-label="Tìm thành viên"/></label><button className="secondary-button" onClick={() => setShowRoles(value => !value)}>{showRoles ? 'Ẩn hướng dẫn' : 'Xem quyền'} <span>⌄</span></button><button className="icon-button" onClick={() => onRefresh().catch(() => {})} disabled={loading} title="Làm mới danh sách" aria-label="Làm mới danh sách">↻</button></div></div>
      <div className="admin-filters" role="tablist" aria-label="Lọc thành viên">{[['all','Tất cả'],['active','Đang hoạt động'],['inactive','Đã khóa']].map(([key,label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)} role="tab" aria-selected={filter === key}>{label} <b>{counts[key]}</b></button>)}</div>
      {loading && <div className="admin-empty"><span className="loader"/> Đang tải danh sách thành viên…</div>}
      {!loading && <div className="simple-table admin-table"><div className="table-head"><span>THÀNH VIÊN</span><span>EMAIL</span><span>VỊ TRÍ</span><span>VAI TRÒ</span><span>TRẠNG THÁI</span><span>THAO TÁC</span></div>{visibleUsers.map(user => { const isSelf = user.email.toLowerCase() === currentEmail; const busy = busyEmail === user.email; return <div className="table-row" key={user.email}><span className="title-cell"><Avatar user={user}/><b>{user.name || 'Chưa đặt tên'}</b>{isSelf && <small className="self-label">Bạn</small>}</span><span>{user.email}</span><span>{user.position || '—'}</span><span>{roleLabel(user.role)}</span><Status value={user.active === false ? 'Đã khóa' : 'Đang hoạt động'}/><span className="admin-member-actions"><button className="row-action" onClick={() => setEditor({mode:'edit', user, isSelf})} disabled={busy} title="Sửa tên và vai trò">Sửa</button><button className="row-action danger" onClick={() => void changeStatus(user)} disabled={isSelf || busy} title={isSelf ? 'Bạn không thể khóa tài khoản của mình' : user.active === false ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}>{busy ? '…' : user.active === false ? 'Mở khóa' : 'Khóa'}</button></span></div>})}{visibleUsers.length === 0 && <div className="admin-empty">Không tìm thấy thành viên phù hợp.</div>}</div>}
    </section>
    {editor && <MemberModal member={editor.mode === 'edit' ? editor.user : null} isSelf={editor.isSelf} onClose={() => setEditor(null)} onSave={async form => { await onSave(form); setEditor(null) }}/>}
  </div>
}

function MemberModal({member,isSelf,onClose,onSave}) {
  const editing = Boolean(member)
  const [form,setForm] = useState(editing ? { originalEmail:member.email, email:member.email, name:member.name || '', role:member.role || 'staff', password:'' } : { name:'', email:'', position:'', role:'staff', password:'' })
  const [saving,setSaving] = useState(false)
  const change=(key,value)=>setForm(current=>({...current,[key]:value}))
  const submit=async event=>{ event.preventDefault(); setSaving(true); try { await onSave(form) } catch {} finally { setSaving(false) } }
  return <Modal title={editing ? 'Cập nhật thành viên' : 'Thêm thành viên'} onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <label>Họ và tên<input autoFocus value={form.name} onChange={event=>change('name',event.target.value)} placeholder="Ví dụ: Nguyễn Minh An" required/></label>
    {editing ? <label>Email đăng nhập<input value={form.email} readOnly/></label> : <label>Email đăng nhập<input type="email" value={form.email} onChange={event=>change('email',event.target.value)} placeholder="ten@congty.vn" required/></label>}
    {!editing && <label>Vị trí trong team<input value={form.position} onChange={event=>change('position',event.target.value)} placeholder="Ví dụ: Content, Media, Ads"/></label>}
    <label>Vai trò<select value={form.role} onChange={event=>change('role',event.target.value)} disabled={isSelf}><option value="staff">Nhân viên — làm việc theo phần được giao</option><option value="admin">Quản trị viên — quản lý workspace</option></select>{isSelf && <small className="form-help">Bạn đang đăng nhập bằng tài khoản này nên không thể đổi vai trò tại đây.</small>}</label>
    {editing ? <label>Mật khẩu mới (tùy chọn)<input type="password" minLength="8" maxLength="72" value={form.password} onChange={event=>change('password',event.target.value)} placeholder="Để trống nếu không đổi"/><small className="form-help">Dùng khi cần cấp lại mật khẩu cho thành viên.</small></label> : <label>Mật khẩu tạm thời<input type="password" minLength="8" maxLength="72" value={form.password} onChange={event=>change('password',event.target.value)} placeholder="Ít nhất 8 ký tự" required/><small className="form-help">Gửi mật khẩu này cho thành viên qua kênh riêng.</small></label>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
  </form></Modal>
}

function TaskModal({users,me,onClose,onSave}) {
  const [form,setForm]=useState({title:'',assignee:me?.email||users[0]?.email||'',due_date:'',priority:'Vừa',qty:1})
  const change=(key,value)=>setForm(f=>({...f,[key]:value}))
  return <Modal title="Tạo công việc mới" onClose={onClose}><form className="modal-form" onSubmit={e=>{e.preventDefault();onSave(form)}}><label>Tên công việc<input autoFocus value={form.title} onChange={e=>change('title',e.target.value)} placeholder="Ví dụ: Hoàn thiện kế hoạch tuần" required/></label><div className="form-two"><label>Người phụ trách{me?.isLeader?<select value={form.assignee} onChange={e=>change('assignee',e.target.value)}>{users.map(u=><option value={u.email} key={u.email}>{u.name}</option>)}</select>:<input value={me?.name||me?.email||''} readOnly/>}</label><label>Ngày đến hạn<input type="date" value={form.due_date} onChange={e=>change('due_date',e.target.value)}/></label></div><label>Ưu tiên<select value={form.priority} onChange={e=>change('priority',e.target.value)}><option>Cao</option><option>Vừa</option><option>Thấp</option></select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Huỷ</button><button className="primary-button">Tạo công việc</button></div></form></Modal>
}

function PlanModal({users,onClose,onSave}) {
  const [form,setForm]=useState({channel:'Daily Stories',month:'2026-09',pillar:'',key:'',demo_date:'',post_date:'',message:'',assignee:users[0]?.email||''})
  const change=(key,value)=>setForm(f=>({...f,[key]:value}))
  return <Modal title="Thêm nội dung vào kế hoạch" onClose={onClose}><form className="modal-form" onSubmit={e=>{e.preventDefault();onSave(form)}}><label>Content Pillar<input autoFocus value={form.pillar} onChange={e=>change('pillar',e.target.value)} placeholder="Ví dụ: Behind the scenes" required/></label><label>Ý tưởng / Key<input value={form.key} onChange={e=>change('key',e.target.value)} placeholder="Mô tả ngắn nội dung"/></label><div className="form-two"><label>Kênh<input value={form.channel} onChange={e=>change('channel',e.target.value)}/></label><label>Người phụ trách<select value={form.assignee} onChange={e=>change('assignee',e.target.value)}>{users.map(u=><option value={u.email} key={u.email}>{u.name}</option>)}</select></label></div><div className="form-two"><label>Ngày gửi demo<input type="date" value={form.demo_date} onChange={e=>change('demo_date',e.target.value)}/></label><label>Ngày đăng<input type="date" value={form.post_date} onChange={e=>change('post_date',e.target.value)}/></label></div><label>Thông điệp<textarea value={form.message} onChange={e=>change('message',e.target.value)} rows="3" placeholder="Thông điệp chính của nội dung"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Huỷ</button><button className="primary-button">Thêm vào kế hoạch</button></div></form></Modal>
}

function Modal({title,onClose,children,className=''}) {
  useEffect(()=>{const fn=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose])
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={`modal-card ${className}`}><div className="modal-title"><div><span className="eyebrow">DAILYTASK</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>{children}</section></div>
}

export default App
