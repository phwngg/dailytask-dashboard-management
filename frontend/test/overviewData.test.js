import test from 'node:test'
import assert from 'node:assert/strict'
import {dateWindow,matchesTask,priorityTasks} from '../src/overviewData.js'
test('Vietnam date boundaries, unfinished deadlines and completion week agree',()=>{
 const dates=dateWindow(new Date('2026-09-20T18:00:00Z'))
 assert.deepEqual(dates,{today:'2026-09-21',through:'2026-09-27',monday:'2026-09-21',sunday:'2026-09-27'})
 assert.equal(matchesTask({status:'todo',due_date:''},'overdue',dates),false)
 assert.equal(matchesTask({status:'done',due_date:'2026-09-19'},'overdue',dates),false)
 assert.equal(matchesTask({status:'doing',due_date:'2026-09-21'},'today',dates),true)
 assert.equal(matchesTask({status:'done',done_at:'2026-09-20T18:00:00Z'},'week',dates),true)
 assert.equal(matchesTask({status:'done',done_at:'2026-09-20T16:59:59Z'},'week',dates),false)
 assert.equal(matchesTask({status:'done',done_at:''},'week',dates),false)
 const tasks=[{id:'future',status:'todo',due_date:'2026-09-22',priority:'Cao'},{id:'today',status:'doing',due_date:'2026-09-21',priority:'Vừa'},{id:'late',status:'todo',due_date:'2026-09-20',priority:'Thấp'}]
 assert.deepEqual(priorityTasks(tasks,dates).map(t=>t.id),['late','today','future'])
})
