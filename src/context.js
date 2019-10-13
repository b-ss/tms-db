const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-db')
/**
 * 数据库访问上下文对象，用于保存连接资源、事物、跟踪信息等
 */
const DB_CTX_CONN = Symbol('db_ctx_conn')
const DB_CTX_WRITABLE_CONN = Symbol('db_ctx_writable_conn')
const DB_CTX_TRANSACTION = Symbol('db_ctx_transaction')
// 记录执行的SQL
const EXEC_SQL_STACK = Symbol('exec_sql_stack')

class DbContext {
  /**
   * 
   * @param {*} param 
   * @param {Connection} param.conn 默认数据库连接 
   * @param {Connection} param.writbleConn 写数据库连接 
   * @param {TmsTransaction} param.transaction 事物 
   */
  constructor({
    conn = null,
    writableConn = null,
    transaction = null
  } = {}) {
    this[DB_CTX_CONN] = conn
    this[DB_CTX_WRITABLE_CONN] = writableConn
    this[DB_CTX_TRANSACTION] = transaction
  }
  get conn() {
    return this[DB_CTX_CONN]
  }
  set conn(conn) {
    this[DB_CTX_CONN] = conn
  }
  get writableConn() {
    return this[DB_CTX_WRITABLE_CONN]
  }
  set writableConn(conn) {
    this[DB_CTX_WRITABLE_CONN] = conn
  }
  get transaction() {
    return this[DB_CTX_TRANSACTION]
  }
  set transaction(trans) {
    this[DB_CTX_TRANSACTION] = trans
  }
  set execSqlStack(sql) {
    if (undefined === this[EXEC_SQL_STACK]) this[EXEC_SQL_STACK] = []
    this[EXEC_SQL_STACK].push(sql)
  }
  get execSqlStack() {
    return this[EXEC_SQL_STACK]
  }
  static release(dbConn) {
    if (dbConn) {
      logger.info(`销毁数据库连接(${dbConn.threadId})`)
      dbConn.release()
      dbConn = null
    }
  }
  end(done) {
    if (this[DB_CTX_WRITABLE_CONN]) {
      let conn = this[DB_CTX_WRITABLE_CONN]
      let threadId = conn.threadId
      conn.release()
      logger.info(`关闭写数据库连接（${threadId}）`)
    }
    if (this[DB_CTX_CONN]) {
      let conn = this[DB_CTX_CONN]
      let threadId = conn.threadId
      conn.release()
      logger.info(`关闭默认数据库连接（${threadId}）`)
    }

    if (done && typeof done === 'function') done()

    delete this[EXEC_SQL_STACK]
  }

  /**
   * 初始化
   * 
   * @param {*} dbConfig 配置信息
   */
  init(dbConfig) {
    if (typeof dbConfig !== 'object') {
      return Promise.reject('没有指定数据库连接信息')
    }
    if (typeof dbConfig.type !== 'string') {
      return Promise.reject('数据库连接信息不完整')
    }
    if (!/mysql|sqlite/.test(dbConfig.type)) {
      return Promise.reject('不支持的数据库类型')
    }

    return this[_.camelCase(`inti ${dbConfig.type}`)]
  }

  initMysql(dbConfig) {
    if (typeof dbConfig.master !== 'object') {
      return Promise.reject('没有指定默认数据库（master）连接参数')
    }

    let {
      Mysql
    } = require('./mysql')
    let mysql = new Mysql()
    mysql.open(dbConfig)

    this.instance = msyql

    return Promise.resolve(true)
  }

  initSqlite(dbConfig) {
    if (typeof dbConfig.path !== 'string') {
      return Promise.reject('没有指定数据库文件路径')
    }

    return Promise.resolve(true)
  }

  static close(done) {
    return new Promise(resolve => {
      if (cachedWritableDbPool) {
        cachedWritableDbPool.end(resolve)
        cachedWritableDbPool = null
        logger.info(`关闭写数据库（write）连接池`)
      } else
        resolve(true)
    }).then(() => {
      return cachedMasterDbPool ?
        new Promise(resolve => {
          cachedMasterDbPool.end(resolve)
          cachedMasterDbPool = null
          logger.info(`关闭默认数据库（master）连接池`)
        }) :
        true
    }).then(() => {
      if (done && typeof done === 'function') done()
    })
  }
  /**
   * 获得数据库连接
   * 
   * @param {*} options 
   * @param {sting} options.pathOrConfig 
   * @param {boolean} options.isWritableConn 
   * @param {Connection} options.backupConn 如果没有获得指定条件的连接，就返回这个连接
   * 
   * @return {Connection} 数据库连接
   */
  static async getConnection({
    pathOrConfig = process.cwd() + "/config/db.js",
    isWritableConn = false,
    backupConn = null
  } = {}) {
    // 从连接池获得连接
    await DbContext.getPool(pathOrConfig)

    return await connect({
      isWritableConn,
      backupConn
    })
  }
}

module.exports = {
  DbContext
}