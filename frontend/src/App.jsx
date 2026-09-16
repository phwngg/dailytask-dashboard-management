import { useEffect, useRef, useState } from 'react'

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

  const syncPancake = async () => {
    setError('')
    try {
      const result = await request('/admin/pancake/sync', { method:'POST', body:'{}' })
      await load()
      return result
    } catch (e) { setError(e.message); throw e }
  }

  const mapPancakeChannel = async form => {
    setError('')
    try {
      const result = await request('/admin/channels', { method:'PUT', body:JSON.stringify(form) })
      await load()
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
          {page === 'channels' && <ChannelPage data={data} demo={demoMode} onConnect={connectPancake} onSync={syncPancake} onMap={mapPancakeChannel}/>}
          {page === 'admin' && <AdminPage data={data}/>}
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
        <div className="form-meta"><label className="checkline"><input type="checkbox"/> Ghi nhớ đăng nhập</label><button type="button" className="text-button" onClick={()=>{}}>Quên mật khẩu?</button></div>
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
function Metric({label,value,delta,color,icon}) { return <div className="metric-card"><div className="metric-top"><span>{label}</span><i className={'metric-icon '+color}>{icon}</i></div><div className="metric-value">{value}</div>{delta && <div className="metric-foot"><span>{delta}</span></div>}</div> }

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
  const cls=value==='Đã đăng'||value==='done'?'success':value==='Đang thực hiện'||value==='doing'?'warning':value==='Chưa thực hiện'||value==='todo'?'neutral':'info'
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

function PayrollPage({data,onCompute,demo}) {
  const rows=data.payroll||[]
  return <div><PageHeading eyebrow="TỔNG HỢP THU NHẬP" title="Lương thưởng" description="Kết quả KPI và thu nhập theo kỳ tính lương." action={<button className="secondary-button"><Icon name="calendar"/> {data.payrollMonth||'Chưa có kỳ lương'} <span>⌄</span></button>}/><div className="metric-grid three"><Metric label="Tổng quỹ lương" value={money(rows.reduce((s,r)=>s+Number(r.total||0),0))} delta="Kỳ hiện tại" color="purple" icon="₫"/><Metric label="KPI đạt trung bình" value={rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.kpi_rate||0),0)/rows.length)+'%':'—'} delta="Toàn nhóm" color="green" icon="◉"/><Metric label="Thành viên" value={rows.length} delta="Trong kỳ" color="blue" icon="♙"/></div><section className="panel table-panel"><div className="table-toolbar"><h2>Bảng lương tháng {data.payrollMonth||''}</h2><div className="flex gap-2">{!demo && data.me?.caps?.includes('payroll.compute') && <button className="secondary-button" onClick={onCompute}>Tính lại từ Policy</button>}<button className="secondary-button">Xuất báo cáo <Icon name="arrow"/></button></div></div><div className="simple-table payroll-table"><div className="table-head"><span>THÀNH VIÊN</span><span>LƯƠNG CƠ BẢN</span><span>PHỤ CẤP</span><span>THƯỞNG / PHẠT</span><span>KPI</span><span>TỔNG NHẬN</span></div>{rows.map(r=>{const u=data.users?.find(x=>x.email===r.email);return <div className="table-row" key={r.email}><span className="title-cell"><Avatar user={u}/><b>{u?.name||r.email}</b></span><span>{money(r.base)}</span><span>{money(r.fees)}</span><span>{money(Number(r.bonus||0)-Number(r.penalty||0))}</span><span><span className="kpi-mini"><i style={{width:(r.kpi_rate||0)+'%'}}/></span>{Math.round(r.kpi_rate||0)}%</span><b>{money(r.total)}</b></div>})}</div></section></div>
}

function compactNumber(value) {
  const n = Number(value || 0)
  if (n >= 1000000) return (n / 1000000).toFixed(n >= 10000000 ? 0 : 2).replace(/\.00$/, '') + 'M'
  if (n >= 1000) return (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + 'K'
  return n.toLocaleString('vi-VN')
}

function ChannelPage({data,demo,onConnect,onSync,onMap}) {
  const [connectOpen,setConnectOpen] = useState(false)
  const [syncing,setSyncing] = useState(false)
  const stats=data.channelStats||[]
  const pancake=data.pancake||{pages:[],configured:0,connected:0,needs_reconnect:0}
  const isAdmin=!demo && Boolean(data.me?.isAdmin||data.me?.caps?.includes('channel.sync'))
  const total=(key)=>stats.reduce((sum,row)=>sum+Number(row[key]||0),0)
  const views=demo?2840000:total('views'), followers=demo?12480:total('followers'), videos=demo?86:total('videos')
  const runSync=async()=>{
    try { setSyncing(true); await onSync() } finally { setSyncing(false) }
  }
  return <div>
    <PageHeading eyebrow="HIỆU SUẤT KÊNH" title="Chỉ số kênh" description="Theo dõi số liệu Pancake theo tháng." action={isAdmin?<button className="secondary-button" onClick={runSync} disabled={syncing}><Icon name="calendar"/> {syncing?'Đang đồng bộ…':'Đồng bộ Pancake'}</button>:<button className="secondary-button" disabled><Icon name="calendar"/> Tháng {data.currentMonth||'hiện tại'}</button>}/>
    {isAdmin && <section className="panel pancake-panel">
      <div className="panel-heading"><div><span className="eyebrow">TÍCH HỢP PANCAKE</span><h2>{pancake.configured?(pancake.connected+'/'+pancake.configured+' page đã kết nối'):'Chưa kết nối Pancake'}</h2></div><button className="primary-button" onClick={()=>setConnectOpen(true)}>Cập nhật token</button></div>
      <p className="muted pancake-help">{pancake.needs_reconnect?(pancake.needs_reconnect+' page cần kết nối lại. '):''}Token User chỉ dùng để lấy page và cấp lại page token khi cần; dữ liệu sync định kỳ dùng page token đã lưu.</p>
      {pancake.pages?.length>0 && <div className="pancake-pages">{pancake.pages.map(page=><PancakePageRow key={page.page_id} page={page} users={data.users||[]} onMap={onMap}/>)}</div>}
    </section>}
    <div className="metric-grid">
      <Metric label="Lượt xem" value={compactNumber(views)} delta={demo?'+18.2%':''} color="purple" icon="◉"/>
      <Metric label="Người theo dõi" value={compactNumber(followers)} delta={demo?'+9.6%':''} color="green" icon="♙"/>
      <Metric label="Video đã đăng" value={compactNumber(videos)} delta={demo?'+14.1%':''} color="orange" icon="▶"/>
      <Metric label="Tỷ lệ tương tác" value={demo?'6.42%':'—'} delta={demo?'+1.2%':'Chưa có field tương ứng'} color="blue" icon="⌁"/>
    </div>
    <section className="panel channel-panel"><div className="panel-heading"><div><span className="eyebrow">TĂNG TRƯỞNG</span><h2>Tổng hợp tháng {data.currentMonth||'hiện tại'}</h2></div><button className="dots-button"><Icon name="more"/></button></div><div className="chart-legend"><span><i className="legend-mark purple-mark"/>Lượt xem</span><span><i className="legend-mark coral-mark"/>Người theo dõi</span></div>{demo?<><div className="chart-area">{[35,53,42,68,56,78,62,91,76,86,70,100,81,91,72,88,67,95,80,100].map((h,i)=><i key={i} style={{height:h+'%'}}/>)}</div><div className="chart-labels"><span>Tuần 1</span><span>Tuần 2</span><span>Tuần 3</span><span>Tuần 4</span></div></>:<div className="channel-empty">{stats.length?'Đã có dữ liệu tổng hợp. Biểu đồ theo tuần sẽ mở khi lưu số liệu theo ngày.':'Chưa có số liệu thống kê cho kỳ này.'}</div>}</section>
    {!demo && <section className="panel table-panel"><div className="table-toolbar"><h2>Kênh đã cấu hình</h2><span>{data.channels?.length||0} kênh</span></div><div className="simple-table channel-mapping-table"><div className="table-head"><span>NHÂN SỰ</span><span>KÊNH</span><span>PAGE ID</span><span>NỀN TẢNG</span><span>VỊ TRÍ</span><span>TRẠNG THÁI</span></div>{(data.channels||[]).map(c=>{const u=data.users?.find(x=>x.email===c.email);return <div className="table-row" key={c.email+'-'+c.slot}><span className="title-cell"><Avatar user={u}/><b>{u?.name||c.email}</b></span><span>{c.page_name||'Đã liên kết'}</span><code className="pancake-page-id">{c.page_id||'—'}</code><span>{c.platform}</span><span>{c.slot===2?'Kênh 2':'Kênh chính'}</span><Status value="Đang hoạt động"/></div>})}</div></section>}
    <p className="muted channel-note">{demo?'Số liệu minh hoạ.':stats.length?'Video count được đồng bộ từ Pancake. Views/follower chỉ hiện nếu đã có từ nguồn trước đó.':'Chưa có ChannelStats; hãy kết nối Pancake và gán page vào kênh.'}</p>
    {connectOpen && <PancakeConnectModal onClose={()=>setConnectOpen(false)} onConnect={onConnect}/>}
  </div>
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
  return <Modal title="Kết nối Pancake" onClose={onClose}><form className="modal-form" onSubmit={submit}><label>User Access Token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="Dán token từ Pancake" required/></label><p className="form-help">Token chỉ gửi tới backend qua phiên đăng nhập. Backend không trả lại hoặc hiển thị token.</p>{error&&<div className="form-error">{error}</div>}{summary&&<div className="connect-result"><b>{summary.found} page tìm thấy</b><span>{summary.reused} giữ nguyên · {summary.created} tạo mới · {summary.refreshed} cấp lại · {summary.not_visible} không còn thấy</span>{result.status?.pages?.map(page=><div className="pancake-result-row" key={page.page_id}><code>{page.page_id}</code><span>{page.page_name||'Page không tên'}</span><Status value={page.status==='connected'?'Đã kết nối':page.status==='needs_reconnect'?'Cần kết nối lại':'Không hiển thị'}/></div>)}</div>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Đóng</button><button className="primary-button" disabled={busy}>{busy?'Đang kiểm tra…':'Lấy page ID & kết nối'}</button></div></form></Modal>
}

function PancakePageRow({page,users,onMap}) {
  const [email,setEmail]=useState(users[0]?.email||'')
  const [slot,setSlot]=useState('1')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const map=async()=>{
    setError('')
    setBusy(true)
    try { await onMap({page_id:page.page_id,page_name:page.page_name,email,slot:Number(slot)}) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="pancake-page-row"><div className="pancake-page-copy"><code>{page.page_id}</code><b>{page.page_name||'Page không tên'}</b><small>{page.platform||'pancake'}</small></div><Status value={page.status==='connected'?'Đã kết nối':page.status==='needs_reconnect'?'Cần kết nối lại':page.status==='not_visible'?'Không còn thấy':'Lỗi'}/>{page.mapped?<span className="pancake-mapped">Đã gán kênh</span>:<div className="pancake-page-actions"><select aria-label={'Nhân sự cho '+page.page_id} value={email} onChange={e=>setEmail(e.target.value)}>{users.map(user=><option key={user.email} value={user.email}>{user.name}</option>)}</select><select aria-label={'Slot cho '+page.page_id} value={slot} onChange={e=>setSlot(e.target.value)}><option value="1">Slot 1</option><option value="2">Slot 2</option></select><button className="secondary-button" onClick={map} disabled={busy}>{busy?'Đang lưu…':'Gán kênh'}</button></div>}{error&&<small className="pancake-row-error">{error}</small>}</div>
}

function CalendarPage({data}) {
  const entries=[...(data.shoots||[]).map(x=>({...x,kindLabel:'Quay'})),...(data.lives||[]).map(x=>({...x,kindLabel:'Livestream'})),...(data.meetings||[]).map(x=>({...x,kindLabel:'Họp'}))].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''))
  const people=value=>(value||[]).map(email=>data.users?.find(u=>u.email===email)?.name||email).join(', ')||'—'
  return <div><PageHeading eyebrow="LỊCH SẢN XUẤT" title="Lịch quay & họp" description="Các buổi quay, livestream và cuộc họp đã chuyển từ workbook cũ."/><section className="panel table-panel"><div className="table-toolbar"><h2>Lịch đã lên</h2><span>{entries.length} sự kiện</span></div><div className="simple-table plan-table"><div className="table-head"><span>SỰ KIỆN</span><span>LOẠI</span><span>NGÀY</span><span>GIỜ</span><span>ĐỊA ĐIỂM</span><span>PHỤ TRÁCH</span></div>{entries.map(e=><div className="table-row" key={e.id}><span className="plan-title"><b>{e.title}</b><small>{people(e.attendees)}</small></span><span>{e.kindLabel}</span><span>{e.date||'—'}</span><span>{e.time||'—'}</span><span>{e.location||'—'}</span><span>{data.users?.find(u=>u.email===e.lead)?.name||e.lead||'—'}</span></div>)}</div></section></div>
}

function AdminPage({data}) {
  return <div><PageHeading eyebrow="WORKSPACE SETTINGS" title="Quản trị thành viên" description="Quản lý người dùng và quyền truy cập trong workspace." action={<button className="primary-button"><Icon name="plus"/> Mời thành viên</button>}/><div className="summary-strip"><span><b>{data.users?.length||0}</b> thành viên</span><span className="summary-sep"/><span>Quyền truy cập theo vai trò</span></div><section className="panel table-panel"><div className="table-toolbar"><h2>Thành viên workspace</h2><button className="secondary-button">Vai trò & quyền <span>⌄</span></button></div><div className="simple-table admin-table"><div className="table-head"><span>THÀNH VIÊN</span><span>EMAIL</span><span>VAI TRÒ</span><span>TRẠNG THÁI</span><span>THAO TÁC</span></div>{data.users?.map(u=><div className="table-row" key={u.email}><span className="title-cell"><Avatar user={u}/><b>{u.name}</b></span><span>{u.email}</span><span>{u.role==='admin'?'Quản trị viên':'Nhân viên'}</span><Status value={u.active===false?'Đã khóa':'Đang hoạt động'}/><button className="dots-button"><Icon name="more"/></button></div>)}</div></section></div>
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

function Modal({title,onClose,children}) {
  useEffect(()=>{const fn=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose])
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal-card"><div className="modal-title"><div><span className="eyebrow">DAILYTASK</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>{children}</section></div>
}

export default App
