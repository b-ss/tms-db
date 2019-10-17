const Database = require('better-sqlite3')
const { TmsSqlite3 } = require('@/src/sqlite')

describe('sqlite', () => {
  it('init&adaptiveConn&closeConnection', async () => {
    let dbConfig = { path: 'tmp/tms-db-sqlite3.db', memory: true }
    TmsSqlite3.init(dbConfig)
    let sqlite = new TmsSqlite3()
    let conn = await sqlite.adaptiveConn()
    expect(conn).toBeInstanceOf(Database)
    expect(conn.name).toBe('tmp/tms-db-sqlite3.db')
    expect(conn.open).toBe(true)
    sqlite.closeConnection(conn)
    expect(conn.open).toBe(false)
  })
  it('execSql-select', () => {
    let db = new TmsSqlite3()
    let expectedRows = [{ field1: 1, field2: 'a' }]
    let mockSqliteStmt = {
      all: jest.fn().mockReturnValue(expectedRows)
    }
    let mockConn = {
      prepare: jest.fn().mockReturnValue(mockSqliteStmt)
    }
    db.adaptiveConn = jest.fn().mockReturnValue(mockConn)

    let stmtSel = db.newSelect('tms_db_test', 'field1,field2')
    stmtSel.where.fieldMatch('id', '=', 1)
    return stmtSel.exec().then(rows => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.prepare.mock.calls[0][0]).toMatch(/^select field1,field2 from tms_db_test where `id` = 1$/i)
      expect(rows).toEqual(expect.arrayContaining(expectedRows))
    })
  })
  it('execSql-insert', () => {
    let db = new TmsSqlite3()
    let mockSqliteStmt = {
      run: jest.fn().mockReturnValue({ changes: 1, lastInsertRowid: 999 })
    }
    let mockConn = {
      prepare: jest.fn().mockReturnValue(mockSqliteStmt)
    }
    db.adaptiveConn = jest.fn().mockReturnValue(mockConn)

    let stmtIns = db.newInsert('tms_db_test', { field1: 1, field2: 'a' })
    return stmtIns.exec({ isAutoIncId: true }).then(insertId => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.prepare.mock.calls[0][0]).toMatch(
        /^insert into tms_db_test\(`field1`, `field2`\) values\(1, 'a'\)$/i
      )
      expect(insertId).toBe(999)
    })
  })
  it('execSql-update', () => {
    let db = new TmsSqlite3()
    let mockSqliteStmt = {
      run: jest.fn().mockReturnValue({ changes: 1 })
    }
    let mockConn = {
      prepare: jest.fn().mockReturnValue(mockSqliteStmt)
    }
    db.adaptiveConn = jest.fn().mockReturnValue(mockConn)

    let stmtUpd = db.newUpdate('tms_db_test', { field1: 1, field2: 'a' })
    stmtUpd.where.fieldMatch('id', '=', 1)
    return stmtUpd.exec().then(affectedRows => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.prepare.mock.calls[0][0]).toMatch(
        /^update tms_db_test set `field1` = 1, `field2` = 'a' where `id` = 1$/i
      )
      expect(affectedRows).toBe(1)
    })
  })
  it('execSql-delete', () => {
    let db = new TmsSqlite3()
    let mockSqliteStmt = {
      run: jest.fn().mockReturnValue({ changes: 1 })
    }
    let mockConn = {
      prepare: jest.fn().mockReturnValue(mockSqliteStmt)
    }
    db.adaptiveConn = jest.fn().mockReturnValue(mockConn)

    let stmtDel = db.newDelete('tms_db_test')
    stmtDel.where.fieldMatch('id', '=', 1)
    return stmtDel.exec().then(affectedRows => {
      expect(db.adaptiveConn.mock.calls).toHaveLength(1)
      expect(mockConn.prepare.mock.calls[0][0]).toMatch(/^delete from tms_db_test where `id` = 1$/i)
      expect(affectedRows).toBe(1)
    })
  })
})
