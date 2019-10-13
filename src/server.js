const SqlString = require('sqlstring')
const {
  DbContext
} = require('./context')

/**
 * where条件
 */
const WhereMatchOps = ['=', '>', '>=', '<', '<this.conn=', '<>', 'like']
class WhereAssembler {
  /**
   * 
   * @param {Server} server 
   */
  constructor(server) {
    this.server = server
    this.pieces = []
  }

  fieldMatch(field, op, match) {
    if (WhereMatchOps.indexOf(op) === -1 || !/number|string/.test(typeof match))
      return this

    this.pieces.push(`${this.server.escapeId(field)} ${op} ${this.server.escape(match)}`)
    return this
  }

  fieldIn(field, match) {
    this.pieces.push(`${this.server.escapeId(field)} in(${this.server.escape(match)})`)
    return this
  }

  fieldNotIn(field, match) {
    this.pieces.push(`${this.server.escapeId(field)} not in(${this.server.escape(match)})`)
    return this
  }

  fieldBetween(field, match) {
    this.pieces.push(`${this.server.escapeId(field)} between ${this.server.escape(match[0])} and ${this.server.escape(match[1])}`)
    return this
  }

  fieldNotBetween(field, match) {
    this.pieces.push(`${this.server.escapeId(field)} not between ${this.server.escape(match[0])} and ${this.server.escape(match[1])}`)
    return this
  }

  exists(match) {
    this.pieces.push(`exists('${match}')`)
    return this
  }

  and(match) {
    if (!Array.isArray(match) || match.length === 0)
      return this

    let subs = match.filter(sub => typeof sub === 'string')

    if (subs.length === 0)
      return this

    this.pieces.push(`(${subs.join(' and ')})`)
    return this

  }

  or(match) {
    if (!Array.isArray(match) || match.length <= 1)
      return this

    let subs = match.filter(sub => typeof sub === 'string')

    if (subs.length <= 1)
      return this

    this.pieces.push(`(${subs.join(' or ')})`)
    return this
  }

  get sql() {
    return this.pieces.join(' and ');
  }
}

class Statement {
  /**
   * 
   * @param {Server} server
   * @param {string} table 
   */
  constructor(server, table) {
    this.server = server
    this.table = table
  }
  async exec({
    useWritableConn = false
  } = {}) {
    if (this.server.debug) {
      this.server.execSqlStack = this.sql
      return Promise.resolve([])
    }
    return new Promise((resolve, reject) => {
      this.server.execSql(this.sql, useWritableConn, (error, result) => {
        if (error) {
          let msg = `执行SQL语句失败(${error.sqlMessage||error.code})`
          logger.debug(msg, error)
          reject(msg)
        } else {
          resolve(result)
        }
      })
    })
  }
}
/**
 * 插入语句
 */
class Insert extends Statement {
  /**
   * 
   * @param {Db} server
   * @param {string} table 
   * @param {object} data 
   */
  constructor(server, table, data = {}) {
    super(server, table)
    this.data = data
  }

  get sql() {
    if (Object.keys(this.data).length === 0)
      throw new Error('数据错误')

    let fields = Object.keys(this.data)
    let values = fields.map(f => this.data[f])

    return `INSERT INTO ${this.table}(${this.server.escapeId(fields)}) VALUES(${this.server.escape(values)})`
  }
  async exec({
    isAutoIncId = false
  } = {}) {
    if (this.server.debug) {
      this.server.execSqlStack = this.sql
      return Promise.resolve()
    }
    return new Promise((resolve, reject) => {
      this.server.execSql(this.sql, true, (error, result) => {
        if (error) {
          let msg = `执行SQL语句失败(${error.sqlMessage||error.code})`
          logger.debug(msg, error)
          reject(msg)
        } else {
          if (isAutoIncId)
            resolve(result.insertId)
          else
            resolve(result.affectedRows)
        }
      })
    })
  }
}

class StatementWithWhere extends Statement {

  constructor(server, table) {
    super(server, table)
    this.whereAssembler = new WhereAssembler(server)
  }

  get where() {
    return this.whereAssembler
  }
}

class Delete extends StatementWithWhere {

  constructor(server, table) {
    super(server, table)
  }

  get sql() {
    return `DELETE FROM ${this.table} WHERE ${this.where.sql}`
  }

  exec() {
    if (this.server.debug) {
      this.server.execSqlStack = this.sql
      return Promise.resolve(0)
    }
    return new Promise((resolve, reject) => {
      this.server.execSql(this.sql, true, (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve(result.affectedRows)
        }
      })
    })
  }
}

class Update extends StatementWithWhere {

  constructor(server, table, data = {}) {
    super(server, table)
    this.data = data
  }

  get sql() {
    if (Object.keys(this.data).length === 0)
      throw new Error('数据错误')

    return `UPDATE ${this.table} SET ${this.server.escape(this.data)} WHERE ${this.where.sql}`
  }
  async exec() {
    if (this.server.debug) {
      this.server.execSqlStack = this.sql
      return Promise.resolve(0)
    }
    return new Promise((resolve, reject) => {
      this.server.execSql(this.sql, true, (error, result) => {
        if (error) {
          let msg = `执行SQL语句失败(${error.sqlMessage||error.code})`
          logger.debug(msg, error)
          reject(msg)
        } else {
          resolve(result.affectedRows)
        }
      })
    })
  }
}

class Select extends StatementWithWhere {

  constructor(server, table, fields) {
    super(server, table)
    this.fields = fields
    this.groupBy = ''
    this.orderBy = ''
    this.limitVal = ''
  }

  group(group = null) {
    if (typeof group === 'string') {
      this.groupBy = ` GROUP BY ` + group
    }
  }

  order(order = null) {
    if (typeof order === 'string') {
      this.orderBy = ` ORDER BY ` + order
    }
  }

  limit(offset = null, length = null) {
    if ((typeof offset === 'number' && !isNaN(offset)) && (typeof length === 'number' && !isNaN(length))) {
      this.limitVal = ` LIMIT ${offset},${length}`
    }
  }

  get sql() {
    let sql = `SELECT ${this.fields} FROM ${this.table} WHERE ${this.where.sql}`
    if (this.groupBy)
      sql += `${this.groupBy}`
    if (this.orderBy)
      sql += `${this.orderBy}`
    if (this.limitVal)
      sql += `${this.limitVal}`
    return sql
  }
}
class SelectOne extends Select {
  async exec({
    useWritableConn = false
  } = {}) {
    return super.exec({
      useWritableConn
    }).then((rows) => {
      if (rows.length === 1)
        return rows[0]
      else if (rows.length === 0)
        return false
      else
        return Promise.reject('查询条件错误，获得多条数据')
    })
  }
}
class SelectOneVal extends Select {
  async exec({
    useWritableConn = false
  } = {}) {
    return super.exec({
      useWritableConn
    }).then((rows) => {
      if (rows.length === 1)
        return Object.values(rows[0])[0]
      else if (rows.length === 0)
        return false
      else
        return Promise.reject('查询条件错误，获得多条数据')
    })
  }
}
/**
 * 数据库服务
 */
// 执行模式，debug=true连接数据库
const DEBUG_MODE = Symbol('debug_mode')
// 用户保存数据的上下文
const DB_CONTEXT = Symbol('db_context')

class DbServer {
  /**
   * 
   * @param {DbContext} ctx 
   * @param {boolean} debug 
   */
  constructor({
    ctx = null,
    debug = false
  } = {}) {
    this[DB_CONTEXT] = ctx || new DbContext()
    this[DEBUG_MODE] = debug
  }
  get ctx() {
    return this[DB_CONTEXT]
  }
  /**
   * 获得默认连接
   * 
   * @param {boolean} autoCreate 
   * 
   */
  async conn(autoCreate = true) {
    let conn
    if (this.ctx.conn)
      conn = this.ctx.conn
    else if (autoCreate) {
      conn = await DbContext.getConnection({
        isWritableConn: false
      })
      this.ctx.conn = conn
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
    if (this.ctx.writableConn)
      conn = this.ctx.writableConn
    else if (autoCreate) {
      conn = await DbContext.getConnection({
        isWritableConn: true,
        backupConn: this.ctx.conn
      })
      this.ctx.writableConn = conn
    }

    return conn
  }
  get debug() {
    return this[DEBUG_MODE]
  }
  set execSqlStack(sql) {
    this.ctx.execSqlStack = sql
  }
  get execSqlStack() {
    return this.ctx.execSqlStack
  }
  newInsert(table, data) {
    return new Insert(this, table, data)
  }

  newDelete(table) {
    return new Delete(this, table)
  }

  newUpdate(table, data) {
    return new Update(this, table, data)
  }

  newSelect(table, fields) {
    return new Select(this, table, fields)
  }

  newSelectOne(table, fields) {
    return new SelectOne(this, table, fields)
  }

  newSelectOneVal(table, fields) {
    return new SelectOneVal(this, table, fields)
  }

  execSql(sql, useWritableConn, callback) {

  }
  escape(v) {
    return SqlString.escape(v)
  }
  escapeId(v) {
    return SqlString.escapeId(v)
  }
}

module.exports = {
  DbServer
}