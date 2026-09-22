import test from 'node:test'
import assert from 'node:assert/strict'
import { payrollBreakdown } from '../src/payrollPolicyDetails.js'

test('reads payroll breakdown and treats null or invalid data as empty', () => {
  assert.deepEqual(payrollBreakdown({ breakdown: '[{"code":"fee","amount":2000000}]' }), [
    { code: 'fee', amount: 2000000 },
  ])
  assert.deepEqual(payrollBreakdown({ breakdown: 'null' }), [])
  assert.deepEqual(payrollBreakdown({ breakdown: 'invalid' }), [])
  assert.deepEqual(payrollBreakdown(null), [])
})
