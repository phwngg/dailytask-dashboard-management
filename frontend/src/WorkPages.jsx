import {useEffect, useRef, useState} from 'react'
import {dateWindow, formatVietnamDate, matchesTask, priorityTasks} from './overviewData.js'

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

function Scope({data,value,onChange}) {
  const canViewAll=data.me.isLeader||data.me.caps?.includes('checklist.viewAll')
  return <label className="work-scope">Phạm vi đang xem{canViewAll?<select value={value} onChange={e=>onChange(e.target.value)}><option value="">Toàn nhóm</option>{data.users.map(u=><option key={u.email} value={u.email}>{u.name}</option>)}</select>:<strong>Công việc của tôi</strong>}</label>
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
  const series = [
    ['due', 'Đến hạn', '#d99543'],
    ['content', 'Cần đăng', '#8068df'],
    ['completed', 'Hoàn thành', '#3aa77b'],
    ['overdue', 'Quá hạn', '#df7469'],
  ]
  const path = (key, color) => <polyline className="progress-chart-line metric" style={{stroke:color}} points={points.map((point, index) => `${x(index)},${y(Number(point[key] || 0))}`).join(' ')}/>
  const dateLabel = value => value ? value.slice(5).replace('-', '/') : ''
  const delta = previous ? Number(current.completed || 0) - Number(previous.completed || 0) : null
  const deltaLabel = delta == null ? 'Chưa đủ dữ liệu so sánh' : `${delta > 0 ? '+' : ''}${delta} hoàn thành so với tuần trước`
  const rangeLabel = {'2w':'2 tuần','4w':'4 tuần','8w':'8 tuần','3m':'3 tháng'}[trend?.range] || '4 tuần'
  return <div className="progress-trend">
    <div className="progress-trend-summary">
      <div><span className="progress-trend-kicker">HOÀN THÀNH TRONG TUẦN GẦN NHẤT</span><strong>{current.completed || 0}</strong><small className={delta == null ? '' : delta >= 0 ? 'positive' : 'negative'}>{deltaLabel}</small></div>
      <div className="progress-trend-legend">{series.map(([key, label, color]) => <span key={key}><i className="progress-legend-line" style={{borderColor:color}}/>{label}</span>)}</div>
    </div>
    <div className="progress-chart-wrap">
      <svg className="progress-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="So sánh công việc đến hạn, nội dung cần đăng, công việc hoàn thành và công việc quá hạn theo tuần">
        <g className="progress-chart-grid">{gridValues.map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)}/><text x={left - 8} y={y(value) + 3}>{value}</text></g>)}</g>
        {series.map(([key, , color]) => <g key={key}>{path(key, color)}{points.map((point, index) => <circle className="progress-chart-point metric" style={{stroke:color}} key={`${key}-${point.date}`} cx={x(index)} cy={y(Number(point[key] || 0))} r="4"/>)}</g>)}
        <g className="progress-chart-days">{points.map(point => <text key={point.date} x={x(points.indexOf(point))} y={height - 10}>{dateLabel(point.date)}</text>)}</g>
      </svg>
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
export function WorkCalendar({data,params,go}) {
 const scope=params.get('assignee')||'',from=params.get('from')||''
 const events=calendarEntries(data).filter(e=>(!scope||e.lead===scope||e.attendees?.includes(scope))&&(!from||e.date>=from)),detail=events.find(e=>e.id===params.get('id'))
 const change=patch=>go('calendar',false,{...Object.fromEntries(params),...patch,id:''})
 return <div className="work-page"><div className="page-heading"><div><h1>Lịch quay & họp</h1><p>{events.length} sự kiện khớp bộ lọc</p></div></div><section className="panel work-filters"><Scope data={data} value={scope} onChange={assignee=>change({assignee})}/><label>Từ ngày<input type="date" value={from} onChange={e=>change({from:e.target.value})}/></label><button className="text-button" onClick={()=>go('calendar',false,{})}>Xóa bộ lọc</button></section><section className="panel">{events.map(e=><article key={e.id} className="work-row"><div><button className="work-title" onClick={()=>go('calendar',false,{...Object.fromEntries(params),id:e.id})}>{e.title}</button><p>{e.kindLabel} · {e.date} {e.time} · {e.location||'Chưa có địa điểm'}</p></div></article>)}{!events.length&&<p className="work-empty">Không có sự kiện phù hợp.</p>}</section>{params.get('id')&&<DetailDialog title={detail?.title||'Không tìm thấy sự kiện'} onClose={()=>change({})}>{detail?<dl className="work-details">{[['Ngày giờ',`${detail.date} ${detail.time}`],['Địa điểm',detail.location],['Người chủ trì',data.users.find(u=>u.email===detail.lead)?.name||detail.lead],['Người tham gia',(detail.attendees||[]).map(email=>data.users.find(u=>u.email===email)?.name||email).join(', ')],['Ghi chú',detail.brief||detail.note]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v||'Chưa có'}</dd></div>)}</dl>:<p>Sự kiện không tồn tại hoặc bạn không có quyền xem.</p>}</DetailDialog>}</div>
}
