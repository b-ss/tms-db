class Mysql {
  open(dbConfig) {
    // 只创建1次连接池
    if (cachedMasterDbPool && cachedWritableDbPool)
      return Promise.resolve([cachedMasterDbPool, cachedWritableDbPool])

    let oPoolConfig = dbConfig.master
    let oDefaultConfig = {
      supportBigNumbers: true,
      bigNumberStrings: true
    }
    Object.assign(oPoolConfig, oDefaultConfig)

    let dbPool = mysql.createPool(oPoolConfig)
    return new Promise((resolve, reject) => {
      dbPool.query('SELECT 1 + 1', function (error) {
        if (error) {
          dbPool.end()
          reject(`建立默认数据库连接池（master）失败(${error.code})`)
        } else
          resolve(dbPool)
      });
    }).then(dbPool => {
      logger.info(`建立默认数据库（master）连接池`)
      cachedMasterDbPool = dbPool
      if (!dbConfig.write) {
        cachedWritableDbPool = cachedMasterDbPool
        return [cachedMasterDbPool, cachedWritableDbPool]
      }
      // 单独配置了写数据库
      let oPoolConfig = dbConfig.write
      Object.assign(oPoolConfig, oDefaultConfig)
      dbPool = mysql.createPool(oPoolConfig)
      return new Promise((resolve, reject) => {
        dbPool.query('SELECT 1 + 1', function (error) {
          if (error) {
            dbPool.end()
            reject(`建立写数据库（write）连接池失败(${error.code})`)
          } else
            resolve(dbPool)
        });
      }).then(dbPool => {
        logger.info(`建立写数据库（write）连接池`)
        cachedWritableDbPool = dbPool
        return [cachedMasterDbPool, cachedWritableDbPool]
      })
    })
  }
  exec() {

  }
  /**
   * 连接数据库
   * 
   * @param {Boolean} isWritableConn 
   * @param {Connection} backupConn
   */
  connect({
    isWritableConn,
    conn: backupConn = null
  }) {
    dbConnCount++
    return new Promise((resolve, reject) => {
      let beginAt = Date.now()

      // 如果没有独立的写数据库，且指定了已有连接，就直接返回已有连接
      if (cachedMasterDbPool === cachedWritableDbPool && isWritableConn && !backupConn)
        return backupConn

      let connPool = isWritableConn ? cachedWritableDbPool : cachedMasterDbPool
      connPool.getConnection((err, conn) => {
        if (err) {
          let msg = `获得${isWritableConn?'写':'默认'}数据库连接失败(${err.code})`
          logger.warn(msg)
          logger.debug(msg, err)
          reject(msg)
        } else {
          let duration = Date.now() - beginAt
          logger.info(`获得${isWritableConn?'写':'默认'}数据库连接(${dbConnCount})(${duration}ms)(${conn.threadId})`)
          resolve(conn)
        }
      })
    })
  }
}

class MysqlConn {

}

module.exports = {
  Mysql,
  MysqlConn
}