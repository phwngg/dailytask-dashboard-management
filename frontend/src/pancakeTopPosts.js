export function pancakeTopPosts(posts, parseNumber) {
  const top = []
  posts.forEach((post, index) => {
    const interactions = Object.values(post.reactions || {}).reduce((sum, value) => sum + parseNumber(value), 0)
    const score = interactions + parseNumber(post.comment_count)
    let position = 0
    while (position < top.length && top[position].score >= score) position++
    if (position === 5) return
    top.splice(position, 0, { score, post: { ...post, id: post.id || index, interactions } })
    if (top.length > 5) top.pop()
  })
  return top.map(item => item.post)
}
