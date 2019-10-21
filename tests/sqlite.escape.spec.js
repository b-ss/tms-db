describe('#server', function() {
  const { TmsSqlite3 } = require('@/src/sqlite')
  let db
  beforeAll(async () => {
    db = new TmsSqlite3()
  })
  describe('#参数escape', function() {
    it('undefined -> NULL', () => {
      expect(db.escape(undefined)).toBe('NULL')
    })
    it('null -> NULL', () => {
      expect(db.escape(null)).toBe('NULL')
    })
    it('boolean -> string', () => {
      expect(db.escape(false)).toBe('false')
      expect(db.escape(true)).toBe('true')
    })
    it('number -> string', () => {
      expect(db.escape(123)).toBe('123')
    })
    it('objects -> string pairs', () => {
      // 注意结果包含空格
      expect(db.escape({ a: 'b', c: 'd' })).toBe("`a` = 'b', `c` = 'd'")
    })
    it('number arrays -> string', () => {
      // 注意结果包含空格
      expect(db.escape([1, 2, 3])).toBe('1, 2, 3')
    })
    it('string arrays -> string', () => {
      // 注意结果包含空格
      expect(db.escape(['a', 'b', 'c'])).toBe("'a', 'b', 'c'")
    })
    it('number and string mixed arrays -> string', () => {
      // 注意结果包含空格
      expect(db.escape([1, 'b', 'c'])).toBe("1, 'b', 'c'")
    })
    it('字符串两端加单引号', () => {
      let str = '0123456789abcdefghijklmnopqrstuvwxyz'
      let escaped = db.escape(str)
      expect(escaped).toBe(`'${str}'`)
    })
    it('\\ 反斜杠', () => {
      console.log('反斜杠：sup\\er')
      expect(db.escape('sup\\er')).toBe("'sup\\er'")
    })
    it("' 单引号", () => {
      console.log("单引号：sup'er")
      expect(db.escape("sup'er")).toBe("'sup'er'")
    })
    it('" 双引号', () => {
      console.log('双引号：sup"er')
      expect(db.escape('sup"er')).toBe("'sup\"er'")
    })
    it('中文 -> 中文', () => {
      expect(db.escape('中文')).toBe("'中文'")
    })
    it('对象属性是数组，转换为json串', () => {
      let obj = { f1: ['中文1', '中文2'] }
      //obj.f1 = JSON.stringify(obj.f1)
      //console.log('对象-json', obj.f1)
      expect(db.escape(obj)).toBe('`f1` = \'["中文1","中文2"]\'')
    })
    it('对象属性是对象，转换为json串', () => {
      let obj = { f1: { a: '中文1' } }
      //obj.f1 = JSON.stringify(obj.f1)
      //console.log('对象-json', obj.f1)
      expect(db.escape(obj)).toBe('`f1` = \'{"a":"中文1"}\'')
    })
  })
  describe('#表名，字段名escape', function() {
    it('column，添加撇号', () => {
      expect(db.escapeId('id')).toBe('`id`')
    })
    it('table.column，添加撇号', () => {
      expect(db.escapeId('table.id')).toBe('`table`.`id`')
    })
    it('column数组，添加撇号', () => {
      // 注意有空格
      expect(db.escapeId(['id', 'name'])).toBe('`id`, `name`')
    })
  })
})
