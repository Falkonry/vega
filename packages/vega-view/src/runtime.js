import {transforms} from 'falkonry-vega-dataflow';
import {functionContext} from 'falkonry-vega-functions';
import {context} from 'falkonry-vega-runtime';

export default function(view, spec, expr) {
  return context(view, transforms, functionContext, expr).parse(spec);
}
