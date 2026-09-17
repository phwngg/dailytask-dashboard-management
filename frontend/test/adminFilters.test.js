import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAdminUsers } from '../src/adminFilters.js'

test('combines member, position, role, status, and text filters', () => {
  const users = [
    { name:'Minh Anh', email:'minh@example.com', position:'Content', role:'staff', active:true },
    { name:'Gia Bảo', email:'bao@example.com', position:'Content', role:'admin', active:true },
    { name:'Khánh Chi', email:'chi@example.com', position:'Media', role:'staff', active:false },
  ]
  assert.deepEqual(filterAdminUsers(users, { status:'active', member:'minh@example.com', position:'Content', role:'staff', query:'MINH' }), [users[0]])
  assert.deepEqual(filterAdminUsers(users, { position:'__empty__' }), [])
})
