import test from 'node:test'
import assert from 'node:assert/strict'
import {calendarMonths} from '../src/calendarData.js'

test('builds complete Monday-first month grids across year boundaries',()=>{
  const [previous,current,next]=calendarMonths('2024-02-15',1)
  assert.deepEqual([previous.key,current.key,next.key],['2024-01','2024-02','2024-03'])
  assert.equal(current.days.length,42)
  assert.equal(current.days[0],null)
  assert.equal(current.days[3],'2024-02-01')
  assert.equal(current.days[31],'2024-02-29')
})
