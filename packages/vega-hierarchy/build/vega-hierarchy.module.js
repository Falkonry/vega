import { Transform, isTuple, ingest, tupleid, stableCompare } from 'vega-dataflow';
import { inherits, error, array, one, truthy, hasOwnProperty } from 'vega-util';
import { hierarchy, pack, partition, stratify, tree, cluster, treemap, treemapBinary, treemapDice, treemapSlice, treemapSliceDice, treemapSquarify, treemapResquarify } from 'd3-hierarchy';

// Build lookup table mapping tuple keys to tree node instances
function lookup (tree, key, filter) {
  const map = {};
  tree.each(node => {
    const t = node.data;
    if (filter(t)) map[key(t)] = node;
  });
  tree.lookup = map;
  return tree;
}

/**
 * Nest tuples into a tree structure, grouped by key values.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {Array<function(object): *>} params.keys - The key fields to nest by, in order.
 * @param {boolean} [params.generate=false] - A boolean flag indicating if
 *   non-leaf nodes generated by this transform should be included in the
 *   output. The default (false) includes only the input data (leaf nodes)
 *   in the data stream.
 */
function Nest(params) {
  Transform.call(this, null, params);
}
Nest.Definition = {
  'type': 'Nest',
  'metadata': {
    'treesource': true,
    'changes': true
  },
  'params': [{
    'name': 'keys',
    'type': 'field',
    'array': true
  }, {
    'name': 'generate',
    'type': 'boolean'
  }]
};
const children = n => n.values;
inherits(Nest, Transform, {
  transform(_, pulse) {
    if (!pulse.source) {
      error('Nest transform requires an upstream data source.');
    }
    var gen = _.generate,
      mod = _.modified(),
      out = pulse.clone(),
      tree = this.value;
    if (!tree || mod || pulse.changed()) {
      // collect nodes to remove
      if (tree) {
        tree.each(node => {
          if (node.children && isTuple(node.data)) {
            out.rem.push(node.data);
          }
        });
      }

      // generate new tree structure
      this.value = tree = hierarchy({
        values: array(_.keys).reduce((n, k) => {
          n.key(k);
          return n;
        }, nest()).entries(out.source)
      }, children);

      // collect nodes to add
      if (gen) {
        tree.each(node => {
          if (node.children) {
            node = ingest(node.data);
            out.add.push(node);
            out.source.push(node);
          }
        });
      }

      // build lookup table
      lookup(tree, tupleid, tupleid);
    }
    out.source.root = tree;
    return out;
  }
});
function nest() {
  const keys = [],
    nest = {
      entries: array => entries(apply(array, 0), 0),
      key: d => (keys.push(d), nest)
    };
  function apply(array, depth) {
    if (depth >= keys.length) {
      return array;
    }
    const n = array.length,
      key = keys[depth++],
      valuesByKey = {},
      result = {};
    let i = -1,
      keyValue,
      value,
      values;
    while (++i < n) {
      keyValue = key(value = array[i]) + '';
      if (values = valuesByKey[keyValue]) {
        values.push(value);
      } else {
        valuesByKey[keyValue] = [value];
      }
    }
    for (keyValue in valuesByKey) {
      result[keyValue] = apply(valuesByKey[keyValue], depth);
    }
    return result;
  }
  function entries(map, depth) {
    if (++depth > keys.length) return map;
    const array = [];
    for (const key in map) {
      array.push({
        key,
        values: entries(map[key], depth)
      });
    }
    return array;
  }
  return nest;
}

/**
 * Abstract class for tree layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 */
function HierarchyLayout(params) {
  Transform.call(this, null, params);
}
const defaultSeparation = (a, b) => a.parent === b.parent ? 1 : 2;
inherits(HierarchyLayout, Transform, {
  transform(_, pulse) {
    if (!pulse.source || !pulse.source.root) {
      error(this.constructor.name + ' transform requires a backing tree data source.');
    }
    const layout = this.layout(_.method),
      fields = this.fields,
      root = pulse.source.root,
      as = _.as || fields;
    if (_.field) root.sum(_.field);else root.count();
    if (_.sort) root.sort(stableCompare(_.sort, d => d.data));
    setParams(layout, this.params, _);
    if (layout.separation) {
      layout.separation(_.separation !== false ? defaultSeparation : one);
    }
    try {
      this.value = layout(root);
    } catch (err) {
      error(err);
    }
    root.each(node => setFields(node, fields, as));
    return pulse.reflow(_.modified()).modifies(as).modifies('leaf');
  }
});
function setParams(layout, params, _) {
  for (let p, i = 0, n = params.length; i < n; ++i) {
    p = params[i];
    if (p in _) layout[p](_[p]);
  }
}
function setFields(node, fields, as) {
  const t = node.data,
    n = fields.length - 1;
  for (let i = 0; i < n; ++i) {
    t[as[i]] = node[fields[i]];
  }
  t[as[n]] = node.children ? node.children.length : 0;
}

const Output$3 = ['x', 'y', 'r', 'depth', 'children'];

/**
 * Packed circle tree layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - The value field to size nodes.
 */
function Pack(params) {
  HierarchyLayout.call(this, params);
}
Pack.Definition = {
  'type': 'Pack',
  'metadata': {
    'tree': true,
    'modifies': true
  },
  'params': [{
    'name': 'field',
    'type': 'field'
  }, {
    'name': 'sort',
    'type': 'compare'
  }, {
    'name': 'padding',
    'type': 'number',
    'default': 0
  }, {
    'name': 'radius',
    'type': 'field',
    'default': null
  }, {
    'name': 'size',
    'type': 'number',
    'array': true,
    'length': 2
  }, {
    'name': 'as',
    'type': 'string',
    'array': true,
    'length': Output$3.length,
    'default': Output$3
  }]
};
inherits(Pack, HierarchyLayout, {
  layout: pack,
  params: ['radius', 'size', 'padding'],
  fields: Output$3
});

const Output$2 = ['x0', 'y0', 'x1', 'y1', 'depth', 'children'];

/**
 * Partition tree layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - The value field to size nodes.
 */
function Partition(params) {
  HierarchyLayout.call(this, params);
}
Partition.Definition = {
  'type': 'Partition',
  'metadata': {
    'tree': true,
    'modifies': true
  },
  'params': [{
    'name': 'field',
    'type': 'field'
  }, {
    'name': 'sort',
    'type': 'compare'
  }, {
    'name': 'padding',
    'type': 'number',
    'default': 0
  }, {
    'name': 'round',
    'type': 'boolean',
    'default': false
  }, {
    'name': 'size',
    'type': 'number',
    'array': true,
    'length': 2
  }, {
    'name': 'as',
    'type': 'string',
    'array': true,
    'length': Output$2.length,
    'default': Output$2
  }]
};
inherits(Partition, HierarchyLayout, {
  layout: partition,
  params: ['size', 'round', 'padding'],
  fields: Output$2
});

/**
 * Stratify a collection of tuples into a tree structure based on
 * id and parent id fields.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.key - Unique key field for each tuple.
 * @param {function(object): *} params.parentKey - Field with key for parent tuple.
 */
function Stratify(params) {
  Transform.call(this, null, params);
}
Stratify.Definition = {
  'type': 'Stratify',
  'metadata': {
    'treesource': true
  },
  'params': [{
    'name': 'key',
    'type': 'field',
    'required': true
  }, {
    'name': 'parentKey',
    'type': 'field',
    'required': true
  }]
};
inherits(Stratify, Transform, {
  transform(_, pulse) {
    if (!pulse.source) {
      error('Stratify transform requires an upstream data source.');
    }
    let tree = this.value;
    const mod = _.modified(),
      out = pulse.fork(pulse.ALL).materialize(pulse.SOURCE),
      run = !tree || mod || pulse.changed(pulse.ADD_REM) || pulse.modified(_.key.fields) || pulse.modified(_.parentKey.fields);

    // prevent upstream source pollution
    out.source = out.source.slice();
    if (run) {
      tree = out.source.length ? lookup(stratify().id(_.key).parentId(_.parentKey)(out.source), _.key, truthy) : lookup(stratify()([{}]), _.key, _.key);
    }
    out.source.root = this.value = tree;
    return out;
  }
});

const Layouts = {
  tidy: tree,
  cluster: cluster
};
const Output$1 = ['x', 'y', 'depth', 'children'];

/**
 * Tree layout. Depending on the method parameter, performs either
 * Reingold-Tilford 'tidy' layout or dendrogram 'cluster' layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 */
function Tree(params) {
  HierarchyLayout.call(this, params);
}
Tree.Definition = {
  'type': 'Tree',
  'metadata': {
    'tree': true,
    'modifies': true
  },
  'params': [{
    'name': 'field',
    'type': 'field'
  }, {
    'name': 'sort',
    'type': 'compare'
  }, {
    'name': 'method',
    'type': 'enum',
    'default': 'tidy',
    'values': ['tidy', 'cluster']
  }, {
    'name': 'size',
    'type': 'number',
    'array': true,
    'length': 2
  }, {
    'name': 'nodeSize',
    'type': 'number',
    'array': true,
    'length': 2
  }, {
    'name': 'separation',
    'type': 'boolean',
    'default': true
  }, {
    'name': 'as',
    'type': 'string',
    'array': true,
    'length': Output$1.length,
    'default': Output$1
  }]
};
inherits(Tree, HierarchyLayout, {
  /**
   * Tree layout generator. Supports both 'tidy' and 'cluster' layouts.
   */
  layout(method) {
    const m = method || 'tidy';
    if (hasOwnProperty(Layouts, m)) return Layouts[m]();else error('Unrecognized Tree layout method: ' + m);
  },
  params: ['size', 'nodeSize'],
  fields: Output$1
});

/**
 * Generate tuples representing links between tree nodes.
 * The resulting tuples will contain 'source' and 'target' fields,
 * which point to parent and child node tuples, respectively.
 * @constructor
 * @param {object} params - The parameters for this operator.
 */
function TreeLinks(params) {
  Transform.call(this, [], params);
}
TreeLinks.Definition = {
  'type': 'TreeLinks',
  'metadata': {
    'tree': true,
    'generates': true,
    'changes': true
  },
  'params': []
};
inherits(TreeLinks, Transform, {
  transform(_, pulse) {
    const links = this.value,
      tree = pulse.source && pulse.source.root,
      out = pulse.fork(pulse.NO_SOURCE),
      lut = {};
    if (!tree) error('TreeLinks transform requires a tree data source.');
    if (pulse.changed(pulse.ADD_REM)) {
      // remove previous links
      out.rem = links;

      // build lookup table of valid tuples
      pulse.visit(pulse.SOURCE, t => lut[tupleid(t)] = 1);

      // generate links for all edges incident on valid tuples
      tree.each(node => {
        const t = node.data,
          p = node.parent && node.parent.data;
        if (p && lut[tupleid(t)] && lut[tupleid(p)]) {
          out.add.push(ingest({
            source: p,
            target: t
          }));
        }
      });
      this.value = out.add;
    } else if (pulse.changed(pulse.MOD)) {
      // build lookup table of modified tuples
      pulse.visit(pulse.MOD, t => lut[tupleid(t)] = 1);

      // gather links incident on modified tuples
      links.forEach(link => {
        if (lut[tupleid(link.source)] || lut[tupleid(link.target)]) {
          out.mod.push(link);
        }
      });
    }
    return out;
  }
});

const Tiles = {
  binary: treemapBinary,
  dice: treemapDice,
  slice: treemapSlice,
  slicedice: treemapSliceDice,
  squarify: treemapSquarify,
  resquarify: treemapResquarify
};
const Output = ['x0', 'y0', 'x1', 'y1', 'depth', 'children'];

/**
 * Treemap layout.
 * @constructor
 * @param {object} params - The parameters for this operator.
 * @param {function(object): *} params.field - The value field to size nodes.
 */
function Treemap(params) {
  HierarchyLayout.call(this, params);
}
Treemap.Definition = {
  'type': 'Treemap',
  'metadata': {
    'tree': true,
    'modifies': true
  },
  'params': [{
    'name': 'field',
    'type': 'field'
  }, {
    'name': 'sort',
    'type': 'compare'
  }, {
    'name': 'method',
    'type': 'enum',
    'default': 'squarify',
    'values': ['squarify', 'resquarify', 'binary', 'dice', 'slice', 'slicedice']
  }, {
    'name': 'padding',
    'type': 'number',
    'default': 0
  }, {
    'name': 'paddingInner',
    'type': 'number',
    'default': 0
  }, {
    'name': 'paddingOuter',
    'type': 'number',
    'default': 0
  }, {
    'name': 'paddingTop',
    'type': 'number',
    'default': 0
  }, {
    'name': 'paddingRight',
    'type': 'number',
    'default': 0
  }, {
    'name': 'paddingBottom',
    'type': 'number',
    'default': 0
  }, {
    'name': 'paddingLeft',
    'type': 'number',
    'default': 0
  }, {
    'name': 'ratio',
    'type': 'number',
    'default': 1.618033988749895
  }, {
    'name': 'round',
    'type': 'boolean',
    'default': false
  }, {
    'name': 'size',
    'type': 'number',
    'array': true,
    'length': 2
  }, {
    'name': 'as',
    'type': 'string',
    'array': true,
    'length': Output.length,
    'default': Output
  }]
};
inherits(Treemap, HierarchyLayout, {
  /**
   * Treemap layout generator. Adds 'method' and 'ratio' parameters
   * to configure the underlying tile method.
   */
  layout() {
    const x = treemap();
    x.ratio = _ => {
      const t = x.tile();
      if (t.ratio) x.tile(t.ratio(_));
    };
    x.method = _ => {
      if (hasOwnProperty(Tiles, _)) x.tile(Tiles[_]);else error('Unrecognized Treemap layout method: ' + _);
    };
    return x;
  },
  params: ['method', 'ratio', 'size', 'round', 'padding', 'paddingInner', 'paddingOuter', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
  fields: Output
});

export { Nest as nest, Pack as pack, Partition as partition, Stratify as stratify, Tree as tree, TreeLinks as treelinks, Treemap as treemap };