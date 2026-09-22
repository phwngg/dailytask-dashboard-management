import test from 'node:test'
import assert from 'node:assert/strict'
import { payrollBreakdown } from '../src/payrollPolicyDetails.js'

test('parses payroll details and treats invalid or null breakdown as empty', () => {
  assert.deepEqual(payrollBreakdown({ breakdown: '[{"code":"fee","amount":2000000}]' }), [
    { code: 'fee', amount: 2000000 },
  ])
  assert.deepEqual(payrollBreakdown({ breakdown: 'null' }), [])
  assert.deepEqual(payrollBreakdown({ breakdown: 'invalid' }), [])
  assert.deepEqual(payrollBreakdown(null), [])
})
