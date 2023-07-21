import {toNumber} from 'falkonry-vega-util';

var map = Array.prototype.map;

export function numbers(_) {
  return map.call(_, toNumber);
}
