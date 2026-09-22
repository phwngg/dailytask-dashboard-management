import {useEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {dateWindow, formatVietnamDate, matchesTask, priorityTasks} from './overviewData.js'
import {calendarMonths} from './calendarData.js'

export function DetailDialog({title,onClose,children}) {
  const ref=useRef(null)
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close()},[])
  return <dialog ref={ref} className="work-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}} aria-label={title}><div className="modal-title"><h2>{title}</h2><button className="secondary-button" onClick={onClose} aria-label="Đóng chi tiết">Đóng</button></div>{children}</dialog>
}

const reviewLabels={submit:'Gửi duyệt',approve:'Đã duyệt',request_changes:'Yêu cầu sửa',publish:'Đã đăng'}

export function PlanDetails({plan,onClose,users,me,onReview,onEdit,onDelete}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[noteAction,setNoteAction]=useState('')
  const canManage=Boolean(me?.isLeader||me?.isAdmin||me?.caps?.includes('plan.manage'))
  const canEdit=Boolean(canManage||plan.assignee===me?.email)
  const canDelete=canManage
  const run=async action=>{setBusy(true);setError('');try{await onReview(plan.id,action,note);setNote('');setNoteAction('')}catch(e){setError(e.message)}finally{setBusy(false)}}
  const confirmDelete=async()=>{if(!window.confirm('Xóa nội dung này? Dữ liệu lịch sử duyệt cũng sẽ được xóa.'))return;setBusy(true);setError('');try{await onDelete(plan.id);onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}
  const submitNoteAction=noteAction==='request_changes'
  return <DetailDialog title={plan.key||plan.pillar||'Chi tiết nội dung'} onClose={onClose}>
    <dl className="work-details">{[['Kênh',plan.channel],['Chủ đề',plan.pillar],['Người phụ trách',users.find(u=>u.email===plan.assignee)?.name||plan.assignee],['Ngày gửi bản nháp',plan.demo_date],['Ngày đăng',plan.post_date],['Trạng thái',plan.status],['Thông điệp',plan.message]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Chưa có'}</dd></div>)}</dl>
    {plan.review_note&&<div className="work-review-note"><b>Ghi chú xử lý gần nhất</b><p>{plan.review_note}</p></div>}
    {plan.reviews?.length>0&&<section className="work-history"><b>Lịch sử duyệt</b>{plan.reviews.map(item=><div key={item.id}><span>{reviewLabels[item.action]||item.action}</span><small>{item.actor_name||item.actor} · {item.created_at}</small>{item.note&&<p>{item.note}</p>}</div>)}</section>}
    <div className="work-actions work-detail-actions">
      {canEdit&&<button className="secondary-button" disabled={busy} onClick={()=>{onEdit(plan);onClose()}}>Chỉnh sửa</button>}
      {canDelete&&<button className="secondary-button danger-button" disabled={busy} onClick={confirmDelete}>Xóa</button>}
      {!canManage&&plan.assignee===me?.email&&['Chưa thực hiện','Đang thực hiện','Yêu cầu sửa'].includes(plan.status)&&<button className="primary-button" disabled={busy} onClick={()=>run('submit')}>{busy?'Đang lưu…':'Gửi duyệt'}</button>}
      {canManage&&plan.status==='Chờ duyệt'&&<><button className="primary-button" disabled={busy} onClick={()=>run('approve')}>Duyệt nội dung</button><button className="secondary-button" disabled={busy} onClick={()=>setNoteAction('request_changes')}>Yêu cầu sửa</button></>}
      {canManage&&plan.status==='Đã duyệt'&&<button className="primary-button" disabled={busy} onClick={()=>run('publish')}>Đánh dấu đã đăng</button>}
    </div>
    {submitNoteAction&&<div className="work-review-form"><label>Lý do cần sửa<textarea autoFocus rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Nêu rõ phần cần chỉnh để nhân viên dễ xử lý."/></label><div className="work-actions"><button className="secondary-button" disabled={busy} onClick={()=>setNoteAction('')}>Hủy</button><button className="primary-button" disabled={busy||!note.trim()} onClick={()=>run('request_changes')}>{busy?'Đang lưu…':'Gửi yêu cầu sửa'}</button></div></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </DetailDialog>
}

function Scope({data,value,onChange,inline=false}) {
  const canViewAll=data.me.isLeader||data.me.caps?.includes('checklist.viewAll')
  return <label className={`work-scope${inline?" work-scope-inline":""}`}>{!inline&&"Phạm vi đang xem"}{canViewAll?<select value={value} onChange={e=>onChange(e.target.value)} aria-label="Phạm vi đang xem"><option value="">Toàn nhóm</option>{data.users.map(u=><option key={u.email} value={u.email}>{u.name}</option>)}</select>:<strong>Công việc của tôi</strong>}</label>
}

function TaskAction({task,me,onStatus}) {
  const [busy,setBusy]=useState(false),[pendingStatus,setPendingStatus]=useState(''),[error,setError]=useState('')
  if(!me.isLeader&&task.assignee!==me.email)return null
  const update=async status=>{setBusy(true);setPendingStatus(status);setError('');try{await onStatus(task.id,status)}catch(e){setError(e.message)}finally{setBusy(false);setPendingStatus('')}}
  const busyLabel=status=>pendingStatus===status?(status==='doing'?'Đang bắt đầu…':status==='done'?'Đang hoàn thành…':'Đang mở lại…'):status==='doing'?'Bắt đầu':status==='done'?'Hoàn thành':'Mở lại'
  return <div className="work-actions">{task.status==='todo'&&<button className="secondary-button" disabled={busy} onClick={()=>update('doing')}>{busyLabel('doing')}</button>}{task.status!=='done'?<button className="primary-button" disabled={busy} onClick={()=>update('done')}>{busyLabel('done')}</button>:<button className="secondary-button" disabled={busy} onClick={()=>update('todo')}>{busyLabel('todo')}</button>}{error&&<p role="alert" className="form-error">{error}</p>}</div>
}
function TaskRow({task,data,open,onStatus}) {
  return <article className="work-row"><div><button className="work-title" onClick={open}>{task.title}</button><p>{data.users.find(u=>u.email===task.assignee)?.name||task.assignee} · {task.due_date||'Chưa đặt hạn'} · Ưu tiên {task.priority||'Vừa'}</p></div><TaskAction task={task} me={data.me} onStatus={onStatus}/></article>
}
function TaskDetails({task,data,onStatus,onEdit,onDelete,onClose}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const canEdit=Boolean(data.me?.isLeader||task.assignee===data.me?.email),canDelete=Boolean(data.me?.isLeader)
  const remove=async()=>{if(!window.confirm('Xóa công việc này?'))return;setBusy(true);setError('');try{await onDelete(task.id);onClose()}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <><dl className="work-details"><div><dt>Người phụ trách</dt><dd>{data.users.find(u=>u.email===task.assignee)?.name||task.assignee}</dd></div><div><dt>Ngày đến hạn</dt><dd>{task.due_date||'Chưa đặt hạn'}</dd></div><div><dt>Trạng thái</dt><dd>{{todo:'Cần làm',doing:'Đang thực hiện',done:'Hoàn thành'}[task.status]||task.status}</dd></div><div><dt>Ưu tiên</dt><dd>{task.priority||'Vừa'}</dd></div><div><dt>Hoàn thành lúc</dt><dd>{task.done_at||'Chưa hoàn thành'}</dd></div></dl><div className="work-actions work-detail-actions">{canEdit&&<button className="secondary-button" disabled={busy} onClick={()=>{onEdit(task);onClose()}}>Chỉnh sửa</button>}{canDelete&&<button className="secondary-button danger-button" disabled={busy} onClick={remove}>Xóa</button>}<TaskAction task={task} me={data.me} onStatus={onStatus}/></div>{error&&<p className="form-error" role="alert">{error}</p>}</>
}

function ProgressTrend({progress, fallbackTotal = 0, fallbackCompleted = 0}) {
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [selectedIndex, setSelectedIndex] = useState(null)
  const trend = progress?.trend
  const points = trend?.points?.length ? trend.points : [trend?.previous, trend?.current].filter(Boolean)
  const current = points.at(-1)
  const previous = points.at(-2)
  if (!current) {
    const fallbackRate = fallbackTotal ? Math.round(100 * fallbackCompleted / fallbackTotal) : 0
    return <div className="progress-trend-empty"><b>{fallbackTotal ? `${fallbackCompleted}/${fallbackTotal} công việc hoàn thành (${fallbackRate}%)` : 'Chưa có dữ liệu trong khoảng đã chọn.'}</b><span>Biểu đồ sẽ xuất hiện khi có công việc hoặc nội dung trong khoảng này.</span></div>
  }
  const width = 720, height = 260, left = 42, right = 16, top = 20, bottom = 38
  const chartWidth = width - left - right, chartHeight = height - top - bottom
  const x = index => left + index * (chartWidth / Math.max(points.length - 1, 1))
  const values = points.flatMap(point => [point.due, point.content, point.completed, point.overdue].map(Number))
  const maxValue = Math.max(1, ...values)
  const gridValues = [0, Math.ceil(maxValue / 2), maxValue].filter((value, index, list) => index === 0 || value !== list[index - 1])
  const y = value => top + (maxValue - value) * chartHeight / maxValue
  const barSeries = [
    ['due', 'Đến hạn', '#d99543'],
    ['completed', 'Hoàn thành', '#3aa77b'],
    ['overdue', 'Quá hạn', '#df7469'],
  ]
  const contentColor = '#8068df'
  const chartBottom = y(0)
  const groupWidth = Math.min(48, chartWidth / Math.max(points.length, 1) * .78)
  const barGap = 2
  const barWidth = Math.max(3, Math.min(9, (groupWidth - barGap * 2) / 3))
  const groupBarsWidth = barWidth * 3 + barGap * 2
  const barStart = index => x(index) - groupBarsWidth / 2
  const linePath = points.map((point, index) => `${x(index)},${y(Number(point.content || 0))}`).join(' ')
  const dateLabel = value => value ? value.slice(5).replace('-', '/') : ''
  const hoveredIndex = hoveredPoint?.index ?? null
  const activeIndex = hoveredIndex ?? selectedIndex ?? points.length - 1
  const active = points[activeIndex] || current
  const delta = previous ? Number(current.completed || 0) - Number(previous.completed || 0) : null
  const deltaLabel = delta == null ? 'Chưa đủ dữ liệu so sánh' : `${delta > 0 ? '+' : ''}${delta} hoàn thành so với tuần trước`
  const rangeLabel = {'2w':'2 tuần','4w':'4 tuần','8w':'8 tuần','3m':'3 tháng'}[trend?.range] || '4 tuần'
  const activatePoint = index => setSelectedIndex(value => value === index ? null : index)
  const updateHoveredPoint = (event, index) => {
    const x = event.clientX
    const y = event.clientY
    const side = x > window.innerWidth - 176 ? 'left' : 'right'
    const vertical = y < 112 ? 'below' : 'above'
    setHoveredPoint({index, x, y, side, vertical})
  }
  const pointKey = point => `${point.date}-${point.endDate}`
  return <div className="progress-trend">
    <div className="progress-trend-summary">
      <div><span className="progress-trend-kicker">HOÀN THÀNH TRONG TUẦN GẦN NHẤT</span><strong>{current.completed || 0}</strong><small className={delta == null ? '' : delta >= 0 ? 'positive' : 'negative'}>{deltaLabel}</small></div>
      <div className="progress-trend-legend">
        <span><i className="progress-legend-mark line" style={{backgroundColor:contentColor}}/>Cần đăng</span>
        {barSeries.map(([key, label, color]) => <span key={key}><i className="progress-legend-mark bar" style={{backgroundColor:color}}/>{label}</span>)}
      </div>
    </div>
    <div className="progress-chart-wrap">
      <svg className="progress-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ kết hợp nội dung cần đăng theo đường và công việc đến hạn, hoàn thành, quá hạn theo cột">
        <g className="progress-chart-grid">{gridValues.map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)}/><text x={left - 8} y={y(value) + 3}>{value}</text></g>)}</g>
        <g className="progress-chart-bars">{points.map((point, index) => <g key={pointKey(point)}>{barSeries.map(([key, label, color], barIndex) => { const value = Number(point[key] || 0); const barHeight = value ? Math.max(2, chartBottom - y(value)) : 0; return <rect key={key} x={barStart(index) + barIndex * (barWidth + barGap)} y={chartBottom - barHeight} width={barWidth} height={barHeight} rx="2" style={{fill:color}}><title>{label}: {value} · {point.date} → {point.endDate}</title></rect> })}</g>)}</g>
        <polyline className="progress-chart-line content" style={{stroke:contentColor}} points={linePath}/>
        {points.map((point, index) => <circle className="progress-chart-point content" style={{stroke:contentColor}} key={pointKey(point)} cx={x(index)} cy={y(Number(point.content || 0))} r={activeIndex === index ? 5 : 4} tabIndex="0" role="button" aria-label={`Cần đăng ${point.content || 0} trong tuần ${point.date}`} onMouseEnter={event => updateHoveredPoint(event, index)} onMouseMove={event => updateHoveredPoint(event, index)} onMouseLeave={() => setHoveredPoint(null)} onFocus={() => setHoveredPoint({index})} onBlur={() => setHoveredPoint(null)} onClick={() => activatePoint(index)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activatePoint(index) } }}/>)}
        <g className="progress-chart-days">{points.map((point, index) => <text key={pointKey(point)} x={x(index)} y={height - 10}>{dateLabel(point.date)}</text>)}</g>
      </svg>
      {hoveredPoint?.x != null && createPortal(<div className={`progress-point-tooltip ${hoveredPoint.side} ${hoveredPoint.vertical}`} style={{left:`${hoveredPoint.x}px`,top:`${Math.max(8, hoveredPoint.y)}px`}}>
        <b>{active.date} → {active.endDate}</b>
        <span><i className="progress-legend-mark line" style={{backgroundColor:contentColor}}/>Cần đăng <strong>{active.content || 0}</strong></span>
        {barSeries.map(([key, label, color]) => <span key={key}><i className="progress-legend-mark bar" style={{backgroundColor:color}}/>{label} <strong>{active[key] || 0}</strong></span>)}
      </div>, document.body)}
    </div>
    <div className="progress-chart-detail" aria-live="polite">
      <div className="progress-chart-detail-heading"><b>{active.date} → {active.endDate}</b><small>{hoveredIndex != null ? 'Đang xem điểm dữ liệu' : selectedIndex != null ? 'Đã chọn điểm dữ liệu' : 'Tuần gần nhất'}</small></div>
      <div className="progress-chart-detail-values"><span><i className="progress-legend-mark line" style={{backgroundColor:contentColor}}/>Cần đăng <b>{active.content || 0}</b></span>{barSeries.map(([key, label, color]) => <span key={key}><i className="progress-legend-mark bar" style={{backgroundColor:color}}/>{label} <b>{active[key] || 0}</b></span>)}</div>
    </div>
    <div className="progress-trend-foot"><span>{current.date} → {current.endDate}</span><span>{rangeLabel} · {current.due || 0} đến hạn · {current.content || 0} cần đăng · {current.overdue || 0} quá hạn</span></div>
  </div>
}
export function WorkOverview({data,overview,go,onAdd,params,onStatus}) {
  const dates=dateWindow(),scope=params.get('assignee')||''
  const tasks=overview?.tasks||(data.tasks||[]).filter(t=>!scope||t.assignee===scope)
  const plans=overview?.contentPlan||(data.contentPlan||[]).filter(p=>(!scope||p.assignee===scope)&&p.status!=='Đã đăng'&&p.post_date>=dates.today&&p.post_date<=dates.through).sort((a,b)=>a.post_date.localeCompare(b.post_date)||a.id.localeCompare(b.id))
  const eventData=overview?{...data,shoots:overview.shoots||[],lives:overview.lives||[],meetings:overview.meetings||[]}:data
  const events=calendarEntries(eventData).filter(e=>(!scope||e.lead===scope||e.attendees?.includes(scope))&&e.date>=dates.today&&!e.done)
  const route=(page,extra={})=>go(page,false,{assignee:scope,...extra})
  const metrics=overview?.metrics||{}
  const cards=[['Quá hạn',metrics.overdue??tasks.filter(t=>matchesTask(t,'overdue',dates)).length,'tasks',{view:'overdue'},'Cần xử lý trước'],['Đến hạn hôm nay',metrics.today??tasks.filter(t=>matchesTask(t,'today',dates)).length,'tasks',{view:'today'},formatVietnamDate(dates.today)],['Cần đăng trong 7 ngày tới',metrics.content7days??plans.length,'plan',{from:dates.today,to:dates.through,unpublished:'1'},`${formatVietnamDate(dates.today)} → ${formatVietnamDate(dates.through)}`],['Hoàn thành tuần này',metrics.completedWeek??tasks.filter(t=>matchesTask(t,'week',dates)).length,'tasks',{view:'week'},`${formatVietnamDate(dates.monday)} → ${formatVietnamDate(dates.sunday)}`]]
  const focus=priorityTasks(tasks,dates).slice(0,5),weekTasks=tasks.filter(t=>matchesTask(t,'dueweek',dates)),weekTotal=overview?.progress?.total??weekTasks.length,weekDone=overview?.progress?.completed??weekTasks.filter(t=>t.status==='done').length
  return <div className="work-page"><div className="page-heading"><div><span className="eyebrow">{formatVietnamDate(dates.today)} · GIỜ VIỆT NAM</span><h1>Xin chào, {data.me.name}</h1><p>Việc cần xử lý và lịch sắp tới của bạn.</p></div><button className="primary-button" onClick={onAdd}>+ Tạo công việc</button></div><Scope data={data} value={scope} onChange={assignee=>go('overview',false,{assignee,range:params.get('range')||'4w'})}/><div className="metric-grid">{cards.map(([label,count,page,filters,period])=><button className="metric-card work-metric" key={label} onClick={()=>route(page,filters)}><span>{label}</span><strong>{count}</strong><small>{period}</small><b>Xem danh sách →</b></button>)}</div><section className="panel"><div className="panel-heading"><h2>Phân tích tiến độ công việc</h2><div className="progress-heading-actions">{(data.me?.isAdmin||data.me?.isLeader)&&<label className="progress-range-control"><span>Khoảng xem</span><select value={overview?.progress?.trend?.range||params.get('range')||'4w'} onChange={e=>go('overview',true,{assignee:scope,range:e.target.value})}><option value="2w">2 tuần</option><option value="4w">4 tuần</option><option value="8w">8 tuần</option><option value="3m">3 tháng</option></select></label>}<button className="text-button" onClick={()=>route('tasks',{view:'dueweek'})}>Xem danh sách →</button></div></div><ProgressTrend progress={overview?.progress} fallbackTotal={weekTotal} fallbackCompleted={weekDone}/></section><section className="panel"><div className="panel-heading"><h2>Việc cần xử lý</h2><button className="text-button" onClick={()=>route('tasks',{view:'open'})}>Xem tất cả →</button></div>{focus.map(t=><TaskRow key={t.id} task={t} data={data} open={()=>route('tasks',{id:t.id})} onStatus={onStatus}/>)}{!focus.length&&<p className="work-empty">Không có công việc đang mở trong phạm vi này.</p>}</section><section className="panel"><div className="panel-heading"><h2>Nội dung sắp đăng</h2><button className="text-button" onClick={()=>route('plan',{from:dates.today,to:dates.through,unpublished:'1'})}>Xem tất cả →</button></div>{plans.slice(0,5).map(p=><article key={p.id} className="work-row"><div><button className="work-title" onClick={()=>route('plan',{id:p.id})}>{p.key||p.pillar}</button><p>{p.channel} · {data.users.find(u=>u.email===p.assignee)?.name||p.assignee||'Chưa phân công'} · {p.post_date}</p></div><span className="status">{p.status}</span></article>)}{!plans.length&&<p className="work-empty">Chưa có nội dung cần đăng trong 7 ngày tới.</p>}</section><section className="panel"><div className="panel-heading"><h2>Lịch quay & họp sắp tới</h2><button className="text-button" onClick={()=>route('calendar',{from:dates.today})}>Xem tất cả →</button></div>{events.slice(0,5).map(e=><article className="work-row" key={e.id}><div><button className="work-title" onClick={()=>route('calendar',{id:e.id})}>{e.title}</button><p>{e.kindLabel} · {e.date} {e.time} · {e.location||'Chưa có địa điểm'} · {data.users.find(u=>u.email===e.lead)?.name||e.lead||'Chưa có người chủ trì'}</p></div></article>)}{!events.length&&<p className="work-empty">Chưa có lịch quay hoặc họp sắp tới.</p>}</section></div>
}

export function WorkTasks({data,go,params,onAdd,onStatus,onEdit,onDelete}) {
 const dates=dateWindow(),scope=params.get('assignee')||'',view=params.get('view')||'',q=params.get('q')||''
 const change=patch=>go('tasks',false,{...Object.fromEntries(params),...patch,id:''})
 const tasks=(data.tasks||[]).filter(t=>(!scope||t.assignee===scope)&&matchesTask(t,view,dates)&&t.title.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi')))
 const detail=data.tasks.find(t=>t.id===params.get('id'))
 return <div className="work-page"><div className="page-heading"><div><h1>Checklist</h1><p>{tasks.length} công việc khớp bộ lọc</p></div><button className="primary-button" onClick={onAdd}>+ Tạo công việc</button></div><section className="panel work-filters"><Scope data={data} value={scope} onChange={assignee=>change({assignee})}/><label>Trạng thái / thời hạn<select value={view} onChange={e=>change({view:e.target.value})}>{[['','Tất cả'],['overdue','Quá hạn'],['today','Đến hạn hôm nay'],['week','Hoàn thành tuần này'],['dueweek','Đến hạn trong tuần này'],['open','Chưa hoàn thành'],['todo','Cần làm'],['doing','Đang thực hiện'],['done','Đã hoàn thành']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Tìm công việc<input type="search" value={q} onChange={e=>change({q:e.target.value})}/></label><button className="text-button" onClick={()=>go('tasks',false,{})}>Xóa bộ lọc</button></section><section className="panel">{tasks.map(t=><TaskRow key={t.id} task={t} data={data} open={()=>go('tasks',false,{...Object.fromEntries(params),id:t.id})} onStatus={onStatus}/>)}{!tasks.length&&<p className="work-empty">Không tìm thấy công việc phù hợp.</p>}</section>{params.get('id')&&<DetailDialog title={detail?.title||'Không tìm thấy công việc'} onClose={()=>change({})}>{detail?<TaskDetails task={detail} data={data} onStatus={onStatus} onEdit={onEdit} onDelete={onDelete} onClose={()=>change({})}/>:<p>Công việc không tồn tại hoặc bạn không có quyền xem.</p>}</DetailDialog>}</div>
}

function calendarEntries(data) {return [...(data.shoots||[]).map(e=>({...e,kindLabel:'Quay'})),...(data.lives||[]).map(e=>({...e,kindLabel:'Livestream'})),...(data.meetings||[]).map(e=>({...e,kindLabel:'Họp'}))].sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''))}
export function WorkCalendar({data,params,go,onCreate,demo}) {
 const scope=params.get('assignee')||'',today=dateWindow().today,todayMonth=today.slice(0,7)
 const events=calendarEntries(data).filter(e=>!scope||e.lead===scope||e.attendees?.includes(scope)),detail=events.find(e=>e.id===params.get('id'))
 const counts=events.reduce((group,event)=>((group[event.date]??=[]).push(event),group),{})
 const [selectedDay,setSelectedDay]=useState(''),[visibleMonth,setVisibleMonth]=useState(todayMonth),[pickerOpen,setPickerOpen]=useState(false),[pickerValue,setPickerValue]=useState(todayMonth)
 const canManage=Boolean(data.me?.isAdmin||data.me?.caps?.includes('plan.manage'))
 const canCreate=Boolean(!demo&&(canManage||data.me?.isAdmin||data.me?.caps?.includes('plan.view')))
 const [createOpen,setCreateOpen]=useState(false),[saving,setSaving]=useState(false),[saveError,setSaveError]=useState('')
 const [form,setForm]=useState(()=>({kind:canManage?'shoot':'meeting',title:'',date:today,time:'09:00',location:'',attendees:data.me?.email?[data.me.email]:[],duration:60,note:''}))
 const month=calendarMonths(`${visibleMonth}-01`,0)[0]
 const change=patch=>go('calendar',false,{...Object.fromEntries(params),...patch,id:''})
 const shiftMonth=offset=>setVisibleMonth(current=>{const [year,monthNumber]=current.split('-').map(Number);return new Date(Date.UTC(year,monthNumber-1+offset,1)).toISOString().slice(0,7)})
 const openMonthPicker=()=>{setPickerValue(visibleMonth);setPickerOpen(true)}
 const applyMonth=event=>{event.preventDefault();setVisibleMonth(pickerValue);setPickerOpen(false)}
 const years=Array.from({length:200},(_,index)=>2000+index)
 const submit=async event=>{event.preventDefault();if(saving)return;setSaving(true);setSaveError('');try{await onCreate(form);setCreateOpen(false)}catch(error){setSaveError(error.message||'Không thể tạo lịch')}finally{setSaving(false)}}
 const toggleAttendee=email=>setForm(current=>({...current,attendees:current.attendees.includes(email)?current.attendees.filter(item=>item!==email):[...current.attendees,email]}))
 return <div className="work-page"><div className="page-heading"><div><h1>Lịch quay & họp</h1><p>{events.length} sự kiện · {month.label}</p></div></div><section className="panel calendar-panel"><div className="calendar-content"><section className="calendar-month"><div className="calendar-month-heading"><button type="button" className="calendar-month-trigger" onClick={openMonthPicker} aria-label="Chọn tháng và năm">{month.label}<span>⌄</span></button><Scope inline data={data} value={scope} onChange={assignee=>change({assignee})}/>{canCreate&&<button type="button" className="primary-button calendar-add-button" onClick={()=>setCreateOpen(true)}>＋ Thêm lịch</button>}<div className="calendar-navigation"><button type="button" className="secondary-button" onClick={()=>shiftMonth(-1)} aria-label="Tháng trước">‹ Tháng trước</button><button type="button" className="primary-button" onClick={()=>setVisibleMonth(todayMonth)}>Hôm nay</button><button type="button" className="secondary-button" onClick={()=>shiftMonth(1)} aria-label="Tháng sau">Tháng sau ›</button></div></div><div className="calendar-grid calendar-weekdays">{['T2','T3','T4','T5','T6','T7','CN'].map(day=><b key={day}>{day}</b>)}</div><div className="calendar-grid calendar-days">{month.days.map((date,index)=>{if(!date)return <span className="calendar-blank" key={`blank-${index}`}/>;const dayEvents=counts[date]||[],dayNumber=Number(date.slice(-2));return <button type="button" key={date} className={`calendar-day ${date===today?'is-today':date<today?'is-past':'is-future'}`} onClick={()=>setSelectedDay(date)} aria-label={`${formatVietnamDate(date)}, ${dayEvents.length} sự kiện`}><span className="calendar-day-heading"><b>{dayNumber}</b>{dayEvents.length>0&&<i>{dayEvents.length}</i>}</span>{dayEvents.slice(0,2).map(event=><span key={event.id} className={`calendar-event-chip ${event.kindLabel==='Quay'?'shoot':event.kindLabel==='Họp'?'meeting':'live'}`}><small>{event.time}</small>{event.title}</span>)}{dayEvents.length>2&&<small className="calendar-more">+{dayEvents.length-2} lịch</small>}</button>})}</div></section></div></section>{pickerOpen&&<DetailDialog title="Chọn tháng và năm" onClose={()=>setPickerOpen(false)}><form className="calendar-picker-form" onSubmit={applyMonth}><label>Tháng<select value={pickerValue.slice(5)} onChange={e=>setPickerValue(`${pickerValue.slice(0,4)}-${e.target.value}`)}>{Array.from({length:12},(_,index)=><option key={index+1} value={String(index+1).padStart(2,"0")}>{index+1}</option>)}</select></label><label>Năm<select value={pickerValue.slice(0,4)} onChange={e=>setPickerValue(`${e.target.value}-${pickerValue.slice(5)}`)}>{years.map(year=><option key={year} value={year}>{year}</option>)}</select></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setPickerOpen(false)}>Hủy</button><button className="primary-button">Xem lịch</button></div></form></DetailDialog>}{selectedDay&&<DetailDialog title={formatVietnamDate(selectedDay)} onClose={()=>setSelectedDay('')}><div className="calendar-day-dialog">{(counts[selectedDay]||[]).map(event=><button key={event.id} type="button" className="calendar-event-row" onClick={()=>{setSelectedDay('');go('calendar',false,{...Object.fromEntries(params),id:event.id})}}><span className={`calendar-event-type ${event.kindLabel==='Quay'?'shoot':event.kindLabel==='Họp'?'meeting':'live'}`}>{event.kindLabel}</span><span><b>{event.title}</b><small>{event.time||'Chưa có giờ'} · {event.location||'Chưa có địa điểm'}</small></span><span aria-hidden="true">›</span></button>)}{!(counts[selectedDay]||[]).length&&<p className="work-empty">Ngày này chưa có lịch. Bạn có thể xem ngày khác trong tháng.</p>}</div></DetailDialog>}{createOpen&&<DetailDialog title="Thêm lịch trình" onClose={()=>setCreateOpen(false)}><form className="calendar-create-form" onSubmit={submit}><label>Loại lịch<select value={form.kind} onChange={e=>setForm(current=>({...current,kind:e.target.value}))}>{canManage&&<><option value="shoot">Quay</option><option value="live">Livestream</option></>}<option value="meeting">Họp</option></select></label><label>Tên lịch<input autoFocus required maxLength="160" value={form.title} onChange={e=>setForm(current=>({...current,title:e.target.value}))} placeholder="Nhập tên lịch"/></label><div className="calendar-form-row"><label>Ngày<input type="date" required value={form.date} onChange={e=>setForm(current=>({...current,date:e.target.value}))}/></label><label>Giờ<input type="time" required value={form.time} onChange={e=>setForm(current=>({...current,time:e.target.value}))}/></label>{form.kind==='meeting'&&<label>Thời lượng (phút)<input type="number" min="15" step="15" value={form.duration} onChange={e=>setForm(current=>({...current,duration:e.target.value}))}/></label>}</div>{form.kind!=='meeting'&&<label>Địa điểm<input value={form.location} onChange={e=>setForm(current=>({...current,location:e.target.value}))} placeholder="Studio, địa chỉ…"/></label>}<fieldset className="calendar-attendees"><legend>Người tham gia</legend>{data.users.map(user=><label key={user.email}><input type="checkbox" checked={form.attendees.includes(user.email)} onChange={()=>toggleAttendee(user.email)}/>{user.name}</label>)}</fieldset>{form.kind!=='meeting'&&<p className="calendar-form-hint">Người đầu tiên được chọn làm người chủ trì; mỗi người tham gia sẽ nhận một công việc tương ứng.</p>}<label>Ghi chú<textarea rows="3" value={form.note} onChange={e=>setForm(current=>({...current,note:e.target.value}))}/></label>{saveError&&<p className="form-error" role="alert">{saveError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setCreateOpen(false)}>Hủy</button><button className="primary-button" disabled={saving||!form.attendees.length}>{saving?'Đang lưu…':'Tạo lịch'}</button></div></form></DetailDialog>}{params.get('id')&&<DetailDialog title={detail?.title||'Không tìm thấy sự kiện'} onClose={()=>change({})}>{detail?<dl className="work-details">{[['Loại lịch',detail.kindLabel],['Ngày giờ',`${formatVietnamDate(detail.date)} · ${detail.time||'Chưa có giờ'}`],['Địa điểm',detail.location],['Người chủ trì',data.users.find(u=>u.email===detail.lead)?.name||detail.lead],['Người tham gia',(detail.attendees||[]).map(email=>data.users.find(u=>u.email===email)?.name||email).join(', ')],['Ghi chú',detail.brief||detail.note]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'Chưa có'}</dd></div>)}</dl>:<p>Sự kiện không tồn tại hoặc bạn không có quyền xem.</p>}</DetailDialog>}</div>
}
