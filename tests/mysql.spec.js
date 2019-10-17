const { TmsMysql } = require('@/src/mysql')
const mysql = require('mysql')
jest.mock('mysql')

describe('mysql', () => {
  it('init-创建连接池', async () => {
    let pool = {}
    mysql.createPool.mockReturnValue(pool)
    TmsMysql.testPool = jest.fn().mockResolvedValue(pool)
    let dbConfig = { master: {}, write: {} }
    let result = await TmsMysql.init(dbConfig)
    expect(result).toBe(true)
    // 分别创建master和write连个连接池
    expect(TmsMysql.testPool.mock.calls.length).toBe(2)
    expect(TmsMysql.testPool.mock.calls[0][1]).toBe('master')
    expect(TmsMysql.testPool.mock.calls[1][1]).toBe('write')
  })
  it('execSql-select', () => {
    let db = new TmsMysql()
    let expectedRows = [{ field1: 1, field2: 'a' }]
    let mockConn = {
      query: jest.fn((sql, callback) => callback(null, expectedRows))
    }
    db.adaptiveConn = jest.fn().mockReturnValue(Promise.resolve(mockConn))

    let stmtSel = db.newSelect('tms_db_test', 'field1,field2')
    stmtSel.where.fieldMatch('id', '=', 1)
    return stmtSel.exec().then(rows => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.query.mock.calls[0][0]).toMatch(/^select field1,field2 from tms_db_test where `id` = 1$/i)
      expect(rows).toEqual(expect.arrayContaining(expectedRows))
    })
  })
  it('execSql-insert', () => {
    let db = new TmsMysql()
    let mockConn = {
      query: jest.fn((sql, callback) => callback(null, { insertId: 999 }))
    }
    db.adaptiveConn = jest.fn().mockReturnValue(Promise.resolve(mockConn))

    let stmtIns = db.newInsert('tms_db_test', { field1: 1, field2: 'a' })
    return stmtIns.exec({ isAutoIncId: true }).then(insertId => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.query.mock.calls[0][0]).toMatch(
        /^insert into tms_db_test\(`field1`, `field2`\) values\(1, 'a'\)$/i
      )
      expect(insertId).toBe(999)
    })
  })
  it('execSql-update', () => {
    let db = new TmsMysql()
    let mockConn = {
      query: jest.fn((sql, callback) => callback(null, { affectedRows: 1 }))
    }
    db.adaptiveConn = jest.fn().mockReturnValue(Promise.resolve(mockConn))

    let stmtUpd = db.newUpdate('tms_db_test', { field1: 1, field2: 'a' })
    stmtUpd.where.fieldMatch('id', '=', 1)
    return stmtUpd.exec().then(affectedRows => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.query.mock.calls[0][0]).toMatch(
        /^update tms_db_test set `field1` = 1, `field2` = 'a' where `id` = 1$/i
      )
      expect(affectedRows).toBe(1)
    })
  })
  it('execSql-delete', () => {
    let db = new TmsMysql()
    let mockConn = {
      query: jest.fn((sql, callback) => callback(null, { affectedRows: 1 }))
    }
    db.adaptiveConn = jest.fn().mockReturnValue(Promise.resolve(mockConn))

    let stmtDel = db.newDelete('tms_db_test')
    stmtDel.where.fieldMatch('id', '=', 1)
    return stmtDel.exec().then(affectedRows => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.query.mock.calls[0][0]).toMatch(/^delete from tms_db_test where `id` = 1$/i)
      expect(affectedRows).toBe(1)
    })
  })
})
