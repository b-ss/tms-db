describe('#json', () => {
  const { DbServer } = require('@/src/server')
  let db
  beforeAll(async () => {
    db = new DbServer()
  })
  it('解析记录中可能的json串', () => {
    let insideObj = { p1: 'a', p2: 1 }
    let insideArr = ['a', 'b']
    let rows = [{ f1: JSON.stringify(insideObj), f2: JSON.stringify(insideArr) }]
    db.parseJson(rows)
    expect(rows[0].f1).toMatchObject(insideObj)
    expect(rows[0].f2).toEqual(expect.arrayContaining(insideArr))
  })
  it('解析记录中可能的json串--处理指定字段', () => {
    let insideObj = { p1: 'a', p2: 1 }
    let insideArr = ['a', 'b']
    let rows = [{ f1: JSON.stringify(insideObj), f2: JSON.stringify(insideArr) }]
    db.parseJson(rows, ['f1'])
    expect(rows[0].f1).toMatchObject(insideObj)
    expect(rows[0].f2).toBe(JSON.stringify(insideArr))
  })
  it('解析记录中可能的json串--排除指定字段', () => {
    let insideObj = { p1: 'a', p2: 1 }
    let insideArr = ['a', 'b']
    let rows = [{ f1: JSON.stringify(insideObj), f2: JSON.stringify(insideArr) }]
    db.parseJson(rows, [], ['f1'])
    expect(rows[0].f1).toBe(JSON.stringify(insideObj))
    expect(rows[0].f2).toEqual(expect.arrayContaining(insideArr))
  })
})
