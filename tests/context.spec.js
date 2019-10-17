const { DbContext } = require('@/src/context')
const { TmsMysql } = require('@/src/mysql')
const { TmsSqlite3 } = require('@/src/sqlite')
jest.mock('@/src/mysql')
jest.mock('@/src/sqlite')

describe('context', () => {
  beforeEach(() => {
    TmsMysql.mockClear()
    TmsSqlite3.mockClear()
  })
  it('根据配置信息，进行数据库服务初始化-格式错误', () => {
    let promiseInit = DbContext.init()
    return expect(promiseInit).rejects.toBe('数据库连接信息格式错误')
  })
  it('根据配置信息，进行数据库服务初始化-类型错误', () => {
    let promiseInit = DbContext.init({})
    return expect(promiseInit).rejects.toBe('没有获得支持的数据库类型')
  })
  it('根据配置信息，进行数据库服务初始化-mysql', async () => {
    let dbConfig = { mysql: {} }
    let result = await DbContext.init(dbConfig)
    expect(TmsMysql.init.mock.calls.length).toBe(1)
    expect(TmsMysql.init.mock.calls[0][0]).toBe(dbConfig.mysql)
    expect(result.mysql).toBe(true)
  })
  it('根据配置信息，进行数据库服务初始化-sqlite', async () => {
    let dbConfig = { sqlite: {} }
    let result = await DbContext.init(dbConfig)
    expect(TmsSqlite3.init.mock.calls.length).toBe(1)
    expect(TmsSqlite3.init.mock.calls[0][0]).toBe(dbConfig.sqlite)
    expect(result.sqlite).toBe(true)
  })
  it('创建实例', async () => {
    await DbContext.init({ mysql: {}, sqlite: {} })
    let ctx = new DbContext()
    expect(TmsMysql).toHaveBeenCalled()
    expect(TmsSqlite3).toHaveBeenCalled()
  })
  it('创建实例-只创建mysql', async () => {
    await DbContext.init({ mysql: {}, sqlite: {} })
    let ctx = new DbContext({ dialects: ['mysql'] })
    expect(TmsMysql).toHaveBeenCalled()
    expect(TmsSqlite3).not.toHaveBeenCalled()
  })
  it('创建实例-只创建sqlite', async () => {
    await DbContext.init({ mysql: {}, sqlite: {} })
    let ctx = new DbContext({ dialects: ['sqlite'] })
    expect(TmsMysql).not.toHaveBeenCalled()
    expect(TmsSqlite3).toHaveBeenCalled()
  })
  it('执行sql语句-mysql', async () => {
    await DbContext.init({ mysql: {} })
    let ctx = new DbContext({ dialects: ['mysql'] })
    let { mysql } = ctx
    expect(mysql).toBeInstanceOf(TmsMysql)
  })
  it('执行sql语句-sqlite', async () => {
    await DbContext.init({ sqlite: {} })
    let ctx = new DbContext({ dialects: ['sqlite'] })
    let { sqlite } = ctx
    expect(sqlite).toBeInstanceOf(TmsSqlite3)
  })
  it('结束实例-end', async done => {
    await DbContext.init({ mysql: {}, sqlite: {} })
    let ctx = new DbContext()
    ctx.end(done)
    expect(ctx.mysql.end.mock.calls.length).toBe(1)
    expect(ctx.sqlite.end.mock.calls.length).toBe(1)
  })
  it('关闭服务-close', async done => {
    await DbContext.init({ mysql: {}, sqlite: {} })
    DbContext.close(done)
    expect(TmsMysql.close.mock.calls.length).toBe(1)
    expect(TmsSqlite3.close.mock.calls.length).toBe(1)
  })
})
