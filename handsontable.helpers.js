/**
 * Handsontable helper functions
 * artbels @ 2016
 *
 */

;(function () {
  var HH = this.HH = {}

  HH.reJsStrData = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z/i

  HH.typesMap = {
    'string': 'text',
    'number': 'numeric',
    'boolean': 'checkbox',
    'object': 'text',
    'date': 'date'
  }

  HH.draw = function (objArr, params) {
    if (typeof params === 'string') {
      params = {
        parent: document.querySelector(params)
      }
    }

    if ((typeof params === 'undefined') && (objArr.constructor == Object)) {
      params = objArr
      objArr = undefined
    }

    params = params || {}

    if (typeof params.instance !== 'undefined') params.instance.destroy()

    params.parent = params.parent || document.querySelector('#ht') || document.body

    if (typeof params.contextMenu === 'undefined') params.contextMenu = false
    else params.contextMenu = params.contextMenu

    params.columns = params.columns ||
      (objArr && HH.getColumns(objArr, params.cols))

    params.colHeaders = (params.colHeaders !== undefined) ? params.colHeaders :
      (params.columns && params.columns.map(function (a) {
        return a.data
      }))

    if (params.manualColumnResize !== undefined) {
      params.manualColumnResize = Boolean(params.manualColumnResize)
    }

    if (params.readOnly && params.columns) {
      params.columns = params.columns.map(function (a) {
        a.readOnly = true
        return a
      })
    }

    var hhParams = {
      data: objArr
    }

    for (var prop in params) {
      if (['parent', 'readOnly', 'instance', 'cols'].indexOf(prop) !== -1) continue
      hhParams[prop] = params[prop]
    }

    params.instance = new Handsontable(params.parent, hhParams)
  }

  HH.setColType = function (prop, jsType) {
    var col = {
      data: prop,
      jsType: jsType
    }

    col.type = HH.typesMap[col.jsType]
    if (['id', '_id', 'objectId'].indexOf(prop) != -1) col.readOnly = true
    if (col.jsType == 'date') col.dateFormat = 'DD-MMM-YYYY'
    else if (col.jsType == 'number') col.format = '0.[0000000000]'
    return col
  }

  HH.getColumns = function (objArr, cols) {
    var props = {}
    var columns = []
    var col

    for (var i = 0; i < objArr.length; i++) {
      var row = objArr[i]
      for (var key in row) {
        var val = row[key]
        var jsType = typeof val
        if (jsType === 'string') {
          if (HH.reJsStrData.test(val)) jsType = 'date'
        }
        if (!props[key]) props[key] = jsType
      }
    }

    if (cols) {
      for (var j = 0; j < cols.length; j++) {
        var colName = cols[j]
        if (props[colName]) {
          col = HH.setColType(colName, props[colName])
          columns.push(col)
        }
      }
    } else {
      var fields = Object.keys(props)

      for (var p = 0; p < fields.length; p++) {
        var prop = fields[p]
        col = HH.setColType(prop, props[prop])
        columns.push(col)
      }
    }

    return columns
  }

  HH.setDataType = function (data, type) {
    switch (type) {
      case 'number':
        if ((data === '') || isNaN(data)) data = undefined
        else data = Number(data)
        break

      case 'boolean':
        data = Boolean(data)
        break

      case 'array':
        try {
          data = JSON.parse(data)
        } catch (e) {
          data = data.split(/,|;|\t/)
        }
        break

      case 'object':
        try {
          data = JSON.parse(data)
        } catch (e) {
          console.log(e)
        }
        break

      case 'date':
        if (data) {
          try {
            data = new Date(data)
          } catch (e) {
            console.log(e)
          }
        }
        break
    }
    return data
  }

  HH.groupChanges = function (changes, src, columns) {
    var rowGroups = {}

    if (['external', 'loadData'].indexOf(src) != -1) return rowGroups
    if (!changes || !changes.length) return rowGroups

    for (var i = 0; i < changes.length; i++) {
      var change = changes[i]
      if (!change) continue

      if (change[3] === change[2]) continue

      if (!rowGroups[Number(change[0])]) {
        rowGroups[Number(change[0])] = {}
      }

      if (columns) {
        var fieldType
        for (var t = 0; t < columns.length; t++) {
          var col = columns[t]
          if (col.data == change[1]) fieldType = col.jsType
        }

        rowGroups[Number(change[0])][change[1]] = {
          new: HH.setDataType(change[3], fieldType),
          old: change[2]
        }
      } else rowGroups[Number(change[0])][change[1]] = {new: change[3], old: change[2]}
    }
    return rowGroups
  }

  HH.convArrArrToArrObj = function (hotData, columns, minSpareRows, colHeaders) {
    if (!hotData || !columns) throw Error('!hotData || !columns')

    minSpareRows = minSpareRows || 0

    var arr = []

    colHeaders = colHeaders || columns.map(function (a) {
      return a.data
    })

    for (var i = 0; i < hotData.length - minSpareRows; i++) {
      var row = hotData[i]
      var o = {}
      var allRowsEmpty = true
      for (var j = 0; j < row.length; j++) {
        var cell = row[j]
        var prop = colHeaders[j]
        var type = columns[j].jsType

        if ((typeof cell === 'undefined') || (cell === null)) continue
        allRowsEmpty = false

        o[prop] = HH.setDataType(cell, type)
      }
      if (!allRowsEmpty) arr.push(o)
    }
    return arr
  }

  HH.stringifyArrObj = function (arr) {
    if ((!arr) && (typeof (arr[0]) !== 'object')) return

    for (var i = 0; i < arr.length; i++) {
      var row = arr[i]
      for (var key in row) {
        var cell = row[key]
        var type = typeof cell
        var isDate = HH.reJsStrData.test(cell)

        if (type == 'object') arr[i][key] = JSON.stringify(cell)
        else if (isDate) arr[i][key] = moment(new Date(cell)).format('DD-MMM-YYYY')
      }
    }
    return arr
  }

  HH.convArrObjArrArr = function (arr) {
    var uniqColumns = {}
    var finArr = []

    for (var i = 0; i < arr.length; i++) {
      for (var key in arr[i]) {
        uniqColumns[key] = true
      }
    }

    var columns = Object.keys(uniqColumns)
    finArr.push(columns)

    for (var j = 0; j < arr.length; j++) {
      var row = arr[j]
      var rowArr = []
      for (var col in uniqColumns) {
        var cell = row[col]
        rowArr.push(cell)
      }
      finArr.push(rowArr)
    }
    return finArr
  }

  HH.setHeadersFirstRow = function (hot) {
    var colHeaders = [],
      columns = [],
      hotData = hot.getData(),
      firstRow = hotData[0],
      data = hotData.splice(1),
      deleteCols = []

    for (var i in firstRow) {
      var name = firstRow[i]
      if (name) {
        colHeaders.push(name)
        columns.push({
          type: 'text'
        })
      } else deleteCols.push(i)
    }

    for (var j = 0; j < data.length; j++) {
      for (var c = deleteCols.length - 1; c >= 0; c--) {
        var delCol = deleteCols[c]
        data[j].splice(delCol, 1)
      }
    }

    hot.updateSettings({
      'colWidths': undefined,
      'columns': columns,
      'colHeaders': colHeaders,
      'data': data
    })
  }

  HH.buildParseSchema = function (columns, colHeaders) {
    var schemeObj = {}

    for (var i = 0; i < columns.length; i++) {
      var item = columns[i]
      schemeObj[colHeaders[i]] = {
        type: item.jsType
      }
    }
    return schemeObj
  }
})();
