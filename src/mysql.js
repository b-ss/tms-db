const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-db-mysql')
const mysql = require('mysql')
const SqlString = require('sqlstring')
const { DbServer } = require('./server')

// 数据库连接池，只初始化1次。
let _pool = { master: null, writable: null }
//
let RUNING_CONN_MASTER_PROMISE = Symbol('_runningConnMasterPromise')
//
let RUNING_CONN_WRITE_PROMISE = Symbol('_runningConnWritePromise')
/**
 * MySQL数据库服务
 */
class TmsMysql extends DbServer {
  /**
   *
   * @param {*} pool
   * @param {*} name
   */
  static testPool(pool, name) {
    return new Promise((resolve, reject) => {
      pool.query('SELECT 1 + 1', error => {
        if (error) {
          pool.end()
          reject(`建立默认数据库连接池（${name}）失败(${error.code})`)
        } else resolve(pool)
      })
    })
  }
  /**
   *
   * @param {string} name
   */
  static closePool(name) {
    if (!_pool[name]) return Promise.resolve(true)
    return new Promise(resolve => {
      _pool[name].end(() => {
        _pool[name] = null
        logger.info(`关闭写数据库（${name}）连接池`)
        resolve(true)
      })
    })
  }
  /**
   * 初始化MySQL服务，创建连接池
   *
   * @param {object} dbConfig
   */
  static init(dbConfig) {
    if (_pool.master) return [_pool.master, _pool.writable]

    if (typeof dbConfig.master !== 'object') {
      logger.error('没有指定默认数据库（master）连接参数')
      return Promise.reject('没有指定默认数据库（master）连接参数')
    }

    let oPoolConfig = dbConfig.master
    let oDefaultConfig = {
      supportBigNumbers: true,
      bigNumberStrings: true
    }
    Object.assign(oPoolConfig, oDefaultConfig)

    let dbPool = mysql.createPool(oPoolConfig)

    return TmsMysql.testPool(dbPool, 'master').then(dbPool => {
      logger.info(`建立默认数据库（master）连接池`)
      _pool.master = dbPool
      // 是否需要写连接池？
      if (!dbConfig.write) {
        _pool.writable = _pool.master
        return true
      }
      // 单独配置了写数据库
      let oPoolConfig = dbConfig.write
      Object.assign(oPoolConfig, oDefaultConfig)
      dbPool = mysql.createPool(oPoolConfig)
      return TmsMysql.testPool(dbPool, 'write').then(dbPool => {
        logger.info(`建立写数据库（write）连接池`)
        _pool.writable = dbPool
        return true
      })
    })
  }
  /**
   * 释放连接池
   *
   * @param {*} done
   */
  static async close(done) {
    await TmsMysql.closePool('writable')
    await TmsMysql.closePool('master')
    if (done && typeof done === 'function') done()
  }
  get masterPool() {
    return _pool.master
  }
  get writablePool() {
    return _pool.writable
  }
  adaptivePool(useWritable = false) {
    return useWritable ? this.writablePool : this.masterPool
  }
  /**
   *
   * @param {MysqlContext} ctx
   * @param {boolean} debug
   */
  constructor({ ctx = null, debug = false } = {}) {
    super({ ctx, debug })
    this.conn = {}
  }
  /**
   * 获得默认连接
   *
   * @param {boolean} autoCreate
   *
   */
  async masterConn(autoCreate = true) {
    let conn
    if (this.conn.master) conn = this.conn.master
    else if (autoCreate) {
      if (!this[RUNING_CONN_MASTER_PROMISE]) {
        this[RUNING_CONN_MASTER_PROMISE] = this.connect()
      }
      this.conn.master = conn = new Promise(resolve => {
        this[RUNING_CONN_MASTER_PROMISE].then(connect => resolve(connect))
      })
    }

    return conn
  }
  /**
   * 写数据库连接
   *
   * @param {boolean} autoCreate
   *
   */
  async writableConn(autoCreate = true) {
    let conn
    if (this.conn.writable) conn = this.conn.writable
    else if (autoCreate) {
      if (!this[RUNING_CONN_WRITE_PROMISE]) {
        this[RUNING_CONN_WRITE_PROMISE] = this.connect({ useWritable: true })
      }
      this.conn.writable = conn = new Promise(resolve => {
        this[RUNING_CONN_WRITE_PROMISE].then(connect => resolve(connect))
      })
    }

    return conn
  }
  /**
   * 返回匹配的数据库连接
   *
   * @param {boolean} useWritable 是否需要支持写操作
   */
  async adaptiveConn(useWritable) {
    const conn = useWritable ? await this.writableConn() : await this.masterConn()
    return conn
  }
  /**
   * 数据库连接
   *
   * @param {boolean} useWritable
   *
   * @return {Promise}
   */
  connect({ useWritable = false } = {}) {
    // 如果没有独立的写数据库，且已有默认连接，就直接返回默认连接
    if (useWritable) {
      if (this.masterPool === this.writablePool) {
        if (this.conn.master) return Promise.resolve(this.conn.master)
        else useWritable = false
      }
    }

    return new Promise((resolve, reject) => {
      let beginAt = Date.now()
      let pool = this.adaptivePool(useWritable)
      pool.getConnection((err, conn) => {
        if (err) {
          let msg = `获得${useWritable ? '写' : '默认'}数据库连接失败(${err.code})`
          logger.warn(msg)
          logger.debug(msg, err)
          reject(msg)
        } else {
          let duration = Date.now() - beginAt
          logger.info(`获得${useWritable ? '写' : '默认'}数据库连接(${duration}ms)(${conn.threadId})`)
          resolve(conn)
        }
      })
    })
  }
  /**
   *
   * @param {*} conn
   * @param {*} done
   */
  closeConnection(conn, done) {
    if (conn && typeof conn.release === 'function') {
      let threadId = conn.threadId
      conn.release()
      logger.info(`关闭写数据库连接（${threadId}）`)
    } else if (conn && typeof conn.then === 'function') {
      conn.then(conn2 => {
        let threadId = conn2.threadId
        conn2.release()
        logger.info(`关闭写数据库连接（${threadId}）`)
      })
    }
    if (done && typeof done === 'function') done()
  }
  /**
   * 结束服务
   *
   * @param {function} done
   */
  end(done) {
    this.closeConnection(this.conn.writable, () => {
      this.closeConnection(this.conn.master, () => {
        super.end(done)
      })
    })
  }
  /**
   *
   * @param {*} v
   */
  escape(v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      let v2 = Object.assign({}, v)
      Object.keys(v2).forEach(k => {
        if (typeof v2[k] === 'object') {
          v2[k] = JSON.stringify(v2[k])
        }
      })
      return SqlString.escape(v2)
    }
    return SqlString.escape(v)
  }
  escapeId(v) {
    return SqlString.escapeId(v)
  }
  /**
   * 执行SQL语句
   *
   * @param {string} sql 要执行的sql
   * @param {object} options
   * @param {boolean} [options.useWritableConn = false] 是否使用写连接
   *
   * @return {Promise}
   */
  execSql(sql, { useWritableConn = false, parseJson = { includeKeys: null, excludeKeys: null } } = {}) {
    let _this = this
    return new Promise((resolve, reject) => {
      this.adaptiveConn(useWritableConn).then(conn => {
        conn.query(sql, (error, result) => {
          if (error) {
            let msg = `执行SQL语句失败(${error.sqlMessage || error.code})`
            logger.debug(msg, error)
            return reject(msg)
          }
          _this.parseJson(result, parseJson.includeKeys, parseJson.excludeKeys)
          resolve(result)
        })
      })
    })
  }
}

module.exports = {
  TmsMysql
}
