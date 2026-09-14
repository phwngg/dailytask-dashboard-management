import { useEffect, useState } from 'react'

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

const demo = {
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
}

const demoLogin = { ...demo }

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
  const [page, setPage] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [demoMode, setDemoMode] = useState(import.meta.env.VITE_DEMO === 'true')
  const [modal, setModal] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    if (import.meta.env.VITE_DEMO === 'true') {
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

  const logout = async () => {
    if (!demoMode) { try { await request('/logout', { method:'POST', body:'{}' }) } catch {} }
    setData(null)
    setPage('overview')
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
      setModal('')
      return
    }
    try {
      await request('/plans', { method:'POST', body:JSON.stringify(form) })
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
        <div className="brand"><span className="brand-mark">d</span><span>daily<span className="brand-light">task</span></span><span className="brand-badge">TEAM</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch"><span className="workspace-dot">D</span><span><b>Daily Studio</b><small>Không gian làm việc</small></span><span className="workspace-caret">⌄</span></button>
        <div className="nav-label">MENU CHÍNH</div>
        <nav className="side-nav">
          {visibleNav.map(([key,label,glyph]) => (
            <button key={key} className={'nav-item ' + (page === key ? 'active' : '')} onClick={() => setPage(key)}>
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
          <div className="breadcrumb"><span>Daily Studio</span><Icon name="chevron"/><b>{current}</b></div>
          <div className="top-actions">
            <label className="search-box"><Icon name="search"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm công việc, nội dung..." /><kbd>⌘ K</kbd></label>
            <button className="icon-button notification"><Icon name="bell"/><i/></button>
            <span className="today-chip"><Icon name="calendar"/>{today}</span>
            <Avatar user={data.me}/>
          </div>
        </header>
        {error && <button className="notice-bar" onClick={()=>setError('')}>{error}<span>×</span></button>}
        <div className="page-content">
          {page === 'overview' && <Overview data={data} go={setPage} onStatus={updateTask} demo={demoMode}/>}
          {page === 'plan' && <PlanPage data={data} onAdd={()=>setModal('plan')} query={query}/>}
          {page === 'tasks' && <TaskPage data={data} onAdd={()=>setModal('task')} onStatus={updateTask} query={query}/>}
          {page === 'shifts' && <ShiftPage data={data}/> }
          {page === 'calendar' && <CalendarPage data={data}/>}
          {page === 'payroll' && <PayrollPage data={data} onCompute={computePayroll} demo={demoMode}/>}
          {page === 'channels' && <ChannelPage data={data} demo={demoMode}/>}
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
      <div className="login-copy"><span className="eyebrow light">TEAM WORKSPACE</span><h1>Đưa mọi kế hoạch<br/>về đúng quỹ đạo.</h1><p>Một không gian gọn gàng để đội ngũ cùng tập trung, phối hợp và hoàn thành công việc.</p><div className="login-art"><div className="art-card art-back"><span className="art-mini-dot"/> Kế hoạch tuần <b>84%</b><div className="art-progress"><i/></div></div><div className="art-card art-front"><span className="art-check">✓</span><span><b>Hoàn thành dự án</b><small>Hôm nay · 14:32</small></span><span className="art-spark">✦</span></div><div className="art-orb"/></div></div>
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
      {import.meta.env.VITE_DEMO !== 'true' && <button className="demo-link" onClick={setDemo}>Xem giao diện demo</button>}
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
      <Metric label="Nội dung chờ duyệt" value={pending.length} delta={demo?"2 mới":""} color="orange" icon="◷"/>
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

function PlanPage({data,onAdd,query}) {
  const plans=(data.contentPlan||[]).filter(p=>(p.key+' '+p.pillar+' '+p.channel).toLowerCase().includes(query.toLowerCase()))
  return <div><PageHeading eyebrow="LỊCH BIÊN TẬP" title="Kế hoạch nội dung" description="Lập kế hoạch, phân công và theo dõi lịch xuất bản." action={<button className="primary-button" onClick={onAdd}><Icon name="plus"/> Thêm nội dung</button>}/><div className="summary-strip"><span><b>{plans.length}</b> nội dung trong kế hoạch</span><span className="summary-sep"/><span><i className="small-dot green-dot"/> {plans.filter(p=>p.status==='Đã đăng').length} đã đăng</span><span><i className="small-dot orange-dot"/> {plans.filter(p=>p.status==='Đang thực hiện').length} đang làm</span><span className="grow"/><select className="select-small"><option>Tháng 9, 2026</option></select></div><section className="panel table-panel"><div className="table-toolbar"><div className="filter-tabs"><button className="selected">Tất cả</button><button>Đang làm</button><button>Đã đăng</button></div><button className="secondary-button">Kênh <span>⌄</span></button></div><div className="simple-table plan-table"><div className="table-head"><span>CONTENT PILLAR / KEY</span><span>KÊNH</span><span>DEMO</span><span>NGÀY ĐĂNG</span><span>PHỤ TRÁCH</span><span>TRẠNG THÁI</span></div>{plans.map(p=><div className="table-row" key={p.id}><span className="plan-title"><b>{p.pillar||'Nội dung'}</b><small>{p.key}</small></span><span><i className="table-avatar">{(p.channel||'D')[0]}</i>{p.channel}</span><span>{p.demo_date||'—'}</span><span>{p.post_date||'—'}</span><span>{data.users?.find(u=>u.email===p.assignee)?.name||p.assignee||'—'}</span><Status value={p.status}/></div>)}</div></section></div>
}

function ShiftPage({data}) {
  const days=['T2','T3','T4','T5','T6','T7','CN']
  return <div><PageHeading eyebrow="VẬN HÀNH NHÓM" title="Lịch làm việc" description="Lịch phân ca của nhóm trong tuần." action={<button className="secondary-button"><Icon name="calendar"/> Tuần này <span>⌄</span></button>}/><section className="panel table-panel"><div className="shift-heading"><div><h2>Tuần bắt đầu {data.shiftsWeek||'—'}</h2><p>Phân ca làm việc và lịch sản xuất nội dung.</p></div><div className="shift-legend"><span><i className="shift-pill s"/>Sáng</span><span><i className="shift-pill c"/>Chiều</span><span><i className="shift-pill live"/>Live / Quay</span><span><i className="shift-pill off"/>Nghỉ</span></div></div><div className="shift-table"><div className="shift-row shift-head"><span>THÀNH VIÊN</span>{days.map(d=><span key={d}>{d}</span>)}</div>{(data.shifts||[]).map(row=>{const u=data.users?.find(x=>x.email===row.email);return <div className="shift-row" key={row.email}><span className="title-cell"><Avatar user={u}/><b>{u?.name||row.email}</b></span>{days.map(d=><span key={d}><i className={'shift-cell '+(row[d]==='S'?'s':row[d]==='C'?'c':row[d]==='Live'?'live':row[d]==='Quay'?'live':'off')}>{row[d]||'—'}</i></span>)}</div>})}</div></section></div>
}

function PayrollPage({data,onCompute,demo}) {
  const rows=data.payroll||[]
  return <div><PageHeading eyebrow="TỔNG HỢP THU NHẬP" title="Lương thưởng" description="Kết quả KPI và thu nhập theo kỳ tính lương." action={<button className="secondary-button"><Icon name="calendar"/> {data.payrollMonth||'Chưa có kỳ lương'} <span>⌄</span></button>}/><div className="metric-grid three"><Metric label="Tổng quỹ lương" value={money(rows.reduce((s,r)=>s+Number(r.total||0),0))} delta="Kỳ hiện tại" color="purple" icon="₫"/><Metric label="KPI đạt trung bình" value={rows.length?Math.round(rows.reduce((s,r)=>s+Number(r.kpi_rate||0),0)/rows.length)+'%':'—'} delta="Toàn nhóm" color="green" icon="◉"/><Metric label="Thành viên" value={rows.length} delta="Trong kỳ" color="blue" icon="♙"/></div><section className="panel table-panel"><div className="table-toolbar"><h2>Bảng lương tháng {data.payrollMonth||''}</h2><div className="flex gap-2">{!demo && data.me?.caps?.includes('payroll.compute') && <button className="secondary-button" onClick={onCompute}>Tính lại từ Policy</button>}<button className="secondary-button">Xuất báo cáo <Icon name="arrow"/></button></div></div><div className="simple-table payroll-table"><div className="table-head"><span>THÀNH VIÊN</span><span>LƯƠNG CƠ BẢN</span><span>PHỤ CẤP</span><span>THƯỞNG / PHẠT</span><span>KPI</span><span>TỔNG NHẬN</span></div>{rows.map(r=>{const u=data.users?.find(x=>x.email===r.email);return <div className="table-row" key={r.email}><span className="title-cell"><Avatar user={u}/><b>{u?.name||r.email}</b></span><span>{money(r.base)}</span><span>{money(r.fees)}</span><span>{money(Number(r.bonus||0)-Number(r.penalty||0))}</span><span><span className="kpi-mini"><i style={{width:(r.kpi_rate||0)+'%'}}/></span>{Math.round(r.kpi_rate||0)}%</span><b>{money(r.total)}</b></div>})}</div></section></div>
}

function ChannelPage({data,demo}) {
  return <div><PageHeading eyebrow="HIỆU SUẤT KÊNH" title="Chỉ số kênh" description="Theo dõi lượt xem, người theo dõi và hiệu quả nội dung." action={<button className="secondary-button"><Icon name="calendar"/> 30 ngày qua <span>⌄</span></button>}/><div className="metric-grid"><Metric label="Lượt xem" value={demo?"2.84M":"—"} delta={demo?"+18.2%":""} color="purple" icon="◉"/><Metric label="Người theo dõi mới" value={demo?"12,480":"—"} delta={demo?"+9.6%":""} color="green" icon="♙"/><Metric label="Video đã đăng" value={demo?"86":"—"} delta={demo?"+14.1%":""} color="orange" icon="▶"/><Metric label="Tỷ lệ tương tác" value={demo?"6.42%":"—"} delta={demo?"+1.2%":""} color="blue" icon="⌁"/></div><section className="panel channel-panel"><div className="panel-heading"><div><span className="eyebrow">TĂNG TRƯỞNG</span><h2>Hiệu suất theo tuần</h2></div><button className="dots-button"><Icon name="more"/></button></div><div className="chart-legend"><span><i className="legend-mark purple-mark"/>Lượt xem</span><span><i className="legend-mark coral-mark"/>Người theo dõi mới</span></div>{demo?<div className="chart-area">{[35,53,42,68,56,78,62,91,76,86,70,100,81,91,72,88,67,95,80,100].map((h,i)=><i key={i} style={{height:h+'%'}}/>)}</div>:<div className="channel-empty">Chưa có số liệu thống kê cho kỳ này.</div>}{demo && <div className="chart-labels"><span>Tuần 1</span><span>Tuần 2</span><span>Tuần 3</span><span>Tuần 4</span></div>}</section>{!demo && <section className="panel table-panel"><div className="table-toolbar"><h2>Kênh đã cấu hình</h2><span>{data.channels?.length||0} kênh</span></div><div className="simple-table admin-table"><div className="table-head"><span>NHÂN SỰ</span><span>KÊNH</span><span>NỀN TẢNG</span><span>VỊ TRÍ</span><span>TRẠNG THÁI</span></div>{(data.channels||[]).map((c,i)=>{const u=data.users?.find(x=>x.email===c.email);return <div className="table-row" key={c.email+'-'+c.slot}><span className="title-cell"><Avatar user={u}/><b>{u?.name||c.email}</b></span><span>{c.page_name||'Đã liên kết'}</span><span>{c.platform}</span><span>{c.slot===2?'Kênh 2':'Kênh chính'}</span><Status value="Đang hoạt động"/></div>})}</div></section>}<p className="muted channel-note">{demo?"Số liệu minh hoạ.":"Workbook cũ chưa có bản ghi ChannelStats; số liệu sẽ hiện sau khi nhập hoặc đồng bộ."}</p></div>
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
