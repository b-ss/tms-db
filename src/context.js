const _ = require('lodash')
const log4js = require('@log4js-node/log4js-api')
const logger = log4js.getLogger('tms-db')
/**
 * 正常启动的数据库服务
 */
const _availableDialects = new Map()
/**
 * 数据库访问上下文对象，用于保存连接资源、事物、跟踪信息等
 */
const DB_CTX_TRANSACTION = Symbol('db_ctx_transaction')
/**
 * 数据服务统一管理
 */
class DbContext {
  /**
   * 初始化数据库服务
   *
   * @param {*} dbConfig 配置信息
   */
  static async init(dbConfig) {
    if (_availableDialects.size) _availableDialects.clear()
    if (typeof dbConfig !== 'object') {
      logger.error('数据库连接信息格式错误')
      return Promise.reject('数据库连接信息格式错误')
    }
    if (typeof dbConfig.mysql !== 'object' && typeof dbConfig.sqlite !== 'object') {
      logger.error('没有获得支持的数据库类型')
      return Promise.reject('没有获得支持的数据库类型')
    }
    let result = {}
    if (dbConfig.mysql) {
      let { TmsMysql } = require('./mysql')
      await TmsMysql.init(dbConfig.mysql)
      _availableDialects.set('mysql', true)
      result.mysql = true
    }

    if (dbConfig.sqlite) {
      let { TmsSqlite3 } = require('./sqlite')
      await TmsSqlite3.init(dbConfig.sqlite)
      _availableDialects.set('sqlite', true)
      result.sqlite = true
    }

    return Promise.resolve(result)
  }
  /**
   * 是否有可用的数据库
   * @param {string} dialect 数据库类型名称
   */
  static isAvailable(dialect) {
    return !!_availableDialects.get(dialect)
  }
  /**
   * 创建实例
   *
   * @param {*} param
   * @param {TmsTransaction} param.transaction 事物
   */
  constructor({ dialects = ['mysql', 'sqlite'], transaction = null, debug = false } = {}) {
    if (dialects.includes('mysql') && DbContext.isAvailable('mysql')) {
      let { TmsMysql } = require('./mysql')
      this.mysql = new TmsMysql({ ctx: this, debug })
    }
    if (dialects.includes('sqlite') && DbContext.isAvailable('sqlite')) {
      let { TmsSqlite3 } = require('./sqlite')
      this.sqlite = new TmsSqlite3({ ctx: this, debug })
    }
    this[DB_CTX_TRANSACTION] = transaction
  }
  /**
   * 系统配置的默认数据库服务
   */
  db() {
    if (this.mysql && this.sqlite) {
      return this.mysql
    } else if (this.mysql) {
      return this.mysql
    } else if (this.sqlite) {
      return this.sqlite
    }
    return null
  }
  /**
   * 结束数据库实例
   *
   * @param {function} done
   */
  end(done) {
    if (this.mysql) {
      this.mysql.end()
      this.mysql = null
    }
    if (this.sqlite) {
      this.sqlite.end()
      this.sqlite = null
    }
    if (typeof done === 'function') done()
  }
  /**
   * 结束数据库服务
   *
   * @param {function} done
   */
  static close(done) {
    if (DbContext.isAvailable('mysql')) {
      let { TmsMysql } = require('./mysql')
      TmsMysql.close()
      _availableDialects.delete('mysql')
    }
    if (DbContext.isAvailable('sqlite')) {
      let { TmsSqlite3 } = require('./sqlite')
      TmsSqlite3.close()
      _availableDialects.delete('sqlite')
    }
    if (typeof done === 'function') done()
  }
  /**
   *
   */
  get transaction() {
    return this[DB_CTX_TRANSACTION]
  }
  set transaction(trans) {
    this[DB_CTX_TRANSACTION] = trans
  }
}

module.exports = {
  DbContext
}
