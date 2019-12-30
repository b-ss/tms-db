const _ = require('lodash')
const { DbContext } = require('./context')

// 记录执行的SQL
const EXEC_SQL_STACK = Symbol('exec_sql_stack')

/**
 * where条件
 */
const WhereMatchOps = ['=', '>', '>=', '<', '<=', '<>', 'like']
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
    if (WhereMatchOps.indexOf(op) === -1 || !/number|string/.test(typeof match)) return this

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
    this.pieces.push(
      `${this.server.escapeId(field)} between ${this.server.escape(match[0])} and ${this.server.escape(match[1])}`
    )
    return this
  }

  fieldNotBetween(field, match) {
    this.pieces.push(
      `${this.server.escapeId(field)} not between ${this.server.escape(match[0])} and ${this.server.escape(match[1])}`
    )
    return this
  }

  exists(match) {
    this.pieces.push(`exists('${match}')`)
    return this
  }

  and(match) {
    if (!Array.isArray(match) || match.length === 0) return this

    let subs = match.filter(sub => typeof sub === 'string')

    if (subs.length === 0) return this

    this.pieces.push(`(${subs.join(' and ')})`)
    return this
  }

  or(match) {
    if (!Array.isArray(match) || match.length <= 1) return this

    let subs = match.filter(sub => typeof sub === 'string')

    if (subs.length <= 1) return this

    this.pieces.push(`(${subs.join(' or ')})`)
    return this
  }

  get sql() {
    return this.pieces.join(' and ')
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
  async exec({ useWritableConn = false } = {}) {
    if (this.server.debug) {
      this.server.execSqlStack = this.sql
      return Promise.resolve([])
    }
    return this.server.execSql(this.sql, { useWritableConn })
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
    if (Object.keys(this.data).length === 0) throw new Error('数据错误')

    let fields = Object.keys(this.data)
    let values = fields.map(f => (typeof this.data[f] === 'object' ? JSON.stringify(this.data[f]) : this.data[f]))

    return `INSERT INTO ${this.table}(${this.server.escapeId(fields)}) VALUES(${this.server.escape(values)})`
  }
  async exec({ isAutoIncId = false } = {}) {
    if (this.server.debug) {
      this.server.execSqlStack = this.sql
      return Promise.resolve()
    }
    return this.server
      .execSql(this.sql, { useWritableConn: true })
      .then(result => (isAutoIncId ? result.insertId : result.affectedRows))
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
    return this.server.execSql(this.sql, { useWritableConn: true }).then(result => result.affectedRows)
  }
}

class Update extends StatementWithWhere {
  constructor(server, table, data = {}) {
    super(server, table)
    this.data = data
  }

  get sql() {
    if (Object.keys(this.data).length === 0) throw new Error('数据错误')

    return `UPDATE ${this.table} SET ${this.server.escape(this.data)} WHERE ${this.where.sql}`
  }
  async exec() {
    if (this.server.debug) {
      this.server.execSqlStack = this.sql
      return Promise.resolve(0)
    }
    return this.server.execSql(this.sql, { useWritableConn: true }).then(result => result.affectedRows)
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
    if (typeof offset === 'number' && !isNaN(offset) && (typeof length === 'number' && !isNaN(length))) {
      this.limitVal = ` LIMIT ${offset},${length}`
    }
  }

  get sql() {
    let sql = `SELECT ${this.fields} FROM ${this.table} WHERE ${this.where.sql}`
    if (this.groupBy) sql += `${this.groupBy}`
    if (this.orderBy) sql += `${this.orderBy}`
    if (this.limitVal) sql += `${this.limitVal}`
    return sql
  }
}
class SelectOne extends Select {
  async exec({ useWritableConn = false } = {}) {
    return super
      .exec({
        useWritableConn
      })
      .then(rows => {
        if (rows.length === 1) return rows[0]
        else if (rows.length === 0) return false
        else return Promise.reject('查询条件错误，获得多条数据')
      })
  }
}
class SelectOneVal extends Select {
  async exec({ useWritableConn = false } = {}) {
    return super
      .exec({
        useWritableConn
      })
      .then(rows => {
        if (rows.length === 1) return Object.values(rows[0])[0]
        else if (rows.length === 0) return false
        else return Promise.reject('查询条件错误，获得多条数据')
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
  constructor({ ctx = null, debug = false } = {}) {
    this[DB_CONTEXT] = ctx || new DbContext()
    this[DEBUG_MODE] = debug
  }
  get ctx() {
    return this[DB_CONTEXT]
  }
  get debug() {
    return this[DEBUG_MODE]
  }
  set execSqlStack(sql) {
    if (undefined === this[EXEC_SQL_STACK]) this[EXEC_SQL_STACK] = []
    this[EXEC_SQL_STACK].push(sql)
  }
  get execSqlStack() {
    return this[EXEC_SQL_STACK]
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
  end(done) {
    delete this[EXEC_SQL_STACK]
    if (done && typeof done === 'function') done()
  }
  /**
   * 自动解析记录中json串
   *
   * @param {Array} rows 要处理的记录
   * @param {Array} includeKeys 需要处理的字段
   * @param {Array} excludeKeys 不需要处理的字段
   */
  parseJson(rows, includeKeys = [], excludeKeys = []) {
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return rows
    }
    let keys = Object.keys(rows[0])
    if (Array.isArray(includeKeys) && includeKeys.length) {
      keys = _.intersection(keys, includeKeys)
    }
    if (Array.isArray(excludeKeys) && excludeKeys.length) {
      keys = _.pullAll(keys, excludeKeys)
    }
    if (keys.length === 0) return rows

    rows.forEach(row => {
      keys.forEach(k => {
        if (typeof row[k] === 'string') {
          try {
            let obj = JSON.parse(row[k])
            if (obj && typeof obj === 'object') {
              row[k] = obj
            }
          } catch (e) {}
        }
      })
    })
  }
  // 需要子类实现的方法
  escape(v) {}
  escapeId(v) {}
  execSql(sql) {}
}

module.exports = {
  DbServer
}
