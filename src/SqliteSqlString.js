var SqlString = exports

var ID_GLOBAL_REGEXP = /`/g
var QUAL_GLOBAL_REGEXP = /\./g
var CHARS_GLOBAL_REGEXP = /[\0\b\t\n\r\x1a\"\'\\]/g // eslint-disable-line no-control-regex

SqlString.escapeId = function escapeId(val, forbidQualified) {
  if (Array.isArray(val)) {
    var sql = ''

    for (var i = 0; i < val.length; i++) {
      sql += (i === 0 ? '' : ', ') + SqlString.escapeId(val[i], forbidQualified)
    }

    return sql
  } else if (forbidQualified) {
    return '`' + String(val).replace(ID_GLOBAL_REGEXP, '``') + '`'
  } else {
    return (
      '`' +
      String(val)
        .replace(ID_GLOBAL_REGEXP, '``')
        .replace(QUAL_GLOBAL_REGEXP, '`.`') +
      '`'
    )
  }
}

SqlString.escape = function escape(val, stringifyObjects) {
  if (val === undefined || val === null) {
    return 'NULL'
  }

  switch (typeof val) {
    case 'boolean':
      return val ? 'true' : 'false'
    case 'number':
      return val + ''
    case 'object':
      if (Array.isArray(val)) {
        return SqlString.arrayToList(val)
      } else if (typeof val.toSqlString === 'function') {
        return String(val.toSqlString())
      } else if (stringifyObjects) {
        return escapeString(val.toString())
      } else {
        return SqlString.objectToValues(val)
      }
    default:
      return escapeString(val)
  }
}

SqlString.arrayToList = function arrayToList(array) {
  var sql = ''

  for (var i = 0; i < array.length; i++) {
    var val = array[i]

    if (Array.isArray(val)) {
      sql += (i === 0 ? '' : ', ') + '(' + SqlString.arrayToList(val) + ')'
    } else {
      sql += (i === 0 ? '' : ', ') + SqlString.escape(val, true)
    }
  }

  return sql
}

SqlString.format = function format(sql, values, stringifyObjects) {
  if (values == null) {
    return sql
  }

  if (!(values instanceof Array || Array.isArray(values))) {
    values = [values]
  }

  var chunkIndex = 0
  var placeholdersRegex = /\?+/g
  var result = ''
  var valuesIndex = 0
  var match

  while (valuesIndex < values.length && (match = placeholdersRegex.exec(sql))) {
    var len = match[0].length

    if (len > 2) {
      continue
    }

    var value =
      len === 2 ? SqlString.escapeId(values[valuesIndex]) : SqlString.escape(values[valuesIndex], stringifyObjects)

    result += sql.slice(chunkIndex, match.index) + value
    chunkIndex = placeholdersRegex.lastIndex
    valuesIndex++
  }

  if (chunkIndex === 0) {
    // Nothing was replaced
    return sql
  }

  if (chunkIndex < sql.length) {
    return result + sql.slice(chunkIndex)
  }

  return result
}

SqlString.objectToValues = function objectToValues(object) {
  var sql = ''

  for (var key in object) {
    var val = object[key]

    if (typeof val === 'function') {
      continue
    }

    sql += (sql.length === 0 ? '' : ', ') + SqlString.escapeId(key) + ' = ' + SqlString.escape(val, true)
  }

  return sql
}

function escapeString(val) {
  return "'" + val + "'"
}
