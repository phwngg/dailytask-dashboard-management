import test from 'node:test'
import assert from 'node:assert/strict'
import { payrollPolicyGroups } from '../src/payrollPolicyGroups.js'

test('groups policies by employee and uses calculated payroll breakdown', () => {
  const groups = payrollPolicyGroups([
    { email: 'an@example.com', user_name: 'Ngọc An', code: 'base', label: 'Lương' },
    { email: 'AN@example.com', user_name: 'Ngọc An', code: 'fee', label: 'Phí' },
  ], [{ email: 'an@example.com', total: 12000000, breakdown: '[{"code":"fee","amount":2000000,"how":"4 × 500.000"}]' }])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].total, 12000000)
  assert.equal(groups[0].policies.length, 2)
  assert.equal(groups[0].breakdown.get('fee').amount, 2000000)
  assert.equal(groups[0].breakdown.has('base'), false)
})

test('treats null payroll collections and breakdown as empty', () => {
  const groups = payrollPolicyGroups([
    { email: 'an@example.com', user_name: 'Ngọc An', code: 'fee', label: 'Phí' },
  ], [{ email: 'an@example.com', total: 0, breakdown: 'null' }])

  assert.equal(groups.length, 1)
  assert.equal(groups[0].total, 0)
  assert.equal(groups[0].breakdown.size, 0)
  assert.deepEqual(payrollPolicyGroups(null, null), [])
})
