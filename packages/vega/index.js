// -- Transforms -----

import {extend} from 'falkonry-vega-util';
import {transforms} from 'falkonry-vega-dataflow';
import * as tx from 'falkonry-vega-transforms';
import * as vtx from 'falkonry-vega-view-transforms';
import * as encode from 'falkonry-vega-encode';
import * as geo from 'falkonry-vega-geo';
import * as force from 'falkonry-vega-force';
import * as tree from 'falkonry-vega-hierarchy';
import * as label from 'falkonry-vega-label';
import * as reg from 'falkonry-vega-regression';
import * as voronoi from 'falkonry-vega-voronoi';
import * as wordcloud from 'falkonry-vega-wordcloud';
import * as xf from 'falkonry-vega-crossfilter';
extend(
  transforms,
  tx, vtx, encode, geo, force, label, tree, reg, voronoi, wordcloud, xf
);


// -- Exports -----

export {version} from './package.json';

export * from 'falkonry-vega-statistics';

export * from 'falkonry-vega-time';

export * from 'falkonry-vega-util';

export * from 'falkonry-vega-loader';

export * from 'falkonry-vega-scenegraph';

export {
  Dataflow,
  EventStream,
  Parameters,
  Pulse,
  MultiPulse,
  Operator,
  Transform,
  changeset,
  ingest,
  isTuple,
  definition,
  transform,
  transforms,
  tupleid
} from 'falkonry-vega-dataflow';

export {
  scale,
  scheme,
  interpolate,
  interpolateColors,
  interpolateRange,
  quantizeInterpolator
} from 'falkonry-vega-scale';

export {
  projection
} from 'falkonry-vega-projection';

export {
  View
} from 'falkonry-vega-view';

export {
  numberFormatDefaultLocale as formatLocale,
  timeFormatDefaultLocale as timeFormatLocale,
  locale,
  defaultLocale,
  resetDefaultLocale
} from 'falkonry-vega-format';

export {
  expressionFunction
} from 'falkonry-vega-functions';

export {
  parse
} from 'falkonry-vega-parser';

export {
  context as runtimeContext
} from 'falkonry-vega-runtime';

export {
  codegenExpression,
  parseExpression
} from 'falkonry-vega-expression';

export {
  parseSelector
} from 'falkonry-vega-event-selector';
