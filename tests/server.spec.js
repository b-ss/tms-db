const { DbServer } = require('@/src/server')
const SqlString = require('sqlstring')

describe('server', () => {
  let dbServer
  beforeAll(() => {
    dbServer = new DbServer()
    dbServer.escape = v => SqlString.escape(v)
    dbServer.escapeId = v => SqlString.escapeId(v)
  })
  it('insert', async () => {
    let insertData = {
      field1: 1,
      field2: 'b'
    }
    dbServer.execSql = jest.fn(() => Promise.resolve({ insertId: 999 }))
    let stmtIns = dbServer.newInsert('tms_db_test', insertData)
    let id = await stmtIns.exec({
      isAutoIncId: true
    })
    expect(dbServer.execSql.mock.calls).toHaveLength(1)
    expect(dbServer.execSql.mock.calls[0][0]).toMatch(/insert into tms_db_test\(`field1`, `field2`\) values\(1, 'b'\)/i)
    expect(dbServer.execSql.mock.calls[0][1]).toMatchObject({ useWritableConn: true })
    expect(id).toBe(999)
  })
  it('delete', async () => {
    dbServer.execSql = jest.fn(() => Promise.resolve({ affectedRows: 1 }))
    let stmtDel = dbServer.newDelete('tms_db_test')
    stmtDel.where.fieldMatch('id', '=', 1)
    await stmtDel.exec()
    expect(dbServer.execSql.mock.calls).toHaveLength(1)
    expect(dbServer.execSql.mock.calls[0][0]).toMatch(/^delete from tms_db_test where `id` = 1$/i)
    expect(dbServer.execSql.mock.calls[0][1]).toMatchObject({ useWritableConn: true })
  })
  it('update', async () => {
    dbServer.execSql = jest.fn(() => Promise.resolve({ affectedRows: 1 }))
    let stmtUpd = dbServer.newUpdate('tms_db_test', {
      field1: 'a'
    })
    stmtUpd.where.fieldMatch('id', '=', 1)
    await stmtUpd.exec()
    expect(dbServer.execSql.mock.calls).toHaveLength(1)
    expect(dbServer.execSql.mock.calls[0][0]).toMatch(/^update tms_db_test set `field1` = 'a' where `id` = 1$/i)
    expect(dbServer.execSql.mock.calls[0][1]).toMatchObject({ useWritableConn: true })
  })
  it('newSelect', async () => {
    let expectedRows = [
      {
        field1: 'r1-1',
        field2: 'r1-2'
      }
    ]
    dbServer.execSql = jest.fn(() => Promise.resolve(expectedRows))
    let select = dbServer.newSelect('tms_db_test', 'field1,field2')
    select.where.fieldMatch('id', '=', 1)
    let rows = await select.exec()
    expect(dbServer.execSql.mock.calls).toHaveLength(1)
    expect(dbServer.execSql.mock.calls[0][0]).toMatch(/^select field1,field2 from tms_db_test where `id` = 1$/i)
    expect(dbServer.execSql.mock.calls[0][1]).toMatchObject({ useWritableConn: false })
    expect(rows).toEqual(expect.arrayContaining(expectedRows))
  })
  it('selectOne', async () => {
    let expectedRow = {
      field1: 'r1-1',
      field2: 'r1-2'
    }
    dbServer.execSql = jest.fn(() => Promise.resolve([expectedRow]))
    let selectOne = dbServer.newSelectOne('tms_db_test', 'field1,field2')
    selectOne.where.fieldMatch('id', '=', 1)
    let row = await selectOne.exec()
    expect(dbServer.execSql.mock.calls).toHaveLength(1)
    expect(dbServer.execSql.mock.calls[0][0]).toMatch(/^select field1,field2 from tms_db_test where `id` = 1$/i)
    expect(dbServer.execSql.mock.calls[0][1]).toMatchObject({ useWritableConn: false })
    expect(row).toMatchObject(expectedRow)
  })
  it('selectOneVal', async () => {
    let expectedVal = 'r1-1'
    dbServer.execSql = jest.fn(() => Promise.resolve([{ field1: expectedVal }]))
    let selectOneVal = dbServer.newSelectOneVal('tms_db_test', 'field1')
    selectOneVal.where.fieldMatch('id', '=', 1)
    let val = await selectOneVal.exec()
    expect(dbServer.execSql.mock.calls).toHaveLength(1)
    expect(dbServer.execSql.mock.calls[0][0]).toMatch(/^select field1 from tms_db_test where `id` = 1$/i)
    expect(dbServer.execSql.mock.calls[0][1]).toMatchObject({ useWritableConn: false })
    expect(val).toBe(expectedVal)
  })
})
