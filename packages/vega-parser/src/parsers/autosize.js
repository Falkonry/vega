import {isObject} from 'falkonry-vega-util';

export default function(spec) {
  return isObject(spec) ? spec : {type: spec || 'pad'};
}
