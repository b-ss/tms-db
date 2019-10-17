const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-db-sqlite3')
const Database = require('better-sqlite3')
const { DbServer } = require('./server')

/**
 * Sqlite数据库服务
 */
let DB_NAME // 数据库的名称

class TmsSqlite3 extends DbServer {
  /**
   *
   * @param {DbContext} ctx
   * @param {boolean} debug
   */
  constructor({ ctx = null, debug = false } = {}) {
    super({ ctx, debug })
    this.conn = null
  }
  /**
   * 初始化数据库服务
   *
   * @param {object} dbConfig
   */
  static init(dbConfig) {
    if (DB_NAME) return Promise.resolve(true)

    let { path, memory = false, readonly = false, fileMustExist = false, timeout = 5000 } = dbConfig
    let conn = Database(path, { memory, readonly, fileMustExist, timeout })

    DB_NAME = path

    conn.close()
    conn = null

    return Promise.resolve(true)
  }
  /**
   * 返回适当的数据库连接
   */
  adaptiveConn() {
    const conn = this.conn ? this.conn : Database(DB_NAME)

    return Promise.resolve(conn)
  }
  /**
   * 关闭数据库连接
   *
   * @param {Database} conn
   * @param {function} done
   */
  closeConnection(conn, done) {
    if (conn && typeof conn.close === 'function') conn.close()
    if (typeof done === 'function') done()
  }
  /**
   *
   * @param {*} done
   */
  end(done) {
    this.closeConnection(this.conn, done)
  }
  /**
   * 结束服务
   *
   * @param {function} done
   */
  static close(done) {
    if (typeof done === 'function') done()
  }
  /**
   * 执行SQL语句
   *
   * @param {string} sql
   * @param {boolean} useWritableConn
   *
   * @return {Promise}
   */
  execSql(sql, useWritableConn = false) {
    return new Promise(async (resolve, reject) => {
      const conn = await this.adaptiveConn(useWritableConn)
      let error, result
      try {
        const stmt = conn.prepare(sql)
        if (useWritableConn) {
          let info = stmt.run()
          result = {
            affectedRows: info.changes,
            insertId: info.lastInsertRowid
          }
        } else {
          result = stmt.all()
        }
        resolve(result)
      } catch (e) {
        let msg = `执行SQL语句失败(${e.message})`
        logger.debug(msg, error)
        reject(msg)
      }
    })
  }
}

module.exports = { TmsSqlite3 }
