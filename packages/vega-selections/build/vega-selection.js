(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('vega-util'), require('vega-expression')) :
  typeof define === 'function' && define.amd ? define(['exports', 'vega-util', 'vega-expression'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.vega = {}, global.vega, global.vega));
})(this, (function (exports, vegaUtil, vegaExpression) { 'use strict';

  function ascending(a, b) {
    return a == null || b == null ? NaN : a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function descending(a, b) {
    return a == null || b == null ? NaN : b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
  }

  function bisector(f) {
    let compare1, compare2, delta;

    // If an accessor is specified, promote it to a comparator. In this case we
    // can test whether the search value is (self-) comparable. We can’t do this
    // for a comparator (except for specific, known comparators) because we can’t
    // tell if the comparator is symmetric, and an asymmetric comparator can’t be
    // used to test whether a single value is comparable.
    if (f.length !== 2) {
      compare1 = ascending;
      compare2 = (d, x) => ascending(f(d), x);
      delta = (d, x) => f(d) - x;
    } else {
      compare1 = f === ascending || f === descending ? f : zero;
      compare2 = f;
      delta = f;
    }
    function left(a, x, lo = 0, hi = a.length) {
      if (lo < hi) {
        if (compare1(x, x) !== 0) return hi;
        do {
          const mid = lo + hi >>> 1;
          if (compare2(a[mid], x) < 0) lo = mid + 1;else hi = mid;
        } while (lo < hi);
      }
      return lo;
    }
    function right(a, x, lo = 0, hi = a.length) {
      if (lo < hi) {
        if (compare1(x, x) !== 0) return hi;
        do {
          const mid = lo + hi >>> 1;
          if (compare2(a[mid], x) <= 0) lo = mid + 1;else hi = mid;
        } while (lo < hi);
      }
      return lo;
    }
    function center(a, x, lo = 0, hi = a.length) {
      const i = left(a, x, lo, hi - 1);
      return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
    }
    return {
      left,
      center,
      right
    };
  }
  function zero() {
    return 0;
  }

  class InternSet extends Set {
    constructor(values, key = keyof) {
      super();
      Object.defineProperties(this, {
        _intern: {
          value: new Map()
        },
        _key: {
          value: key
        }
      });
      if (values != null) for (const value of values) this.add(value);
    }
    has(value) {
      return super.has(intern_get(this, value));
    }
    add(value) {
      return super.add(intern_set(this, value));
    }
    delete(value) {
      return super.delete(intern_delete(this, value));
    }
  }
  function intern_get({
    _intern,
    _key
  }, value) {
    const key = _key(value);
    return _intern.has(key) ? _intern.get(key) : value;
  }
  function intern_set({
    _intern,
    _key
  }, value) {
    const key = _key(value);
    if (_intern.has(key)) return _intern.get(key);
    _intern.set(key, value);
    return value;
  }
  function intern_delete({
    _intern,
    _key
  }, value) {
    const key = _key(value);
    if (_intern.has(key)) {
      value = _intern.get(key);
      _intern.delete(key);
    }
    return value;
  }
  function keyof(value) {
    return value !== null && typeof value === "object" ? value.valueOf() : value;
  }

  function intersection(values, ...others) {
    values = new InternSet(values);
    others = others.map(set);
    out: for (const value of values) {
      for (const other of others) {
        if (!other.has(value)) {
          values.delete(value);
          continue out;
        }
      }
    }
    return values;
  }
  function set(values) {
    return values instanceof InternSet ? values : new InternSet(values);
  }

  function union(...others) {
    const set = new InternSet();
    for (const other of others) {
      for (const o of other) {
        set.add(o);
      }
    }
    return set;
  }

  // Registers vega-util field accessors to protect against XSS attacks
  const SELECTION_GETTER = Symbol('vega_selection_getter');
  function getter(f) {
    if (!f.getter || !f.getter[SELECTION_GETTER]) {
      f.getter = vegaUtil.field(f.field);
      f.getter[SELECTION_GETTER] = true;
    }
    return f.getter;
  }
  const Intersect = 'intersect';
  const Union = 'union';
  const VlMulti = 'vlMulti';
  const VlPoint = 'vlPoint';
  const Or = 'or';
  const And = 'and';
  const SelectionId = '_vgsid_';
  const $selectionId = vegaUtil.field(SelectionId);

  const TYPE_ENUM = 'E',
    TYPE_RANGE_INC = 'R',
    TYPE_RANGE_EXC = 'R-E',
    TYPE_RANGE_LE = 'R-LE',
    TYPE_RANGE_RE = 'R-RE',
    UNIT_INDEX = 'index:unit';

  // TODO: revisit date coercion?
  function testPoint(datum, entry) {
    var fields = entry.fields,
      values = entry.values,
      n = fields.length,
      i = 0,
      dval,
      f;
    for (; i < n; ++i) {
      f = fields[i];
      dval = getter(f)(datum);
      if (vegaUtil.isDate(dval)) dval = vegaUtil.toNumber(dval);
      if (vegaUtil.isDate(values[i])) values[i] = vegaUtil.toNumber(values[i]);
      if (vegaUtil.isDate(values[i][0])) values[i] = values[i].map(vegaUtil.toNumber);
      if (f.type === TYPE_ENUM) {
        // Enumerated fields can either specify individual values (single/multi selections)
        // or an array of values (interval selections).
        if (vegaUtil.isArray(values[i]) ? values[i].indexOf(dval) < 0 : dval !== values[i]) {
          return false;
        }
      } else {
        if (f.type === TYPE_RANGE_INC) {
          if (!vegaUtil.inrange(dval, values[i])) return false;
        } else if (f.type === TYPE_RANGE_RE) {
          // Discrete selection of bins test within the range [bin_start, bin_end).
          if (!vegaUtil.inrange(dval, values[i], true, false)) return false;
        } else if (f.type === TYPE_RANGE_EXC) {
          // 'R-E'/'R-LE' included for completeness.
          if (!vegaUtil.inrange(dval, values[i], false, false)) return false;
        } else if (f.type === TYPE_RANGE_LE) {
          if (!vegaUtil.inrange(dval, values[i], false, true)) return false;
        }
      }
    }
    return true;
  }

  /**
   * Tests if a tuple is contained within an interactive selection.
   * @param {string} name - The name of the data set representing the selection.
   *  Tuples in the dataset are of the form
   *  {unit: string, fields: array<fielddef>, values: array<*>}.
   *  Fielddef is of the form
   *  {field: string, channel: string, type: 'E' | 'R'} where
   *  'type' identifies whether tuples in the dataset enumerate
   *  values for the field, or specify a continuous range.
   * @param {object} datum - The tuple to test for inclusion.
   * @param {string} op - The set operation for combining selections.
   *   One of 'intersect' or 'union' (default).
   * @return {boolean} - True if the datum is in the selection, false otherwise.
   */
  function selectionTest(name, datum, op) {
    var data = this.context.data[name],
      entries = data ? data.values.value : [],
      unitIdx = data ? data[UNIT_INDEX] && data[UNIT_INDEX].value : undefined,
      intersect = op === Intersect,
      n = entries.length,
      i = 0,
      entry,
      miss,
      count,
      unit,
      b;
    for (; i < n; ++i) {
      entry = entries[i];
      if (unitIdx && intersect) {
        // multi selections union within the same unit and intersect across units.
        miss = miss || {};
        count = miss[unit = entry.unit] || 0;

        // if we've already matched this unit, skip.
        if (count === -1) continue;
        b = testPoint(datum, entry);
        miss[unit] = b ? -1 : ++count;

        // if we match and there are no other units return true
        // if we've missed against all tuples in this unit return false
        if (b && unitIdx.size === 1) return true;
        if (!b && count === unitIdx.get(unit).count) return false;
      } else {
        b = testPoint(datum, entry);

        // if we find a miss and we do require intersection return false
        // if we find a match and we don't require intersection return true
        if (intersect ^ b) return b;
      }
    }

    // if intersecting and we made it here, then we saw no misses
    // if not intersecting, then we saw no matches
    // if no active selections, return false
    return n && intersect;
  }
  const bisect = bisector($selectionId),
    bisectLeft = bisect.left,
    bisectRight = bisect.right;
  function selectionIdTest(name, datum, op) {
    const data = this.context.data[name],
      entries = data ? data.values.value : [],
      unitIdx = data ? data[UNIT_INDEX] && data[UNIT_INDEX].value : undefined,
      intersect = op === Intersect,
      value = $selectionId(datum),
      index = bisectLeft(entries, value);
    if (index === entries.length) return false;
    if ($selectionId(entries[index]) !== value) return false;
    if (unitIdx && intersect) {
      if (unitIdx.size === 1) return true;
      if (bisectRight(entries, value) - index < unitIdx.size) return false;
    }
    return true;
  }

  /**
   * Maps an array of scene graph items to an array of selection tuples.
   * @param {string} name  - The name of the dataset representing the selection.
   * @param {string} base  - The base object that generated tuples extend.
   *
   * @returns {array} An array of selection entries for the given unit.
   */
  function selectionTuples(array, base) {
    return array.map(x => vegaUtil.extend(base.fields ? {
      values: base.fields.map(f => getter(f)(x.datum))
    } : {
      [SelectionId]: $selectionId(x.datum)
    }, base));
  }

  /**
   * Resolves selection for use as a scale domain or reads via the API.
   * @param {string} name - The name of the dataset representing the selection
   * @param {string} [op='union'] - The set operation for combining selections.
   *                 One of 'intersect' or 'union' (default).
   * @param {boolean} isMulti - Identifies a "multi" selection to perform more
   *                 expensive resolution computation.
   * @param {boolean} vl5 - With Vega-Lite v5, "multi" selections are now called "point"
   *                 selections, and thus the resolved tuple should reflect this name.
   *                 This parameter allows us to reflect this change without triggering
   *                 a major version bump for Vega.
   * @returns {object} An object of selected fields and values.
   */
  function selectionResolve(name, op, isMulti, vl5) {
    var data = this.context.data[name],
      entries = data ? data.values.value : [],
      resolved = {},
      multiRes = {},
      types = {},
      entry,
      fields,
      values,
      unit,
      field,
      value,
      res,
      resUnit,
      type,
      union,
      n = entries.length,
      i = 0,
      j,
      m;

    // First union all entries within the same unit.
    for (; i < n; ++i) {
      entry = entries[i];
      unit = entry.unit;
      fields = entry.fields;
      values = entry.values;
      if (fields && values) {
        // Intentional selection stores
        for (j = 0, m = fields.length; j < m; ++j) {
          field = fields[j];
          res = resolved[field.field] || (resolved[field.field] = {});
          resUnit = res[unit] || (res[unit] = []);
          types[field.field] = type = field.type.charAt(0);
          union = ops[`${type}_union`];
          res[unit] = union(resUnit, vegaUtil.array(values[j]));
        }

        // If the same multi-selection is repeated over views and projected over
        // an encoding, it may operate over different fields making it especially
        // tricky to reliably resolve it. At best, we can de-dupe identical entries
        // but doing so may be more computationally expensive than it is worth.
        // Instead, for now, we simply transform our store representation into
        // a more human-friendly one.
        if (isMulti) {
          resUnit = multiRes[unit] || (multiRes[unit] = []);
          resUnit.push(vegaUtil.array(values).reduce((obj, curr, j) => (obj[fields[j].field] = curr, obj), {}));
        }
      } else {
        // Short circuit extensional selectionId stores which hold sorted IDs unique to each unit.
        field = SelectionId;
        value = $selectionId(entry);
        res = resolved[field] || (resolved[field] = {});
        resUnit = res[unit] || (res[unit] = []);
        resUnit.push(value);
        if (isMulti) {
          resUnit = multiRes[unit] || (multiRes[unit] = []);
          resUnit.push({
            [SelectionId]: value
          });
        }
      }
    }

    // Then resolve fields across units as per the op.
    op = op || Union;
    if (resolved[SelectionId]) {
      resolved[SelectionId] = ops[`${SelectionId}_${op}`](...Object.values(resolved[SelectionId]));
    } else {
      Object.keys(resolved).forEach(field => {
        resolved[field] = Object.keys(resolved[field]).map(unit => resolved[field][unit]).reduce((acc, curr) => acc === undefined ? curr : ops[`${types[field]}_${op}`](acc, curr));
      });
    }
    entries = Object.keys(multiRes);
    if (isMulti && entries.length) {
      const key = vl5 ? VlPoint : VlMulti;
      resolved[key] = op === Union ? {
        [Or]: entries.reduce((acc, k) => (acc.push(...multiRes[k]), acc), [])
      } : {
        [And]: entries.map(k => ({
          [Or]: multiRes[k]
        }))
      };
    }
    return resolved;
  }
  var ops = {
    [`${SelectionId}_union`]: union,
    [`${SelectionId}_intersect`]: intersection,
    E_union: function (base, value) {
      if (!base.length) return value;
      var i = 0,
        n = value.length;
      for (; i < n; ++i) if (base.indexOf(value[i]) < 0) base.push(value[i]);
      return base;
    },
    E_intersect: function (base, value) {
      return !base.length ? value : base.filter(v => value.indexOf(v) >= 0);
    },
    R_union: function (base, value) {
      var lo = vegaUtil.toNumber(value[0]),
        hi = vegaUtil.toNumber(value[1]);
      if (lo > hi) {
        lo = value[1];
        hi = value[0];
      }
      if (!base.length) return [lo, hi];
      if (base[0] > lo) base[0] = lo;
      if (base[1] < hi) base[1] = hi;
      return base;
    },
    R_intersect: function (base, value) {
      var lo = vegaUtil.toNumber(value[0]),
        hi = vegaUtil.toNumber(value[1]);
      if (lo > hi) {
        lo = value[1];
        hi = value[0];
      }
      if (!base.length) return [lo, hi];
      if (hi < base[0] || base[1] < lo) {
        return [];
      } else {
        if (base[0] < lo) base[0] = lo;
        if (base[1] > hi) base[1] = hi;
      }
      return base;
    }
  };

  const DataPrefix = ':',
    IndexPrefix = '@';
  function selectionVisitor(name, args, scope, params) {
    if (args[0].type !== vegaExpression.Literal) vegaUtil.error('First argument to selection functions must be a string literal.');
    const data = args[0].value,
      op = args.length >= 2 && vegaUtil.peek(args).value,
      field = 'unit',
      indexName = IndexPrefix + field,
      dataName = DataPrefix + data;

    // eslint-disable-next-line no-prototype-builtins
    if (op === Intersect && !vegaUtil.hasOwnProperty(params, indexName)) {
      params[indexName] = scope.getData(data).indataRef(scope, field);
    }

    // eslint-disable-next-line no-prototype-builtins
    if (!vegaUtil.hasOwnProperty(params, dataName)) {
      params[dataName] = scope.getData(data).tuplesRef();
    }
  }

  exports.selectionIdTest = selectionIdTest;
  exports.selectionResolve = selectionResolve;
  exports.selectionTest = selectionTest;
  exports.selectionTuples = selectionTuples;
  exports.selectionVisitor = selectionVisitor;

}));
