import test from 'node:test'
import assert from 'node:assert/strict'
import { pancakeTopPosts } from '../src/pancakeTopPosts.js'

test('keeps the five highest engagement posts in stable order', () => {
  const posts = [
    { id: 'a', comment_count: 3, reactions: {} },
    { id: 'b', comment_count: 4, reactions: { like: 6 } },
    { id: 'c', comment_count: 8, reactions: { love: 2 } },
    { id: 'd', comment_count: 1, reactions: {} },
    { id: 'e', comment_count: 7, reactions: {} },
    { id: 'f', comment_count: 4, reactions: {} },
    { id: 'g', comment_count: 5, reactions: {} },
    { id: 'h', comment_count: 9, reactions: {} },
  ]
  const result = pancakeTopPosts(posts, value => Number(value) || 0)
  assert.deepEqual(result.map(post => post.id), ['b', 'c', 'h', 'e', 'g'])
  assert.equal(posts.length, 8)
})
