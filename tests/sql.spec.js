let { DbServer } = require('@/src/server')

describe('#sql', function() {
  let db
  beforeAll(() => {
    db = new DbServer()
  })
  describe('#Where', function() {
    let select, where
    beforeAll(() => {
      select = db.newSelect('test', 'a,b,c')
      where = select.where
    })
    test('field=match', () => {
      where.fieldMatch('f', '=', 'a')
      expect(where.pieces[0]).toBe("`f` = 'a'")
    })
    test('field in(match)', () => {
      where.fieldIn('f', ['a', 'b', 'c'])
      expect(where.pieces[1]).toBe("`f` in('a', 'b', 'c')")
    })
    test('field not in(match)', () => {
      where.fieldNotIn('f', ['a', 'b', 'c'])
      expect(where.pieces[2]).toBe("`f` not in('a', 'b', 'c')")
    })
    test('field between match0 and match1', () => {
      where.fieldBetween('f', [1, 2])
      expect(where.pieces[3]).toBe('`f` between 1 and 2')
    })
    test('field not between match0 and match1', () => {
      where.fieldNotBetween('f', [1, 2])
      expect(where.pieces[4]).toBe('`f` not between 1 and 2')
    })
    test('exists', () => {
      where.exists('select c from t')
      expect(where.pieces[5]).toBe(`exists('select c from t')`)
    })
    test('and', () => {
      where.and(['a=1', 'b=2'])
      expect(where.pieces[6]).toBe(`(a=1 and b=2)`)
    })
    test('or', () => {
      where.or(['a=1', 'b=2'])
      expect(where.pieces[7]).toBe(`(a=1 or b=2)`)
    })
    test('where', () => {
      expect(where.sql).toBe(
        "`f` = 'a' and `f` in('a', 'b', 'c') and `f` not in('a', 'b', 'c') and `f` between 1 and 2 and `f` not between 1 and 2 and exists('select c from t') and (a=1 and b=2) and (a=1 or b=2)"
      )
    })
  })
})
