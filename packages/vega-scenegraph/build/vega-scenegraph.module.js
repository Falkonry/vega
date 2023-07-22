import { hasOwnProperty, isFunction, inherits, truthy, lruCache, isArray, error, toSet, array, peek, extend, isNumber, isObject } from 'vega-util';
import { curveBasis, curveBasisClosed, curveBasisOpen, curveBundle, curveCardinal, curveCardinalOpen, curveCardinalClosed, curveCatmullRom, curveCatmullRomClosed, curveCatmullRomOpen, curveLinear, curveLinearClosed, curveMonotoneY, curveMonotoneX, curveNatural, curveStep, curveStepAfter, curveStepBefore, arc as arc$2, area as area$2, line as line$2, symbol as symbol$2 } from 'd3-shape';
import { path as path$3 } from 'd3-path';
export { path } from 'd3-path';
import { image as image$1, canvas } from 'vega-canvas';
import { loader } from 'vega-loader';
import { isDiscrete, domainCaption } from 'vega-scale';

let gradient_id = 0;
function resetSVGGradientId() {
  gradient_id = 0;
}
const patternPrefix = 'p_';
function isGradient(value) {
  return value && value.gradient;
}
function gradientRef(g, defs, base) {
  const type = g.gradient;
  let id = g.id,
    prefix = type === 'radial' ? patternPrefix : '';

  // check id, assign default values as needed
  if (!id) {
    id = g.id = 'gradient_' + gradient_id++;
    if (type === 'radial') {
      g.x1 = get(g.x1, 0.5);
      g.y1 = get(g.y1, 0.5);
      g.r1 = get(g.r1, 0);
      g.x2 = get(g.x2, 0.5);
      g.y2 = get(g.y2, 0.5);
      g.r2 = get(g.r2, 0.5);
      prefix = patternPrefix;
    } else {
      g.x1 = get(g.x1, 0);
      g.y1 = get(g.y1, 0);
      g.x2 = get(g.x2, 1);
      g.y2 = get(g.y2, 0);
    }
  }

  // register definition
  defs[id] = g;

  // return url reference
  return 'url(' + (base || '') + '#' + prefix + id + ')';
}
function get(val, def) {
  return val != null ? val : def;
}
function Gradient (p0, p1) {
  var stops = [],
    gradient;
  return gradient = {
    gradient: 'linear',
    x1: p0 ? p0[0] : 0,
    y1: p0 ? p0[1] : 0,
    x2: p1 ? p1[0] : 1,
    y2: p1 ? p1[1] : 0,
    stops: stops,
    stop: function (offset, color) {
      stops.push({
        offset: offset,
        color: color
      });
      return gradient;
    }
  };
}

const lookup = {
  'basis': {
    curve: curveBasis
  },
  'basis-closed': {
    curve: curveBasisClosed
  },
  'basis-open': {
    curve: curveBasisOpen
  },
  'bundle': {
    curve: curveBundle,
    tension: 'beta',
    value: 0.85
  },
  'cardinal': {
    curve: curveCardinal,
    tension: 'tension',
    value: 0
  },
  'cardinal-open': {
    curve: curveCardinalOpen,
    tension: 'tension',
    value: 0
  },
  'cardinal-closed': {
    curve: curveCardinalClosed,
    tension: 'tension',
    value: 0
  },
  'catmull-rom': {
    curve: curveCatmullRom,
    tension: 'alpha',
    value: 0.5
  },
  'catmull-rom-closed': {
    curve: curveCatmullRomClosed,
    tension: 'alpha',
    value: 0.5
  },
  'catmull-rom-open': {
    curve: curveCatmullRomOpen,
    tension: 'alpha',
    value: 0.5
  },
  'linear': {
    curve: curveLinear
  },
  'linear-closed': {
    curve: curveLinearClosed
  },
  'monotone': {
    horizontal: curveMonotoneY,
    vertical: curveMonotoneX
  },
  'natural': {
    curve: curveNatural
  },
  'step': {
    curve: curveStep
  },
  'step-after': {
    curve: curveStepAfter
  },
  'step-before': {
    curve: curveStepBefore
  }
};
function curves(type, orientation, tension) {
  var entry = hasOwnProperty(lookup, type) && lookup[type],
    curve = null;
  if (entry) {
    curve = entry.curve || entry[orientation || 'vertical'];
    if (entry.tension && tension != null) {
      curve = curve[entry.tension](tension);
    }
  }
  return curve;
}

const paramCounts = {
  m: 2,
  l: 2,
  h: 1,
  v: 1,
  z: 0,
  c: 6,
  s: 4,
  q: 4,
  t: 2,
  a: 7
};
const commandPattern = /[mlhvzcsqta]([^mlhvzcsqta]+|$)/gi;
const numberPattern = /^[+-]?(([0-9]*\.[0-9]+)|([0-9]+\.)|([0-9]+))([eE][+-]?[0-9]+)?/;
const spacePattern = /^((\s+,?\s*)|(,\s*))/;
const flagPattern = /^[01]/;
function parse(path) {
  const commands = [];
  const matches = path.match(commandPattern) || [];
  matches.forEach(str => {
    let cmd = str[0];
    const type = cmd.toLowerCase();

    // parse parameters
    const paramCount = paramCounts[type];
    const params = parseParams(type, paramCount, str.slice(1).trim());
    const count = params.length;

    // error checking based on parameter count
    if (count < paramCount || count && count % paramCount !== 0) {
      throw Error('Invalid SVG path, incorrect parameter count');
    }

    // register the command
    commands.push([cmd, ...params.slice(0, paramCount)]);

    // exit now if we're done, also handles zero-param 'z'
    if (count === paramCount) {
      return;
    }

    // handle implicit line-to
    if (type === 'm') {
      cmd = cmd === 'M' ? 'L' : 'l';
    }

    // repeat command when given extended param list
    for (let i = paramCount; i < count; i += paramCount) {
      commands.push([cmd, ...params.slice(i, i + paramCount)]);
    }
  });
  return commands;
}
function parseParams(type, paramCount, segment) {
  const params = [];
  for (let index = 0; paramCount && index < segment.length;) {
    for (let i = 0; i < paramCount; ++i) {
      const pattern = type === 'a' && (i === 3 || i === 4) ? flagPattern : numberPattern;
      const match = segment.slice(index).match(pattern);
      if (match === null) {
        throw Error('Invalid SVG path, incorrect parameter type');
      }
      index += match[0].length;
      params.push(+match[0]);
      const ws = segment.slice(index).match(spacePattern);
      if (ws !== null) {
        index += ws[0].length;
      }
    }
  }
  return params;
}

var bezierCache = {};
var join = [].join;
function segments() {
  console.log('removed code to fix license issue.');
}
function bezier(params) {
  const key = join.call(params);
  if (bezierCache[key]) {
    return bezierCache[key];
  }
  var cx = params[0],
    cy = params[1],
    th0 = params[2],
    th1 = params[3],
    rx = params[4],
    ry = params[5],
    sin_th = params[6],
    cos_th = params[7];
  const a00 = cos_th * rx;
  const a01 = -sin_th * ry;
  const a10 = sin_th * rx;
  const a11 = cos_th * ry;
  const cos_th0 = Math.cos(th0);
  const sin_th0 = Math.sin(th0);
  const cos_th1 = Math.cos(th1);
  const sin_th1 = Math.sin(th1);
  const th_half = 0.5 * (th1 - th0);
  const sin_th_h2 = Math.sin(th_half * 0.5);
  const t = 8 / 3 * sin_th_h2 * sin_th_h2 / Math.sin(th_half);
  const x1 = cx + cos_th0 - t * sin_th0;
  const y1 = cy + sin_th0 + t * cos_th0;
  const x3 = cx + cos_th1;
  const y3 = cy + sin_th1;
  const x2 = x3 + t * sin_th1;
  const y2 = y3 - t * cos_th1;
  return bezierCache[key] = [a00 * x1 + a01 * y1, a10 * x1 + a11 * y1, a00 * x2 + a01 * y2, a10 * x2 + a11 * y2, a00 * x3 + a01 * y3, a10 * x3 + a11 * y3];
}

const temp = ['l', 0, 0, 0, 0, 0, 0, 0];
function scale$1(current, sX, sY) {
  const c = temp[0] = current[0];
  if (c === 'a' || c === 'A') {
    temp[1] = sX * current[1];
    temp[2] = sY * current[2];
    temp[3] = current[3];
    temp[4] = current[4];
    temp[5] = current[5];
    temp[6] = sX * current[6];
    temp[7] = sY * current[7];
  } else if (c === 'h' || c === 'H') {
    temp[1] = sX * current[1];
  } else if (c === 'v' || c === 'V') {
    temp[1] = sY * current[1];
  } else {
    for (var i = 1, n = current.length; i < n; ++i) {
      temp[i] = (i % 2 == 1 ? sX : sY) * current[i];
    }
  }
  return temp;
}
function pathRender (context, path, l, t, sX, sY) {
  var current,
    // current instruction
    previous = null,
    x = 0,
    // current x
    y = 0,
    // current y
    controlX = 0,
    // current control point x
    controlY = 0,
    // current control point y
    tempX,
    tempY,
    tempControlX,
    tempControlY,
    anchorX = 0,
    anchorY = 0;
  if (l == null) l = 0;
  if (t == null) t = 0;
  if (sX == null) sX = 1;
  if (sY == null) sY = sX;
  if (context.beginPath) context.beginPath();
  for (var i = 0, len = path.length; i < len; ++i) {
    current = path[i];
    if (sX !== 1 || sY !== 1) {
      current = scale$1(current, sX, sY);
    }
    switch (current[0]) {
      // first letter

      case 'l':
        // lineto, relative
        x += current[1];
        y += current[2];
        context.lineTo(x + l, y + t);
        break;
      case 'L':
        // lineto, absolute
        x = current[1];
        y = current[2];
        context.lineTo(x + l, y + t);
        break;
      case 'h':
        // horizontal lineto, relative
        x += current[1];
        context.lineTo(x + l, y + t);
        break;
      case 'H':
        // horizontal lineto, absolute
        x = current[1];
        context.lineTo(x + l, y + t);
        break;
      case 'v':
        // vertical lineto, relative
        y += current[1];
        context.lineTo(x + l, y + t);
        break;
      case 'V':
        // verical lineto, absolute
        y = current[1];
        context.lineTo(x + l, y + t);
        break;
      case 'm':
        // moveTo, relative
        x += current[1];
        y += current[2];
        anchorX = x;
        anchorY = y;
        context.moveTo(x + l, y + t);
        break;
      case 'M':
        // moveTo, absolute
        x = current[1];
        y = current[2];
        anchorX = x;
        anchorY = y;
        context.moveTo(x + l, y + t);
        break;
      case 'c':
        // bezierCurveTo, relative
        tempX = x + current[5];
        tempY = y + current[6];
        controlX = x + current[3];
        controlY = y + current[4];
        context.bezierCurveTo(x + current[1] + l,
        // x1
        y + current[2] + t,
        // y1
        controlX + l,
        // x2
        controlY + t,
        // y2
        tempX + l, tempY + t);
        x = tempX;
        y = tempY;
        break;
      case 'C':
        // bezierCurveTo, absolute
        x = current[5];
        y = current[6];
        controlX = current[3];
        controlY = current[4];
        context.bezierCurveTo(current[1] + l, current[2] + t, controlX + l, controlY + t, x + l, y + t);
        break;
      case 's':
        // shorthand cubic bezierCurveTo, relative
        // transform to absolute x,y
        tempX = x + current[3];
        tempY = y + current[4];
        // calculate reflection of previous control points
        controlX = 2 * x - controlX;
        controlY = 2 * y - controlY;
        context.bezierCurveTo(controlX + l, controlY + t, x + current[1] + l, y + current[2] + t, tempX + l, tempY + t);

        // set control point to 2nd one of this command
        // the first control point is assumed to be the reflection of
        // the second control point on the previous command relative
        // to the current point.
        controlX = x + current[1];
        controlY = y + current[2];
        x = tempX;
        y = tempY;
        break;
      case 'S':
        // shorthand cubic bezierCurveTo, absolute
        tempX = current[3];
        tempY = current[4];
        // calculate reflection of previous control points
        controlX = 2 * x - controlX;
        controlY = 2 * y - controlY;
        context.bezierCurveTo(controlX + l, controlY + t, current[1] + l, current[2] + t, tempX + l, tempY + t);
        x = tempX;
        y = tempY;
        // set control point to 2nd one of this command
        // the first control point is assumed to be the reflection of
        // the second control point on the previous command relative
        // to the current point.
        controlX = current[1];
        controlY = current[2];
        break;
      case 'q':
        // quadraticCurveTo, relative
        // transform to absolute x,y
        tempX = x + current[3];
        tempY = y + current[4];
        controlX = x + current[1];
        controlY = y + current[2];
        context.quadraticCurveTo(controlX + l, controlY + t, tempX + l, tempY + t);
        x = tempX;
        y = tempY;
        break;
      case 'Q':
        // quadraticCurveTo, absolute
        tempX = current[3];
        tempY = current[4];
        context.quadraticCurveTo(current[1] + l, current[2] + t, tempX + l, tempY + t);
        x = tempX;
        y = tempY;
        controlX = current[1];
        controlY = current[2];
        break;
      case 't':
        // shorthand quadraticCurveTo, relative

        // transform to absolute x,y
        tempX = x + current[1];
        tempY = y + current[2];
        if (previous[0].match(/[QqTt]/) === null) {
          // If there is no previous command or if the previous command was not a Q, q, T or t,
          // assume the control point is coincident with the current point
          controlX = x;
          controlY = y;
        } else if (previous[0] === 't') {
          // calculate reflection of previous control points for t
          controlX = 2 * x - tempControlX;
          controlY = 2 * y - tempControlY;
        } else if (previous[0] === 'q') {
          // calculate reflection of previous control points for q
          controlX = 2 * x - controlX;
          controlY = 2 * y - controlY;
        }
        tempControlX = controlX;
        tempControlY = controlY;
        context.quadraticCurveTo(controlX + l, controlY + t, tempX + l, tempY + t);
        x = tempX;
        y = tempY;
        controlX = x + current[1];
        controlY = y + current[2];
        break;
      case 'T':
        tempX = current[1];
        tempY = current[2];

        // calculate reflection of previous control points
        controlX = 2 * x - controlX;
        controlY = 2 * y - controlY;
        context.quadraticCurveTo(controlX + l, controlY + t, tempX + l, tempY + t);
        x = tempX;
        y = tempY;
        break;
      case 'a':
        drawArc(context, x + l, y + t, [current[1], current[2], current[3], current[4], current[5], current[6] + x + l, current[7] + y + t]);
        x += current[6];
        y += current[7];
        break;
      case 'A':
        drawArc(context, x + l, y + t, [current[1], current[2], current[3], current[4], current[5], current[6] + l, current[7] + t]);
        x = current[6];
        y = current[7];
        break;
      case 'z':
      case 'Z':
        x = anchorX;
        y = anchorY;
        context.closePath();
        break;
    }
    previous = current;
  }
}
function drawArc(context, x, y, coords) {
  const seg = segments(coords[5],
  // end x
  coords[6],
  // end y
  coords[0],
  // radius x
  coords[1],
  // radius y
  coords[3],
  // large flag
  coords[4],
  // sweep flag
  coords[2]);
  for (let i = 0; i < seg.length; ++i) {
    const bez = bezier(seg[i]);
    context.bezierCurveTo(bez[0], bez[1], bez[2], bez[3], bez[4], bez[5]);
  }
}

const DegToRad = Math.PI / 180;
const Epsilon = 1e-14;
const HalfPi = Math.PI / 2;
const Tau = Math.PI * 2;
const HalfSqrt3 = Math.sqrt(3) / 2;

const Tan30 = 0.5773502691896257;
const builtins = {
  'circle': {
    draw: function (context, size) {
      const r = Math.sqrt(size) / 2;
      context.moveTo(r, 0);
      context.arc(0, 0, r, 0, Tau);
    }
  },
  'cross': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        s = r / 2.5;
      context.moveTo(-r, -s);
      context.lineTo(-r, s);
      context.lineTo(-s, s);
      context.lineTo(-s, r);
      context.lineTo(s, r);
      context.lineTo(s, s);
      context.lineTo(r, s);
      context.lineTo(r, -s);
      context.lineTo(s, -s);
      context.lineTo(s, -r);
      context.lineTo(-s, -r);
      context.lineTo(-s, -s);
      context.closePath();
    }
  },
  'diamond': {
    draw: function (context, size) {
      const r = Math.sqrt(size) / 2;
      context.moveTo(-r, 0);
      context.lineTo(0, -r);
      context.lineTo(r, 0);
      context.lineTo(0, r);
      context.closePath();
    }
  },
  'square': {
    draw: function (context, size) {
      var w = Math.sqrt(size),
        x = -w / 2;
      context.rect(x, x, w, w);
    }
  },
  'arrow': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        s = r / 7,
        t = r / 2.5,
        v = r / 8;
      context.moveTo(-s, r);
      context.lineTo(s, r);
      context.lineTo(s, -v);
      context.lineTo(t, -v);
      context.lineTo(0, -r);
      context.lineTo(-t, -v);
      context.lineTo(-s, -v);
      context.closePath();
    }
  },
  'wedge': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        h = HalfSqrt3 * r,
        o = h - r * Tan30,
        b = r / 4;
      context.moveTo(0, -h - o);
      context.lineTo(-b, h - o);
      context.lineTo(b, h - o);
      context.closePath();
    }
  },
  'triangle': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        h = HalfSqrt3 * r,
        o = h - r * Tan30;
      context.moveTo(0, -h - o);
      context.lineTo(-r, h - o);
      context.lineTo(r, h - o);
      context.closePath();
    }
  },
  'triangle-up': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        h = HalfSqrt3 * r;
      context.moveTo(0, -h);
      context.lineTo(-r, h);
      context.lineTo(r, h);
      context.closePath();
    }
  },
  'triangle-down': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        h = HalfSqrt3 * r;
      context.moveTo(0, h);
      context.lineTo(-r, -h);
      context.lineTo(r, -h);
      context.closePath();
    }
  },
  'triangle-right': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        h = HalfSqrt3 * r;
      context.moveTo(h, 0);
      context.lineTo(-h, -r);
      context.lineTo(-h, r);
      context.closePath();
    }
  },
  'triangle-left': {
    draw: function (context, size) {
      var r = Math.sqrt(size) / 2,
        h = HalfSqrt3 * r;
      context.moveTo(-h, 0);
      context.lineTo(h, -r);
      context.lineTo(h, r);
      context.closePath();
    }
  },
  'stroke': {
    draw: function (context, size) {
      const r = Math.sqrt(size) / 2;
      context.moveTo(-r, 0);
      context.lineTo(r, 0);
    }
  }
};
function symbols(_) {
  return hasOwnProperty(builtins, _) ? builtins[_] : customSymbol(_);
}
var custom = {};
function customSymbol(path) {
  if (!hasOwnProperty(custom, path)) {
    const parsed = parse(path);
    custom[path] = {
      draw: function (context, size) {
        pathRender(context, parsed, 0, 0, Math.sqrt(size) / 2);
      }
    };
  }
  return custom[path];
}

// See http://spencermortensen.com/articles/bezier-circle/
const C = 0.448084975506; // C = 1 - c

function rectangleX(d) {
  return d.x;
}
function rectangleY(d) {
  return d.y;
}
function rectangleWidth(d) {
  return d.width;
}
function rectangleHeight(d) {
  return d.height;
}
function number(_) {
  return typeof _ === 'function' ? _ : () => +_;
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
function vg_rect () {
  var x = rectangleX,
    y = rectangleY,
    width = rectangleWidth,
    height = rectangleHeight,
    crTL = number(0),
    crTR = crTL,
    crBL = crTL,
    crBR = crTL,
    context = null;
  function rectangle(_, x0, y0) {
    var buffer,
      x1 = x0 != null ? x0 : +x.call(this, _),
      y1 = y0 != null ? y0 : +y.call(this, _),
      w = +width.call(this, _),
      h = +height.call(this, _),
      s = Math.min(w, h) / 2,
      tl = clamp(+crTL.call(this, _), 0, s),
      tr = clamp(+crTR.call(this, _), 0, s),
      bl = clamp(+crBL.call(this, _), 0, s),
      br = clamp(+crBR.call(this, _), 0, s);
    if (!context) context = buffer = path$3();
    if (tl <= 0 && tr <= 0 && bl <= 0 && br <= 0) {
      context.rect(x1, y1, w, h);
    } else {
      var x2 = x1 + w,
        y2 = y1 + h;
      context.moveTo(x1 + tl, y1);
      context.lineTo(x2 - tr, y1);
      context.bezierCurveTo(x2 - C * tr, y1, x2, y1 + C * tr, x2, y1 + tr);
      context.lineTo(x2, y2 - br);
      context.bezierCurveTo(x2, y2 - C * br, x2 - C * br, y2, x2 - br, y2);
      context.lineTo(x1 + bl, y2);
      context.bezierCurveTo(x1 + C * bl, y2, x1, y2 - C * bl, x1, y2 - bl);
      context.lineTo(x1, y1 + tl);
      context.bezierCurveTo(x1, y1 + C * tl, x1 + C * tl, y1, x1 + tl, y1);
      context.closePath();
    }
    if (buffer) {
      context = null;
      return buffer + '' || null;
    }
  }
  rectangle.x = function (_) {
    if (arguments.length) {
      x = number(_);
      return rectangle;
    } else {
      return x;
    }
  };
  rectangle.y = function (_) {
    if (arguments.length) {
      y = number(_);
      return rectangle;
    } else {
      return y;
    }
  };
  rectangle.width = function (_) {
    if (arguments.length) {
      width = number(_);
      return rectangle;
    } else {
      return width;
    }
  };
  rectangle.height = function (_) {
    if (arguments.length) {
      height = number(_);
      return rectangle;
    } else {
      return height;
    }
  };
  rectangle.cornerRadius = function (tl, tr, br, bl) {
    if (arguments.length) {
      crTL = number(tl);
      crTR = tr != null ? number(tr) : crTL;
      crBR = br != null ? number(br) : crTL;
      crBL = bl != null ? number(bl) : crTR;
      return rectangle;
    } else {
      return crTL;
    }
  };
  rectangle.context = function (_) {
    if (arguments.length) {
      context = _ == null ? null : _;
      return rectangle;
    } else {
      return context;
    }
  };
  return rectangle;
}

function vg_trail () {
  var x,
    y,
    size,
    defined,
    context = null,
    ready,
    x1,
    y1,
    r1;
  function point(x2, y2, w2) {
    const r2 = w2 / 2;
    if (ready) {
      var ux = y1 - y2,
        uy = x2 - x1;
      if (ux || uy) {
        // get normal vector
        var ud = Math.hypot(ux, uy),
          rx = (ux /= ud) * r1,
          ry = (uy /= ud) * r1,
          t = Math.atan2(uy, ux);

        // draw segment
        context.moveTo(x1 - rx, y1 - ry);
        context.lineTo(x2 - ux * r2, y2 - uy * r2);
        context.arc(x2, y2, r2, t - Math.PI, t);
        context.lineTo(x1 + rx, y1 + ry);
        context.arc(x1, y1, r1, t, t + Math.PI);
      } else {
        context.arc(x2, y2, r2, 0, Tau);
      }
      context.closePath();
    } else {
      ready = 1;
    }
    x1 = x2;
    y1 = y2;
    r1 = r2;
  }
  function trail(data) {
    var i,
      n = data.length,
      d,
      defined0 = false,
      buffer;
    if (context == null) context = buffer = path$3();
    for (i = 0; i <= n; ++i) {
      if (!(i < n && defined(d = data[i], i, data)) === defined0) {
        if (defined0 = !defined0) ready = 0;
      }
      if (defined0) point(+x(d, i, data), +y(d, i, data), +size(d, i, data));
    }
    if (buffer) {
      context = null;
      return buffer + '' || null;
    }
  }
  trail.x = function (_) {
    if (arguments.length) {
      x = _;
      return trail;
    } else {
      return x;
    }
  };
  trail.y = function (_) {
    if (arguments.length) {
      y = _;
      return trail;
    } else {
      return y;
    }
  };
  trail.size = function (_) {
    if (arguments.length) {
      size = _;
      return trail;
    } else {
      return size;
    }
  };
  trail.defined = function (_) {
    if (arguments.length) {
      defined = _;
      return trail;
    } else {
      return defined;
    }
  };
  trail.context = function (_) {
    if (arguments.length) {
      if (_ == null) {
        context = null;
      } else {
        context = _;
      }
      return trail;
    } else {
      return context;
    }
  };
  return trail;
}

function value$1(a, b) {
  return a != null ? a : b;
}
const x = item => item.x || 0,
  y = item => item.y || 0,
  w = item => item.width || 0,
  h = item => item.height || 0,
  xw = item => (item.x || 0) + (item.width || 0),
  yh = item => (item.y || 0) + (item.height || 0),
  sa = item => item.startAngle || 0,
  ea = item => item.endAngle || 0,
  pa = item => item.padAngle || 0,
  ir = item => item.innerRadius || 0,
  or = item => item.outerRadius || 0,
  cr = item => item.cornerRadius || 0,
  tl = item => value$1(item.cornerRadiusTopLeft, item.cornerRadius) || 0,
  tr = item => value$1(item.cornerRadiusTopRight, item.cornerRadius) || 0,
  br = item => value$1(item.cornerRadiusBottomRight, item.cornerRadius) || 0,
  bl = item => value$1(item.cornerRadiusBottomLeft, item.cornerRadius) || 0,
  sz = item => value$1(item.size, 64),
  ts = item => item.size || 1,
  def = item => !(item.defined === false),
  type = item => symbols(item.shape || 'circle');
const arcShape = arc$2().startAngle(sa).endAngle(ea).padAngle(pa).innerRadius(ir).outerRadius(or).cornerRadius(cr),
  areavShape = area$2().x(x).y1(y).y0(yh).defined(def),
  areahShape = area$2().y(y).x1(x).x0(xw).defined(def),
  lineShape = line$2().x(x).y(y).defined(def),
  rectShape = vg_rect().x(x).y(y).width(w).height(h).cornerRadius(tl, tr, br, bl),
  symbolShape = symbol$2().type(type).size(sz),
  trailShape = vg_trail().x(x).y(y).defined(def).size(ts);
function hasCornerRadius(item) {
  return item.cornerRadius || item.cornerRadiusTopLeft || item.cornerRadiusTopRight || item.cornerRadiusBottomRight || item.cornerRadiusBottomLeft;
}
function arc$1(context, item) {
  return arcShape.context(context)(item);
}
function area$1(context, items) {
  const item = items[0],
    interp = item.interpolate || 'linear';
  return (item.orient === 'horizontal' ? areahShape : areavShape).curve(curves(interp, item.orient, item.tension)).context(context)(items);
}
function line$1(context, items) {
  const item = items[0],
    interp = item.interpolate || 'linear';
  return lineShape.curve(curves(interp, item.orient, item.tension)).context(context)(items);
}
function rectangle(context, item, x, y) {
  return rectShape.context(context)(item, x, y);
}
function shape$1(context, item) {
  return (item.mark.shape || item.shape).context(context)(item);
}
function symbol$1(context, item) {
  return symbolShape.context(context)(item);
}
function trail$1(context, items) {
  return trailShape.context(context)(items);
}

var clip_id = 1;
function resetSVGClipId() {
  clip_id = 1;
}
function clip$1 (renderer, item, size) {
  var clip = item.clip,
    defs = renderer._defs,
    id = item.clip_id || (item.clip_id = 'clip' + clip_id++),
    c = defs.clipping[id] || (defs.clipping[id] = {
      id: id
    });
  if (isFunction(clip)) {
    c.path = clip(null);
  } else if (hasCornerRadius(size)) {
    c.path = rectangle(null, size, 0, 0);
  } else {
    c.width = size.width || 0;
    c.height = size.height || 0;
  }
  return 'url(#' + id + ')';
}

function Bounds(b) {
  this.clear();
  if (b) this.union(b);
}
Bounds.prototype = {
  clone() {
    return new Bounds(this);
  },
  clear() {
    this.x1 = +Number.MAX_VALUE;
    this.y1 = +Number.MAX_VALUE;
    this.x2 = -Number.MAX_VALUE;
    this.y2 = -Number.MAX_VALUE;
    return this;
  },
  empty() {
    return this.x1 === +Number.MAX_VALUE && this.y1 === +Number.MAX_VALUE && this.x2 === -Number.MAX_VALUE && this.y2 === -Number.MAX_VALUE;
  },
  equals(b) {
    return this.x1 === b.x1 && this.y1 === b.y1 && this.x2 === b.x2 && this.y2 === b.y2;
  },
  set(x1, y1, x2, y2) {
    if (x2 < x1) {
      this.x2 = x1;
      this.x1 = x2;
    } else {
      this.x1 = x1;
      this.x2 = x2;
    }
    if (y2 < y1) {
      this.y2 = y1;
      this.y1 = y2;
    } else {
      this.y1 = y1;
      this.y2 = y2;
    }
    return this;
  },
  add(x, y) {
    if (x < this.x1) this.x1 = x;
    if (y < this.y1) this.y1 = y;
    if (x > this.x2) this.x2 = x;
    if (y > this.y2) this.y2 = y;
    return this;
  },
  expand(d) {
    this.x1 -= d;
    this.y1 -= d;
    this.x2 += d;
    this.y2 += d;
    return this;
  },
  round() {
    this.x1 = Math.floor(this.x1);
    this.y1 = Math.floor(this.y1);
    this.x2 = Math.ceil(this.x2);
    this.y2 = Math.ceil(this.y2);
    return this;
  },
  scale(s) {
    this.x1 *= s;
    this.y1 *= s;
    this.x2 *= s;
    this.y2 *= s;
    return this;
  },
  translate(dx, dy) {
    this.x1 += dx;
    this.x2 += dx;
    this.y1 += dy;
    this.y2 += dy;
    return this;
  },
  rotate(angle, x, y) {
    const p = this.rotatedPoints(angle, x, y);
    return this.clear().add(p[0], p[1]).add(p[2], p[3]).add(p[4], p[5]).add(p[6], p[7]);
  },
  rotatedPoints(angle, x, y) {
    var {
        x1,
        y1,
        x2,
        y2
      } = this,
      cos = Math.cos(angle),
      sin = Math.sin(angle),
      cx = x - x * cos + y * sin,
      cy = y - x * sin - y * cos;
    return [cos * x1 - sin * y1 + cx, sin * x1 + cos * y1 + cy, cos * x1 - sin * y2 + cx, sin * x1 + cos * y2 + cy, cos * x2 - sin * y1 + cx, sin * x2 + cos * y1 + cy, cos * x2 - sin * y2 + cx, sin * x2 + cos * y2 + cy];
  },
  union(b) {
    if (b.x1 < this.x1) this.x1 = b.x1;
    if (b.y1 < this.y1) this.y1 = b.y1;
    if (b.x2 > this.x2) this.x2 = b.x2;
    if (b.y2 > this.y2) this.y2 = b.y2;
    return this;
  },
  intersect(b) {
    if (b.x1 > this.x1) this.x1 = b.x1;
    if (b.y1 > this.y1) this.y1 = b.y1;
    if (b.x2 < this.x2) this.x2 = b.x2;
    if (b.y2 < this.y2) this.y2 = b.y2;
    return this;
  },
  encloses(b) {
    return b && this.x1 <= b.x1 && this.x2 >= b.x2 && this.y1 <= b.y1 && this.y2 >= b.y2;
  },
  alignsWith(b) {
    return b && (this.x1 == b.x1 || this.x2 == b.x2 || this.y1 == b.y1 || this.y2 == b.y2);
  },
  intersects(b) {
    return b && !(this.x2 < b.x1 || this.x1 > b.x2 || this.y2 < b.y1 || this.y1 > b.y2);
  },
  contains(x, y) {
    return !(x < this.x1 || x > this.x2 || y < this.y1 || y > this.y2);
  },
  width() {
    return this.x2 - this.x1;
  },
  height() {
    return this.y2 - this.y1;
  }
};

function Item(mark) {
  this.mark = mark;
  this.bounds = this.bounds || new Bounds();
}

function GroupItem(mark) {
  Item.call(this, mark);
  this.items = this.items || [];
}
inherits(GroupItem, Item);

function ResourceLoader(customLoader) {
  this._pending = 0;
  this._loader = customLoader || loader();
}
function increment(loader) {
  loader._pending += 1;
}
function decrement(loader) {
  loader._pending -= 1;
}
ResourceLoader.prototype = {
  pending() {
    return this._pending;
  },
  sanitizeURL(uri) {
    const loader = this;
    increment(loader);
    return loader._loader.sanitize(uri, {
      context: 'href'
    }).then(opt => {
      decrement(loader);
      return opt;
    }).catch(() => {
      decrement(loader);
      return null;
    });
  },
  loadImage(uri) {
    const loader = this,
      Image = image$1();
    increment(loader);
    return loader._loader.sanitize(uri, {
      context: 'image'
    }).then(opt => {
      const url = opt.href;
      if (!url || !Image) throw {
        url: url
      };
      const img = new Image();

      // set crossOrigin only if cors is defined; empty string sets anonymous mode
      // https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin
      const cors = hasOwnProperty(opt, 'crossOrigin') ? opt.crossOrigin : 'anonymous';
      if (cors != null) img.crossOrigin = cors;

      // attempt to load image resource
      img.onload = () => decrement(loader);
      img.onerror = () => decrement(loader);
      img.src = url;
      return img;
    }).catch(e => {
      decrement(loader);
      return {
        complete: false,
        width: 0,
        height: 0,
        src: e && e.url || ''
      };
    });
  },
  ready() {
    const loader = this;
    return new Promise(accept => {
      function poll(value) {
        if (!loader.pending()) accept(value);else setTimeout(() => {
          poll(true);
        }, 10);
      }
      poll(false);
    });
  }
};

function boundStroke (bounds, item, miter) {
  if (item.stroke && item.opacity !== 0 && item.strokeOpacity !== 0) {
    const sw = item.strokeWidth != null ? +item.strokeWidth : 1;
    bounds.expand(sw + (miter ? miterAdjustment(item, sw) : 0));
  }
  return bounds;
}
function miterAdjustment(item, strokeWidth) {
  // TODO: more sophisticated adjustment? Or miter support in boundContext?
  return item.strokeJoin && item.strokeJoin !== 'miter' ? 0 : strokeWidth;
}

const circleThreshold = Tau - 1e-8;
let bounds, lx, ly, rot, ma, mb, mc, md;
const add = (x, y) => bounds.add(x, y);
const addL = (x, y) => add(lx = x, ly = y);
const addX = x => add(x, bounds.y1);
const addY = y => add(bounds.x1, y);
const px = (x, y) => ma * x + mc * y;
const py = (x, y) => mb * x + md * y;
const addp = (x, y) => add(px(x, y), py(x, y));
const addpL = (x, y) => addL(px(x, y), py(x, y));
function boundContext (_, deg) {
  bounds = _;
  if (deg) {
    rot = deg * DegToRad;
    ma = md = Math.cos(rot);
    mb = Math.sin(rot);
    mc = -mb;
  } else {
    ma = md = 1;
    rot = mb = mc = 0;
  }
  return context$1;
}
const context$1 = {
  beginPath() {},
  closePath() {},
  moveTo: addpL,
  lineTo: addpL,
  rect(x, y, w, h) {
    if (rot) {
      addp(x + w, y);
      addp(x + w, y + h);
      addp(x, y + h);
      addpL(x, y);
    } else {
      add(x + w, y + h);
      addL(x, y);
    }
  },
  quadraticCurveTo(x1, y1, x2, y2) {
    const px1 = px(x1, y1),
      py1 = py(x1, y1),
      px2 = px(x2, y2),
      py2 = py(x2, y2);
    quadExtrema(lx, px1, px2, addX);
    quadExtrema(ly, py1, py2, addY);
    addL(px2, py2);
  },
  bezierCurveTo(x1, y1, x2, y2, x3, y3) {
    const px1 = px(x1, y1),
      py1 = py(x1, y1),
      px2 = px(x2, y2),
      py2 = py(x2, y2),
      px3 = px(x3, y3),
      py3 = py(x3, y3);
    cubicExtrema(lx, px1, px2, px3, addX);
    cubicExtrema(ly, py1, py2, py3, addY);
    addL(px3, py3);
  },
  arc(cx, cy, r, sa, ea, ccw) {
    sa += rot;
    ea += rot;

    // store last point on path
    lx = r * Math.cos(ea) + cx;
    ly = r * Math.sin(ea) + cy;
    if (Math.abs(ea - sa) > circleThreshold) {
      // treat as full circle
      add(cx - r, cy - r);
      add(cx + r, cy + r);
    } else {
      const update = a => add(r * Math.cos(a) + cx, r * Math.sin(a) + cy);
      let s, i;

      // sample end points
      update(sa);
      update(ea);

      // sample interior points aligned with 90 degrees
      if (ea !== sa) {
        sa = sa % Tau;
        if (sa < 0) sa += Tau;
        ea = ea % Tau;
        if (ea < 0) ea += Tau;
        if (ea < sa) {
          ccw = !ccw; // flip direction
          s = sa;
          sa = ea;
          ea = s; // swap end-points
        }

        if (ccw) {
          ea -= Tau;
          s = sa - sa % HalfPi;
          for (i = 0; i < 4 && s > ea; ++i, s -= HalfPi) update(s);
        } else {
          s = sa - sa % HalfPi + HalfPi;
          for (i = 0; i < 4 && s < ea; ++i, s = s + HalfPi) update(s);
        }
      }
    }
  }
};
function quadExtrema(x0, x1, x2, cb) {
  const t = (x0 - x1) / (x0 + x2 - 2 * x1);
  if (0 < t && t < 1) cb(x0 + (x1 - x0) * t);
}
function cubicExtrema(x0, x1, x2, x3, cb) {
  const a = x3 - x0 + 3 * x1 - 3 * x2,
    b = x0 + x2 - 2 * x1,
    c = x0 - x1;
  let t0 = 0,
    t1 = 0,
    r;

  // solve for parameter t
  if (Math.abs(a) > Epsilon) {
    // quadratic equation
    r = b * b + c * a;
    if (r >= 0) {
      r = Math.sqrt(r);
      t0 = (-b + r) / a;
      t1 = (-b - r) / a;
    }
  } else {
    // linear equation
    t0 = 0.5 * c / b;
  }

  // calculate position
  if (0 < t0 && t0 < 1) cb(cubic(t0, x0, x1, x2, x3));
  if (0 < t1 && t1 < 1) cb(cubic(t1, x0, x1, x2, x3));
}
function cubic(t, x0, x1, x2, x3) {
  const s = 1 - t,
    s2 = s * s,
    t2 = t * t;
  return s2 * s * x0 + 3 * s2 * t * x1 + 3 * s * t2 * x2 + t2 * t * x3;
}

var context = (context = canvas(1, 1)) ? context.getContext('2d') : null;

const b = new Bounds();
function intersectPath(draw) {
  return function (item, brush) {
    // rely on (inaccurate) bounds intersection if no context
    if (!context) return true;

    // add path to offscreen graphics context
    draw(context, item);

    // get bounds intersection region
    b.clear().union(item.bounds).intersect(brush).round();
    const {
      x1,
      y1,
      x2,
      y2
    } = b;

    // iterate over intersection region
    // perform fine grained inclusion test
    for (let y = y1; y <= y2; ++y) {
      for (let x = x1; x <= x2; ++x) {
        if (context.isPointInPath(x, y)) {
          return true;
        }
      }
    }

    // false if no hits in intersection region
    return false;
  };
}
function intersectPoint(item, box) {
  return box.contains(item.x || 0, item.y || 0);
}
function intersectRect(item, box) {
  const x = item.x || 0,
    y = item.y || 0,
    w = item.width || 0,
    h = item.height || 0;
  return box.intersects(b.set(x, y, x + w, y + h));
}
function intersectRule(item, box) {
  const x = item.x || 0,
    y = item.y || 0,
    x2 = item.x2 != null ? item.x2 : x,
    y2 = item.y2 != null ? item.y2 : y;
  return intersectBoxLine(box, x, y, x2, y2);
}
function intersectBoxLine(box, x, y, u, v) {
  const {
      x1,
      y1,
      x2,
      y2
    } = box,
    dx = u - x,
    dy = v - y;
  let t0 = 0,
    t1 = 1,
    p,
    q,
    r,
    e;
  for (e = 0; e < 4; ++e) {
    if (e === 0) {
      p = -dx;
      q = -(x1 - x);
    }
    if (e === 1) {
      p = dx;
      q = x2 - x;
    }
    if (e === 2) {
      p = -dy;
      q = -(y1 - y);
    }
    if (e === 3) {
      p = dy;
      q = y2 - y;
    }
    if (Math.abs(p) < 1e-10 && q < 0) return false;
    r = q / p;
    if (p < 0) {
      if (r > t1) return false;else if (r > t0) t0 = r;
    } else if (p > 0) {
      if (r < t0) return false;else if (r < t1) t1 = r;
    }
  }
  return true;
}

function blend (context, item) {
  context.globalCompositeOperation = item.blend || 'source-over';
}

function value (value, dflt) {
  return value == null ? dflt : value;
}

function addStops(gradient, stops) {
  const n = stops.length;
  for (let i = 0; i < n; ++i) {
    gradient.addColorStop(stops[i].offset, stops[i].color);
  }
  return gradient;
}
function gradient (context, spec, bounds) {
  const w = bounds.width(),
    h = bounds.height();
  let gradient;
  if (spec.gradient === 'radial') {
    gradient = context.createRadialGradient(bounds.x1 + value(spec.x1, 0.5) * w, bounds.y1 + value(spec.y1, 0.5) * h, Math.max(w, h) * value(spec.r1, 0), bounds.x1 + value(spec.x2, 0.5) * w, bounds.y1 + value(spec.y2, 0.5) * h, Math.max(w, h) * value(spec.r2, 0.5));
  } else {
    // linear gradient
    const x1 = value(spec.x1, 0),
      y1 = value(spec.y1, 0),
      x2 = value(spec.x2, 1),
      y2 = value(spec.y2, 0);
    if (x1 === x2 || y1 === y2 || w === h) {
      // axis aligned: use normal gradient
      gradient = context.createLinearGradient(bounds.x1 + x1 * w, bounds.y1 + y1 * h, bounds.x1 + x2 * w, bounds.y1 + y2 * h);
    } else {
      // not axis aligned: render gradient into a pattern (#2365)
      // this allows us to use normalized bounding box coordinates
      const image = canvas(Math.ceil(w), Math.ceil(h)),
        ictx = image.getContext('2d');
      ictx.scale(w, h);
      ictx.fillStyle = addStops(ictx.createLinearGradient(x1, y1, x2, y2), spec.stops);
      ictx.fillRect(0, 0, w, h);
      return context.createPattern(image, 'no-repeat');
    }
  }
  return addStops(gradient, spec.stops);
}

function color (context, item, value) {
  return isGradient(value) ? gradient(context, value, item.bounds) : value;
}

function fill (context, item, opacity) {
  opacity *= item.fillOpacity == null ? 1 : item.fillOpacity;
  if (opacity > 0) {
    context.globalAlpha = opacity;
    context.fillStyle = color(context, item, item.fill);
    return true;
  } else {
    return false;
  }
}

var Empty = [];
function stroke (context, item, opacity) {
  var lw = (lw = item.strokeWidth) != null ? lw : 1;
  if (lw <= 0) return false;
  opacity *= item.strokeOpacity == null ? 1 : item.strokeOpacity;
  if (opacity > 0) {
    context.globalAlpha = opacity;
    context.strokeStyle = color(context, item, item.stroke);
    context.lineWidth = lw;
    context.lineCap = item.strokeCap || 'butt';
    context.lineJoin = item.strokeJoin || 'miter';
    context.miterLimit = item.strokeMiterLimit || 10;
    if (context.setLineDash) {
      context.setLineDash(item.strokeDash || Empty);
      context.lineDashOffset = item.strokeDashOffset || 0;
    }
    return true;
  } else {
    return false;
  }
}

function compare(a, b) {
  return a.zindex - b.zindex || a.index - b.index;
}
function zorder(scene) {
  if (!scene.zdirty) return scene.zitems;
  var items = scene.items,
    output = [],
    item,
    i,
    n;
  for (i = 0, n = items.length; i < n; ++i) {
    item = items[i];
    item.index = i;
    if (item.zindex) output.push(item);
  }
  scene.zdirty = false;
  return scene.zitems = output.sort(compare);
}
function visit(scene, visitor) {
  var items = scene.items,
    i,
    n;
  if (!items || !items.length) return;
  const zitems = zorder(scene);
  if (zitems && zitems.length) {
    for (i = 0, n = items.length; i < n; ++i) {
      if (!items[i].zindex) visitor(items[i]);
    }
    items = zitems;
  }
  for (i = 0, n = items.length; i < n; ++i) {
    visitor(items[i]);
  }
}
function pickVisit(scene, visitor) {
  var items = scene.items,
    hit,
    i;
  if (!items || !items.length) return null;
  const zitems = zorder(scene);
  if (zitems && zitems.length) items = zitems;
  for (i = items.length; --i >= 0;) {
    if (hit = visitor(items[i])) return hit;
  }
  if (items === zitems) {
    for (items = scene.items, i = items.length; --i >= 0;) {
      if (!items[i].zindex) {
        if (hit = visitor(items[i])) return hit;
      }
    }
  }
  return null;
}

function drawAll(path) {
  return function (context, scene, bounds) {
    visit(scene, item => {
      if (!bounds || bounds.intersects(item.bounds)) {
        drawPath(path, context, item, item);
      }
    });
  };
}
function drawOne(path) {
  return function (context, scene, bounds) {
    if (scene.items.length && (!bounds || bounds.intersects(scene.bounds))) {
      drawPath(path, context, scene.items[0], scene.items);
    }
  };
}
function drawPath(path, context, item, items) {
  var opacity = item.opacity == null ? 1 : item.opacity;
  if (opacity === 0) return;
  if (path(context, items)) return;
  blend(context, item);
  if (item.fill && fill(context, item, opacity)) {
    context.fill();
  }
  if (item.stroke && stroke(context, item, opacity)) {
    context.stroke();
  }
}

function pick$1(test) {
  test = test || truthy;
  return function (context, scene, x, y, gx, gy) {
    x *= context.pixelRatio;
    y *= context.pixelRatio;
    return pickVisit(scene, item => {
      const b = item.bounds;
      // first hit test against bounding box
      if (b && !b.contains(gx, gy) || !b) return;
      // if in bounding box, perform more careful test
      if (test(context, item, x, y, gx, gy)) return item;
    });
  };
}
function hitPath(path, filled) {
  return function (context, o, x, y) {
    var item = Array.isArray(o) ? o[0] : o,
      fill = filled == null ? item.fill : filled,
      stroke = item.stroke && context.isPointInStroke,
      lw,
      lc;
    if (stroke) {
      lw = item.strokeWidth;
      lc = item.strokeCap;
      context.lineWidth = lw != null ? lw : 1;
      context.lineCap = lc != null ? lc : 'butt';
    }
    return path(context, o) ? false : fill && context.isPointInPath(x, y) || stroke && context.isPointInStroke(x, y);
  };
}
function pickPath(path) {
  return pick$1(hitPath(path));
}

function translate(x, y) {
  return 'translate(' + x + ',' + y + ')';
}
function rotate(a) {
  return 'rotate(' + a + ')';
}
function scale(scaleX, scaleY) {
  return 'scale(' + scaleX + ',' + scaleY + ')';
}
function translateItem(item) {
  return translate(item.x || 0, item.y || 0);
}
function rotateItem(item) {
  return translate(item.x || 0, item.y || 0) + (item.angle ? ' ' + rotate(item.angle) : '');
}
function transformItem(item) {
  return translate(item.x || 0, item.y || 0) + (item.angle ? ' ' + rotate(item.angle) : '') + (item.scaleX || item.scaleY ? ' ' + scale(item.scaleX || 1, item.scaleY || 1) : '');
}

function markItemPath (type, shape, isect) {
  function attr(emit, item) {
    emit('transform', rotateItem(item));
    emit('d', shape(null, item));
  }
  function bound(bounds, item) {
    shape(boundContext(bounds, item.angle), item);
    return boundStroke(bounds, item).translate(item.x || 0, item.y || 0);
  }
  function draw(context, item) {
    var x = item.x || 0,
      y = item.y || 0,
      a = item.angle || 0;
    context.translate(x, y);
    if (a) context.rotate(a *= DegToRad);
    context.beginPath();
    shape(context, item);
    if (a) context.rotate(-a);
    context.translate(-x, -y);
  }
  return {
    type: type,
    tag: 'path',
    nested: false,
    attr: attr,
    bound: bound,
    draw: drawAll(draw),
    pick: pickPath(draw),
    isect: isect || intersectPath(draw)
  };
}

var arc = markItemPath('arc', arc$1);

function pickArea(a, p) {
  var v = a[0].orient === 'horizontal' ? p[1] : p[0],
    z = a[0].orient === 'horizontal' ? 'y' : 'x',
    i = a.length,
    min = +Infinity,
    hit,
    d;
  while (--i >= 0) {
    if (a[i].defined === false) continue;
    d = Math.abs(a[i][z] - v);
    if (d < min) {
      min = d;
      hit = a[i];
    }
  }
  return hit;
}
function pickLine(a, p) {
  var t = Math.pow(a[0].strokeWidth || 1, 2),
    i = a.length,
    dx,
    dy,
    dd;
  while (--i >= 0) {
    if (a[i].defined === false) continue;
    dx = a[i].x - p[0];
    dy = a[i].y - p[1];
    dd = dx * dx + dy * dy;
    if (dd < t) return a[i];
  }
  return null;
}
function pickTrail(a, p) {
  var i = a.length,
    dx,
    dy,
    dd;
  while (--i >= 0) {
    if (a[i].defined === false) continue;
    dx = a[i].x - p[0];
    dy = a[i].y - p[1];
    dd = dx * dx + dy * dy;
    dx = a[i].size || 1;
    if (dd < dx * dx) return a[i];
  }
  return null;
}

function markMultiItemPath (type, shape, tip) {
  function attr(emit, item) {
    var items = item.mark.items;
    if (items.length) emit('d', shape(null, items));
  }
  function bound(bounds, mark) {
    var items = mark.items;
    if (items.length === 0) {
      return bounds;
    } else {
      shape(boundContext(bounds), items);
      return boundStroke(bounds, items[0]);
    }
  }
  function draw(context, items) {
    context.beginPath();
    shape(context, items);
  }
  const hit = hitPath(draw);
  function pick(context, scene, x, y, gx, gy) {
    var items = scene.items,
      b = scene.bounds;
    if (!items || !items.length || b && !b.contains(gx, gy)) {
      return null;
    }
    x *= context.pixelRatio;
    y *= context.pixelRatio;
    return hit(context, items, x, y) ? items[0] : null;
  }
  return {
    type: type,
    tag: 'path',
    nested: true,
    attr: attr,
    bound: bound,
    draw: drawOne(draw),
    pick: pick,
    isect: intersectPoint,
    tip: tip
  };
}

var area = markMultiItemPath('area', area$1, pickArea);

function clip (context, scene) {
  var clip = scene.clip;
  context.save();
  if (isFunction(clip)) {
    context.beginPath();
    clip(context);
    context.clip();
  } else {
    clipGroup(context, scene.group);
  }
}
function clipGroup(context, group) {
  context.beginPath();
  hasCornerRadius(group) ? rectangle(context, group, 0, 0) : context.rect(0, 0, group.width || 0, group.height || 0);
  context.clip();
}

function offset$1(item) {
  const sw = value(item.strokeWidth, 1);
  return item.strokeOffset != null ? item.strokeOffset : item.stroke && sw > 0.5 && sw < 1.5 ? 0.5 - Math.abs(sw - 1) : 0;
}
function attr$5(emit, item) {
  emit('transform', translateItem(item));
}
function emitRectangle(emit, item) {
  const off = offset$1(item);
  emit('d', rectangle(null, item, off, off));
}
function background(emit, item) {
  emit('class', 'background');
  emit('aria-hidden', true);
  emitRectangle(emit, item);
}
function foreground(emit, item) {
  emit('class', 'foreground');
  emit('aria-hidden', true);
  if (item.strokeForeground) {
    emitRectangle(emit, item);
  } else {
    emit('d', '');
  }
}
function content(emit, item, renderer) {
  const url = item.clip ? clip$1(renderer, item, item) : null;
  emit('clip-path', url);
}
function bound$5(bounds, group) {
  if (!group.clip && group.items) {
    const items = group.items,
      m = items.length;
    for (let j = 0; j < m; ++j) {
      bounds.union(items[j].bounds);
    }
  }
  if ((group.clip || group.width || group.height) && !group.noBound) {
    bounds.add(0, 0).add(group.width || 0, group.height || 0);
  }
  boundStroke(bounds, group);
  return bounds.translate(group.x || 0, group.y || 0);
}
function rectanglePath(context, group, x, y) {
  const off = offset$1(group);
  context.beginPath();
  rectangle(context, group, (x || 0) + off, (y || 0) + off);
}
const hitBackground = hitPath(rectanglePath);
const hitForeground = hitPath(rectanglePath, false);
const hitCorner = hitPath(rectanglePath, true);
function draw$4(context, scene, bounds) {
  visit(scene, group => {
    const gx = group.x || 0,
      gy = group.y || 0,
      fore = group.strokeForeground,
      opacity = group.opacity == null ? 1 : group.opacity;

    // draw group background
    if ((group.stroke || group.fill) && opacity) {
      rectanglePath(context, group, gx, gy);
      blend(context, group);
      if (group.fill && fill(context, group, opacity)) {
        context.fill();
      }
      if (group.stroke && !fore && stroke(context, group, opacity)) {
        context.stroke();
      }
    }

    // setup graphics context, set clip and bounds
    context.save();
    context.translate(gx, gy);
    if (group.clip) clipGroup(context, group);
    if (bounds) bounds.translate(-gx, -gy);

    // draw group contents
    visit(group, item => {
      this.draw(context, item, bounds);
    });

    // restore graphics context
    if (bounds) bounds.translate(gx, gy);
    context.restore();

    // draw group foreground
    if (fore && group.stroke && opacity) {
      rectanglePath(context, group, gx, gy);
      blend(context, group);
      if (stroke(context, group, opacity)) {
        context.stroke();
      }
    }
  });
}
function pick(context, scene, x, y, gx, gy) {
  if (scene.bounds && !scene.bounds.contains(gx, gy) || !scene.items) {
    return null;
  }
  const cx = x * context.pixelRatio,
    cy = y * context.pixelRatio;
  return pickVisit(scene, group => {
    let hit, dx, dy;

    // first hit test bounding box
    const b = group.bounds;
    if (b && !b.contains(gx, gy)) return;

    // passed bounds check, test rectangular clip
    dx = group.x || 0;
    dy = group.y || 0;
    const dw = dx + (group.width || 0),
      dh = dy + (group.height || 0),
      c = group.clip;
    if (c && (gx < dx || gx > dw || gy < dy || gy > dh)) return;

    // adjust coordinate system
    context.save();
    context.translate(dx, dy);
    dx = gx - dx;
    dy = gy - dy;

    // test background for rounded corner clip
    if (c && hasCornerRadius(group) && !hitCorner(context, group, cx, cy)) {
      context.restore();
      return null;
    }
    const fore = group.strokeForeground,
      ix = scene.interactive !== false;

    // hit test against group foreground
    if (ix && fore && group.stroke && hitForeground(context, group, cx, cy)) {
      context.restore();
      return group;
    }

    // hit test against contained marks
    hit = pickVisit(group, mark => pickMark(mark, dx, dy) ? this.pick(mark, x, y, dx, dy) : null);

    // hit test against group background
    if (!hit && ix && (group.fill || !fore && group.stroke) && hitBackground(context, group, cx, cy)) {
      hit = group;
    }

    // restore state and return
    context.restore();
    return hit || null;
  });
}
function pickMark(mark, x, y) {
  return (mark.interactive !== false || mark.marktype === 'group') && mark.bounds && mark.bounds.contains(x, y);
}
var group = {
  type: 'group',
  tag: 'g',
  nested: false,
  attr: attr$5,
  bound: bound$5,
  draw: draw$4,
  pick: pick,
  isect: intersectRect,
  content: content,
  background: background,
  foreground: foreground
};

var metadata = {
  'xmlns': 'http://www.w3.org/2000/svg',
  'xmlns:xlink': 'http://www.w3.org/1999/xlink',
  'version': '1.1'
};

function getImage(item, renderer) {
  var image = item.image;
  if (!image || item.url && item.url !== image.url) {
    image = {
      complete: false,
      width: 0,
      height: 0
    };
    renderer.loadImage(item.url).then(image => {
      item.image = image;
      item.image.url = item.url;
    });
  }
  return image;
}
function imageWidth(item, image) {
  return item.width != null ? item.width : !image || !image.width ? 0 : item.aspect !== false && item.height ? item.height * image.width / image.height : image.width;
}
function imageHeight(item, image) {
  return item.height != null ? item.height : !image || !image.height ? 0 : item.aspect !== false && item.width ? item.width * image.height / image.width : image.height;
}
function imageXOffset(align, w) {
  return align === 'center' ? w / 2 : align === 'right' ? w : 0;
}
function imageYOffset(baseline, h) {
  return baseline === 'middle' ? h / 2 : baseline === 'bottom' ? h : 0;
}
function attr$4(emit, item, renderer) {
  const img = getImage(item, renderer),
    w = imageWidth(item, img),
    h = imageHeight(item, img),
    x = (item.x || 0) - imageXOffset(item.align, w),
    y = (item.y || 0) - imageYOffset(item.baseline, h),
    i = !img.src && img.toDataURL ? img.toDataURL() : img.src || '';
  emit('href', i, metadata['xmlns:xlink'], 'xlink:href');
  emit('transform', translate(x, y));
  emit('width', w);
  emit('height', h);
  emit('preserveAspectRatio', item.aspect === false ? 'none' : 'xMidYMid');
}
function bound$4(bounds, item) {
  const img = item.image,
    w = imageWidth(item, img),
    h = imageHeight(item, img),
    x = (item.x || 0) - imageXOffset(item.align, w),
    y = (item.y || 0) - imageYOffset(item.baseline, h);
  return bounds.set(x, y, x + w, y + h);
}
function draw$3(context, scene, bounds) {
  visit(scene, item => {
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check

    const img = getImage(item, this);
    let w = imageWidth(item, img);
    let h = imageHeight(item, img);
    if (w === 0 || h === 0) return; // early exit

    let x = (item.x || 0) - imageXOffset(item.align, w),
      y = (item.y || 0) - imageYOffset(item.baseline, h),
      opacity,
      ar0,
      ar1,
      t;
    if (item.aspect !== false) {
      ar0 = img.width / img.height;
      ar1 = item.width / item.height;
      if (ar0 === ar0 && ar1 === ar1 && ar0 !== ar1) {
        if (ar1 < ar0) {
          t = w / ar0;
          y += (h - t) / 2;
          h = t;
        } else {
          t = h * ar0;
          x += (w - t) / 2;
          w = t;
        }
      }
    }
    if (img.complete || img.toDataURL) {
      blend(context, item);
      context.globalAlpha = (opacity = item.opacity) != null ? opacity : 1;
      context.imageSmoothingEnabled = item.smooth !== false;
      context.drawImage(img, x, y, w, h);
    }
  });
}
var image = {
  type: 'image',
  tag: 'image',
  nested: false,
  attr: attr$4,
  bound: bound$4,
  draw: draw$3,
  pick: pick$1(),
  isect: truthy,
  // bounds check is sufficient
  get: getImage,
  xOffset: imageXOffset,
  yOffset: imageYOffset
};

var line = markMultiItemPath('line', line$1, pickLine);

function attr$3(emit, item) {
  var sx = item.scaleX || 1,
    sy = item.scaleY || 1;
  if (sx !== 1 || sy !== 1) {
    emit('vector-effect', 'non-scaling-stroke');
  }
  emit('transform', transformItem(item));
  emit('d', item.path);
}
function path$1(context, item) {
  var path = item.path;
  if (path == null) return true;
  var x = item.x || 0,
    y = item.y || 0,
    sx = item.scaleX || 1,
    sy = item.scaleY || 1,
    a = (item.angle || 0) * DegToRad,
    cache = item.pathCache;
  if (!cache || cache.path !== path) {
    (item.pathCache = cache = parse(path)).path = path;
  }
  if (a && context.rotate && context.translate) {
    context.translate(x, y);
    context.rotate(a);
    pathRender(context, cache, 0, 0, sx, sy);
    context.rotate(-a);
    context.translate(-x, -y);
  } else {
    pathRender(context, cache, x, y, sx, sy);
  }
}
function bound$3(bounds, item) {
  return path$1(boundContext(bounds, item.angle), item) ? bounds.set(0, 0, 0, 0) : boundStroke(bounds, item, true);
}
var path$2 = {
  type: 'path',
  tag: 'path',
  nested: false,
  attr: attr$3,
  bound: bound$3,
  draw: drawAll(path$1),
  pick: pickPath(path$1),
  isect: intersectPath(path$1)
};

function attr$2(emit, item) {
  emit('d', rectangle(null, item));
}
function bound$2(bounds, item) {
  var x, y;
  return boundStroke(bounds.set(x = item.x || 0, y = item.y || 0, x + item.width || 0, y + item.height || 0), item);
}
function draw$2(context, item) {
  context.beginPath();
  rectangle(context, item);
}
var rect = {
  type: 'rect',
  tag: 'path',
  nested: false,
  attr: attr$2,
  bound: bound$2,
  draw: drawAll(draw$2),
  pick: pickPath(draw$2),
  isect: intersectRect
};

function attr$1(emit, item) {
  emit('transform', translateItem(item));
  emit('x2', item.x2 != null ? item.x2 - (item.x || 0) : 0);
  emit('y2', item.y2 != null ? item.y2 - (item.y || 0) : 0);
}
function bound$1(bounds, item) {
  var x1, y1;
  return boundStroke(bounds.set(x1 = item.x || 0, y1 = item.y || 0, item.x2 != null ? item.x2 : x1, item.y2 != null ? item.y2 : y1), item);
}
function path(context, item, opacity) {
  var x1, y1, x2, y2;
  if (item.stroke && stroke(context, item, opacity)) {
    x1 = item.x || 0;
    y1 = item.y || 0;
    x2 = item.x2 != null ? item.x2 : x1;
    y2 = item.y2 != null ? item.y2 : y1;
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    return true;
  }
  return false;
}
function draw$1(context, scene, bounds) {
  visit(scene, item => {
    if (bounds && !bounds.intersects(item.bounds)) return; // bounds check
    var opacity = item.opacity == null ? 1 : item.opacity;
    if (opacity && path(context, item, opacity)) {
      blend(context, item);
      context.stroke();
    }
  });
}
function hit$1(context, item, x, y) {
  if (!context.isPointInStroke) return false;
  return path(context, item, 1) && context.isPointInStroke(x, y);
}
var rule = {
  type: 'rule',
  tag: 'line',
  nested: false,
  attr: attr$1,
  bound: bound$1,
  draw: draw$1,
  pick: pick$1(hit$1),
  isect: intersectRule
};

var shape = markItemPath('shape', shape$1);

var symbol = markItemPath('symbol', symbol$1, intersectPoint);

// memoize text width measurement
const widthCache = lruCache();
var textMetrics = {
  height: fontSize,
  measureWidth: measureWidth,
  estimateWidth: estimateWidth,
  width: estimateWidth,
  canvas: useCanvas
};
useCanvas(true);
function useCanvas(use) {
  textMetrics.width = use && context ? measureWidth : estimateWidth;
}

// make simple estimate if no canvas is available
function estimateWidth(item, text) {
  return _estimateWidth(textValue(item, text), fontSize(item));
}
function _estimateWidth(text, currentFontHeight) {
  return ~~(0.8 * text.length * currentFontHeight);
}

// measure text width if canvas is available
function measureWidth(item, text) {
  return fontSize(item) <= 0 || !(text = textValue(item, text)) ? 0 : _measureWidth(text, font(item));
}
function _measureWidth(text, currentFont) {
  const key = `(${currentFont}) ${text}`;
  let width = widthCache.get(key);
  if (width === undefined) {
    context.font = currentFont;
    width = context.measureText(text).width;
    widthCache.set(key, width);
  }
  return width;
}
function fontSize(item) {
  return item.fontSize != null ? +item.fontSize || 0 : 11;
}
function lineHeight(item) {
  return item.lineHeight != null ? item.lineHeight : fontSize(item) + 2;
}
function lineArray(_) {
  return isArray(_) ? _.length > 1 ? _ : _[0] : _;
}
function textLines(item) {
  return lineArray(item.lineBreak && item.text && !isArray(item.text) ? item.text.split(item.lineBreak) : item.text);
}
function multiLineOffset(item) {
  const tl = textLines(item);
  return (isArray(tl) ? tl.length - 1 : 0) * lineHeight(item);
}
function textValue(item, line) {
  const text = line == null ? '' : (line + '').trim();
  return item.limit > 0 && text.length ? truncate(item, text) : text;
}
function widthGetter(item) {
  if (textMetrics.width === measureWidth) {
    // we are using canvas
    const currentFont = font(item);
    return text => _measureWidth(text, currentFont);
  } else {
    // we are relying on estimates
    const currentFontHeight = fontSize(item);
    return text => _estimateWidth(text, currentFontHeight);
  }
}
function truncate(item, text) {
  var limit = +item.limit,
    width = widthGetter(item);
  if (width(text) < limit) return text;
  var ellipsis = item.ellipsis || '\u2026',
    rtl = item.dir === 'rtl',
    lo = 0,
    hi = text.length,
    mid;
  limit -= width(ellipsis);
  if (rtl) {
    while (lo < hi) {
      mid = lo + hi >>> 1;
      if (width(text.slice(mid)) > limit) lo = mid + 1;else hi = mid;
    }
    return ellipsis + text.slice(lo);
  } else {
    while (lo < hi) {
      mid = 1 + (lo + hi >>> 1);
      if (width(text.slice(0, mid)) < limit) lo = mid;else hi = mid - 1;
    }
    return text.slice(0, lo) + ellipsis;
  }
}
function fontFamily(item, quote) {
  var font = item.font;
  return (quote && font ? String(font).replace(/"/g, '\'') : font) || 'sans-serif';
}
function font(item, quote) {
  return '' + (item.fontStyle ? item.fontStyle + ' ' : '') + (item.fontVariant ? item.fontVariant + ' ' : '') + (item.fontWeight ? item.fontWeight + ' ' : '') + fontSize(item) + 'px ' + fontFamily(item, quote);
}
function offset(item) {
  // perform our own font baseline calculation
  // why? not all browsers support SVG 1.1 'alignment-baseline' :(
  // this also ensures consistent layout across renderers
  var baseline = item.baseline,
    h = fontSize(item);
  return Math.round(baseline === 'top' ? 0.79 * h : baseline === 'middle' ? 0.30 * h : baseline === 'bottom' ? -0.21 * h : baseline === 'line-top' ? 0.29 * h + 0.5 * lineHeight(item) : baseline === 'line-bottom' ? 0.29 * h - 0.5 * lineHeight(item) : 0);
}

const textAlign = {
  'left': 'start',
  'center': 'middle',
  'right': 'end'
};
const tempBounds = new Bounds();
function anchorPoint(item) {
  var x = item.x || 0,
    y = item.y || 0,
    r = item.radius || 0,
    t;
  if (r) {
    t = (item.theta || 0) - HalfPi;
    x += r * Math.cos(t);
    y += r * Math.sin(t);
  }
  tempBounds.x1 = x;
  tempBounds.y1 = y;
  return tempBounds;
}
function attr(emit, item) {
  var dx = item.dx || 0,
    dy = (item.dy || 0) + offset(item),
    p = anchorPoint(item),
    x = p.x1,
    y = p.y1,
    a = item.angle || 0,
    t;
  emit('text-anchor', textAlign[item.align] || 'start');
  if (a) {
    t = translate(x, y) + ' ' + rotate(a);
    if (dx || dy) t += ' ' + translate(dx, dy);
  } else {
    t = translate(x + dx, y + dy);
  }
  emit('transform', t);
}
function bound(bounds, item, mode) {
  var h = textMetrics.height(item),
    a = item.align,
    p = anchorPoint(item),
    x = p.x1,
    y = p.y1,
    dx = item.dx || 0,
    dy = (item.dy || 0) + offset(item) - Math.round(0.8 * h),
    // use 4/5 offset
    tl = textLines(item),
    w;

  // get dimensions
  if (isArray(tl)) {
    // multi-line text
    h += lineHeight(item) * (tl.length - 1);
    w = tl.reduce((w, t) => Math.max(w, textMetrics.width(item, t)), 0);
  } else {
    // single-line text
    w = textMetrics.width(item, tl);
  }

  // horizontal alignment
  if (a === 'center') {
    dx -= w / 2;
  } else if (a === 'right') {
    dx -= w;
  } else ;
  bounds.set(dx += x, dy += y, dx + w, dy + h);
  if (item.angle && !mode) {
    bounds.rotate(item.angle * DegToRad, x, y);
  } else if (mode === 2) {
    return bounds.rotatedPoints(item.angle * DegToRad, x, y);
  }
  return bounds;
}
function draw(context, scene, bounds) {
  visit(scene, item => {
    var opacity = item.opacity == null ? 1 : item.opacity,
      p,
      x,
      y,
      i,
      lh,
      tl,
      str;
    if (bounds && !bounds.intersects(item.bounds) ||
    // bounds check
    opacity === 0 || item.fontSize <= 0 || item.text == null || item.text.length === 0) return;
    context.font = font(item);
    context.textAlign = item.align || 'left';
    p = anchorPoint(item);
    x = p.x1, y = p.y1;
    if (item.angle) {
      context.save();
      context.translate(x, y);
      context.rotate(item.angle * DegToRad);
      x = y = 0; // reset x, y
    }

    x += item.dx || 0;
    y += (item.dy || 0) + offset(item);
    tl = textLines(item);
    blend(context, item);
    if (isArray(tl)) {
      lh = lineHeight(item);
      for (i = 0; i < tl.length; ++i) {
        str = textValue(item, tl[i]);
        if (item.fill && fill(context, item, opacity)) {
          context.fillText(str, x, y);
        }
        if (item.stroke && stroke(context, item, opacity)) {
          context.strokeText(str, x, y);
        }
        y += lh;
      }
    } else {
      str = textValue(item, tl);
      if (item.fill && fill(context, item, opacity)) {
        context.fillText(str, x, y);
      }
      if (item.stroke && stroke(context, item, opacity)) {
        context.strokeText(str, x, y);
      }
    }
    if (item.angle) context.restore();
  });
}
function hit(context, item, x, y, gx, gy) {
  if (item.fontSize <= 0) return false;
  if (!item.angle) return true; // bounds sufficient if no rotation

  // project point into space of unrotated bounds
  var p = anchorPoint(item),
    ax = p.x1,
    ay = p.y1,
    b = bound(tempBounds, item, 1),
    a = -item.angle * DegToRad,
    cos = Math.cos(a),
    sin = Math.sin(a),
    px = cos * gx - sin * gy + (ax - cos * ax + sin * ay),
    py = sin * gx + cos * gy + (ay - sin * ax - cos * ay);
  return b.contains(px, py);
}
function intersectText(item, box) {
  const p = bound(tempBounds, item, 2);
  return intersectBoxLine(box, p[0], p[1], p[2], p[3]) || intersectBoxLine(box, p[0], p[1], p[4], p[5]) || intersectBoxLine(box, p[4], p[5], p[6], p[7]) || intersectBoxLine(box, p[2], p[3], p[6], p[7]);
}
var text = {
  type: 'text',
  tag: 'text',
  nested: false,
  attr: attr,
  bound: bound,
  draw: draw,
  pick: pick$1(hit),
  isect: intersectText
};

var trail = markMultiItemPath('trail', trail$1, pickTrail);

var Marks = {
  arc: arc,
  area: area,
  group: group,
  image: image,
  line: line,
  path: path$2,
  rect: rect,
  rule: rule,
  shape: shape,
  symbol: symbol,
  text: text,
  trail: trail
};

function boundItem (item, func, opt) {
  var type = Marks[item.mark.marktype],
    bound = func || type.bound;
  if (type.nested) item = item.mark;
  return bound(item.bounds || (item.bounds = new Bounds()), item, opt);
}

var DUMMY = {
  mark: null
};
function boundMark (mark, bounds, opt) {
  var type = Marks[mark.marktype],
    bound = type.bound,
    items = mark.items,
    hasItems = items && items.length,
    i,
    n,
    item,
    b;
  if (type.nested) {
    if (hasItems) {
      item = items[0];
    } else {
      // no items, fake it
      DUMMY.mark = mark;
      item = DUMMY;
    }
    b = boundItem(item, bound, opt);
    bounds = bounds && bounds.union(b) || b;
    return bounds;
  }
  bounds = bounds || mark.bounds && mark.bounds.clear() || new Bounds();
  if (hasItems) {
    for (i = 0, n = items.length; i < n; ++i) {
      bounds.union(boundItem(items[i], bound, opt));
    }
  }
  return mark.bounds = bounds;
}

const keys = ['marktype', 'name', 'role', 'interactive', 'clip', 'items', 'zindex', 'x', 'y', 'width', 'height', 'align', 'baseline',
// layout
'fill', 'fillOpacity', 'opacity', 'blend',
// fill
'stroke', 'strokeOpacity', 'strokeWidth', 'strokeCap',
// stroke
'strokeDash', 'strokeDashOffset',
// stroke dash
'strokeForeground', 'strokeOffset',
// group
'startAngle', 'endAngle', 'innerRadius', 'outerRadius',
// arc
'cornerRadius', 'padAngle',
// arc, rect
'cornerRadiusTopLeft', 'cornerRadiusTopRight',
// rect, group
'cornerRadiusBottomLeft', 'cornerRadiusBottomRight', 'interpolate', 'tension', 'orient', 'defined',
// area, line
'url', 'aspect', 'smooth',
// image
'path', 'scaleX', 'scaleY',
// path
'x2', 'y2',
// rule
'size', 'shape',
// symbol
'text', 'angle', 'theta', 'radius', 'dir', 'dx', 'dy',
// text
'ellipsis', 'limit', 'lineBreak', 'lineHeight', 'font', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant',
// font
'description', 'aria', 'ariaRole', 'ariaRoleDescription' // aria
];

function sceneToJSON(scene, indent) {
  return JSON.stringify(scene, keys, indent);
}
function sceneFromJSON(json) {
  const scene = typeof json === 'string' ? JSON.parse(json) : json;
  return initialize(scene);
}
function initialize(scene) {
  var type = scene.marktype,
    items = scene.items,
    parent,
    i,
    n;
  if (items) {
    for (i = 0, n = items.length; i < n; ++i) {
      parent = type ? 'mark' : 'group';
      items[i][parent] = scene;
      if (items[i].zindex) items[i][parent].zdirty = true;
      if ('group' === (type || parent)) initialize(items[i]);
    }
  }
  if (type) boundMark(scene);
  return scene;
}

function Scenegraph(scene) {
  if (arguments.length) {
    this.root = sceneFromJSON(scene);
  } else {
    this.root = createMark({
      marktype: 'group',
      name: 'root',
      role: 'frame'
    });
    this.root.items = [new GroupItem(this.root)];
  }
}
Scenegraph.prototype = {
  toJSON(indent) {
    return sceneToJSON(this.root, indent || 0);
  },
  mark(markdef, group, index) {
    group = group || this.root.items[0];
    const mark = createMark(markdef, group);
    group.items[index] = mark;
    if (mark.zindex) mark.group.zdirty = true;
    return mark;
  }
};
function createMark(def, group) {
  const mark = {
    bounds: new Bounds(),
    clip: !!def.clip,
    group: group,
    interactive: def.interactive === false ? false : true,
    items: [],
    marktype: def.marktype,
    name: def.name || undefined,
    role: def.role || undefined,
    zindex: def.zindex || 0
  };

  // add accessibility properties if defined
  if (def.aria != null) {
    mark.aria = def.aria;
  }
  if (def.description) {
    mark.description = def.description;
  }
  return mark;
}

// create a new DOM element
function domCreate(doc, tag, ns) {
  if (!doc && typeof document !== 'undefined' && document.createElement) {
    doc = document;
  }
  return doc ? ns ? doc.createElementNS(ns, tag) : doc.createElement(tag) : null;
}

// find first child element with matching tag
function domFind(el, tag) {
  tag = tag.toLowerCase();
  var nodes = el.childNodes,
    i = 0,
    n = nodes.length;
  for (; i < n; ++i) if (nodes[i].tagName.toLowerCase() === tag) {
    return nodes[i];
  }
}

// retrieve child element at given index
// create & insert if doesn't exist or if tags do not match
function domChild(el, index, tag, ns) {
  var a = el.childNodes[index],
    b;
  if (!a || a.tagName.toLowerCase() !== tag.toLowerCase()) {
    b = a || null;
    a = domCreate(el.ownerDocument, tag, ns);
    el.insertBefore(a, b);
  }
  return a;
}

// remove all child elements at or above the given index
function domClear(el, index) {
  var nodes = el.childNodes,
    curr = nodes.length;
  while (curr > index) el.removeChild(nodes[--curr]);
  return el;
}

// generate css class name for mark
function cssClass(mark) {
  return 'mark-' + mark.marktype + (mark.role ? ' role-' + mark.role : '') + (mark.name ? ' ' + mark.name : '');
}

function point (event, el) {
  const rect = el.getBoundingClientRect();
  return [event.clientX - rect.left - (el.clientLeft || 0), event.clientY - rect.top - (el.clientTop || 0)];
}

function resolveItem (item, event, el, origin) {
  var mark = item && item.mark,
    mdef,
    p;
  if (mark && (mdef = Marks[mark.marktype]).tip) {
    p = point(event, el);
    p[0] -= origin[0];
    p[1] -= origin[1];
    while (item = item.mark.group) {
      p[0] -= item.x || 0;
      p[1] -= item.y || 0;
    }
    item = mdef.tip(mark.items, p);
  }
  return item;
}

/**
 * Create a new Handler instance.
 * @param {object} [customLoader] - Optional loader instance for
 *   href URL sanitization. If not specified, a standard loader
 *   instance will be generated.
 * @param {function} [customTooltip] - Optional tooltip handler
 *   function for custom tooltip display.
 * @constructor
 */
function Handler(customLoader, customTooltip) {
  this._active = null;
  this._handlers = {};
  this._loader = customLoader || loader();
  this._tooltip = customTooltip || defaultTooltip;
}

// The default tooltip display handler.
// Sets the HTML title attribute on the visualization container.
function defaultTooltip(handler, event, item, value) {
  handler.element().setAttribute('title', value || '');
}
Handler.prototype = {
  /**
   * Initialize a new Handler instance.
   * @param {DOMElement} el - The containing DOM element for the display.
   * @param {Array<number>} origin - The origin of the display, in pixels.
   *   The coordinate system will be translated to this point.
   * @param {object} [obj] - Optional context object that should serve as
   *   the "this" context for event callbacks.
   * @return {Handler} - This handler instance.
   */
  initialize(el, origin, obj) {
    this._el = el;
    this._obj = obj || null;
    return this.origin(origin);
  },
  /**
   * Returns the parent container element for a visualization.
   * @return {DOMElement} - The containing DOM element.
   */
  element() {
    return this._el;
  },
  /**
   * Returns the scene element (e.g., canvas or SVG) of the visualization
   * Subclasses must override if the first child is not the scene element.
   * @return {DOMElement} - The scene (e.g., canvas or SVG) element.
   */
  canvas() {
    return this._el && this._el.firstChild;
  },
  /**
   * Get / set the origin coordinates of the visualization.
   */
  origin(origin) {
    if (arguments.length) {
      this._origin = origin || [0, 0];
      return this;
    } else {
      return this._origin.slice();
    }
  },
  /**
   * Get / set the scenegraph root.
   */
  scene(scene) {
    if (!arguments.length) return this._scene;
    this._scene = scene;
    return this;
  },
  /**
   * Add an event handler. Subclasses should override this method.
   */
  on( /*type, handler*/) {},
  /**
   * Remove an event handler. Subclasses should override this method.
   */
  off( /*type, handler*/) {},
  /**
   * Utility method for finding the array index of an event handler.
   * @param {Array} h - An array of registered event handlers.
   * @param {string} type - The event type.
   * @param {function} handler - The event handler instance to find.
   * @return {number} - The handler's array index or -1 if not registered.
   */
  _handlerIndex(h, type, handler) {
    for (let i = h ? h.length : 0; --i >= 0;) {
      if (h[i].type === type && (!handler || h[i].handler === handler)) {
        return i;
      }
    }
    return -1;
  },
  /**
   * Returns an array with registered event handlers.
   * @param {string} [type] - The event type to query. Any annotations
   *   are ignored; for example, for the argument "click.foo", ".foo" will
   *   be ignored and the method returns all "click" handlers. If type is
   *   null or unspecified, this method returns handlers for all types.
   * @return {Array} - A new array containing all registered event handlers.
   */
  handlers(type) {
    const h = this._handlers,
      a = [];
    if (type) {
      a.push(...h[this.eventName(type)]);
    } else {
      for (const k in h) {
        a.push(...h[k]);
      }
    }
    return a;
  },
  /**
   * Parses an event name string to return the specific event type.
   * For example, given "click.foo" returns "click"
   * @param {string} name - The input event type string.
   * @return {string} - A string with the event type only.
   */
  eventName(name) {
    const i = name.indexOf('.');
    return i < 0 ? name : name.slice(0, i);
  },
  /**
   * Handle hyperlink navigation in response to an item.href value.
   * @param {Event} event - The event triggering hyperlink navigation.
   * @param {Item} item - The scenegraph item.
   * @param {string} href - The URL to navigate to.
   */
  handleHref(event, item, href) {
    this._loader.sanitize(href, {
      context: 'href'
    }).then(opt => {
      const e = new MouseEvent(event.type, event),
        a = domCreate(null, 'a');
      for (const name in opt) a.setAttribute(name, opt[name]);
      a.dispatchEvent(e);
    }).catch(() => {/* do nothing */});
  },
  /**
   * Handle tooltip display in response to an item.tooltip value.
   * @param {Event} event - The event triggering tooltip display.
   * @param {Item} item - The scenegraph item.
   * @param {boolean} show - A boolean flag indicating whether
   *   to show or hide a tooltip for the given item.
   */
  handleTooltip(event, item, show) {
    if (item && item.tooltip != null) {
      item = resolveItem(item, event, this.canvas(), this._origin);
      const value = show && item && item.tooltip || null;
      this._tooltip.call(this._obj, this, event, item, value);
    }
  },
  /**
   * Returns the size of a scenegraph item and its position relative
   * to the viewport.
   * @param {Item} item - The scenegraph item.
   * @return {object} - A bounding box object (compatible with the
   *   DOMRect type) consisting of x, y, width, heigh, top, left,
   *   right, and bottom properties.
   */
  getItemBoundingClientRect(item) {
    const el = this.canvas();
    if (!el) return;
    const rect = el.getBoundingClientRect(),
      origin = this._origin,
      bounds = item.bounds,
      width = bounds.width(),
      height = bounds.height();
    let x = bounds.x1 + origin[0] + rect.left,
      y = bounds.y1 + origin[1] + rect.top;

    // translate coordinate for each parent group
    while (item.mark && (item = item.mark.group)) {
      x += item.x || 0;
      y += item.y || 0;
    }

    // return DOMRect-compatible bounding box
    return {
      x,
      y,
      width,
      height,
      left: x,
      top: y,
      right: x + width,
      bottom: y + height
    };
  }
};

/**
 * Create a new Renderer instance.
 * @param {object} [loader] - Optional loader instance for
 *   image and href URL sanitization. If not specified, a
 *   standard loader instance will be generated.
 * @constructor
 */
function Renderer(loader) {
  this._el = null;
  this._bgcolor = null;
  this._loader = new ResourceLoader(loader);
}
Renderer.prototype = {
  /**
   * Initialize a new Renderer instance.
   * @param {DOMElement} el - The containing DOM element for the display.
   * @param {number} width - The coordinate width of the display, in pixels.
   * @param {number} height - The coordinate height of the display, in pixels.
   * @param {Array<number>} origin - The origin of the display, in pixels.
   *   The coordinate system will be translated to this point.
   * @param {number} [scaleFactor=1] - Optional scaleFactor by which to multiply
   *   the width and height to determine the final pixel size.
   * @return {Renderer} - This renderer instance.
   */
  initialize(el, width, height, origin, scaleFactor) {
    this._el = el;
    return this.resize(width, height, origin, scaleFactor);
  },
  /**
   * Returns the parent container element for a visualization.
   * @return {DOMElement} - The containing DOM element.
   */
  element() {
    return this._el;
  },
  /**
   * Returns the scene element (e.g., canvas or SVG) of the visualization
   * Subclasses must override if the first child is not the scene element.
   * @return {DOMElement} - The scene (e.g., canvas or SVG) element.
   */
  canvas() {
    return this._el && this._el.firstChild;
  },
  /**
   * Get / set the background color.
   */
  background(bgcolor) {
    if (arguments.length === 0) return this._bgcolor;
    this._bgcolor = bgcolor;
    return this;
  },
  /**
   * Resize the display.
   * @param {number} width - The new coordinate width of the display, in pixels.
   * @param {number} height - The new coordinate height of the display, in pixels.
   * @param {Array<number>} origin - The new origin of the display, in pixels.
   *   The coordinate system will be translated to this point.
   * @param {number} [scaleFactor=1] - Optional scaleFactor by which to multiply
   *   the width and height to determine the final pixel size.
   * @return {Renderer} - This renderer instance;
   */
  resize(width, height, origin, scaleFactor) {
    this._width = width;
    this._height = height;
    this._origin = origin || [0, 0];
    this._scale = scaleFactor || 1;
    return this;
  },
  /**
   * Report a dirty item whose bounds should be redrawn.
   * This base class method does nothing. Subclasses that perform
   * incremental should implement this method.
   * @param {Item} item - The dirty item whose bounds should be redrawn.
   */
  dirty( /*item*/) {},
  /**
   * Render an input scenegraph, potentially with a set of dirty items.
   * This method will perform an immediate rendering with available resources.
   * The renderer may also need to perform image loading to perform a complete
   * render. This process can lead to asynchronous re-rendering of the scene
   * after this method returns. To receive notification when rendering is
   * complete, use the renderAsync method instead.
   * @param {object} scene - The root mark of a scenegraph to render.
   * @return {Renderer} - This renderer instance.
   */
  render(scene) {
    const r = this;

    // bind arguments into a render call, and cache it
    // this function may be subsequently called for async redraw
    r._call = function () {
      r._render(scene);
    };

    // invoke the renderer
    r._call();

    // clear the cached call for garbage collection
    // async redraws will stash their own copy
    r._call = null;
    return r;
  },
  /**
   * Internal rendering method. Renderer subclasses should override this
   * method to actually perform rendering.
   * @param {object} scene - The root mark of a scenegraph to render.
   */
  _render( /*scene*/
  ) {
    // subclasses to override
  },
  /**
   * Asynchronous rendering method. Similar to render, but returns a Promise
   * that resolves when all rendering is completed. Sometimes a renderer must
   * perform image loading to get a complete rendering. The returned
   * Promise will not resolve until this process completes.
   * @param {object} scene - The root mark of a scenegraph to render.
   * @return {Promise} - A Promise that resolves when rendering is complete.
   */
  renderAsync(scene) {
    const r = this.render(scene);
    return this._ready ? this._ready.then(() => r) : Promise.resolve(r);
  },
  /**
   * Internal method for asynchronous resource loading.
   * Proxies method calls to the ImageLoader, and tracks loading
   * progress to invoke a re-render once complete.
   * @param {string} method - The method name to invoke on the ImageLoader.
   * @param {string} uri - The URI for the requested resource.
   * @return {Promise} - A Promise that resolves to the requested resource.
   */
  _load(method, uri) {
    var r = this,
      p = r._loader[method](uri);
    if (!r._ready) {
      // re-render the scene when loading completes
      const call = r._call;
      r._ready = r._loader.ready().then(redraw => {
        if (redraw) call();
        r._ready = null;
      });
    }
    return p;
  },
  /**
   * Sanitize a URL to include as a hyperlink in the rendered scene.
   * This method proxies a call to ImageLoader.sanitizeURL, but also tracks
   * image loading progress and invokes a re-render once complete.
   * @param {string} uri - The URI string to sanitize.
   * @return {Promise} - A Promise that resolves to the sanitized URL.
   */
  sanitizeURL(uri) {
    return this._load('sanitizeURL', uri);
  },
  /**
   * Requests an image to include in the rendered scene.
   * This method proxies a call to ImageLoader.loadImage, but also tracks
   * image loading progress and invokes a re-render once complete.
   * @param {string} uri - The URI string of the image.
   * @return {Promise} - A Promise that resolves to the loaded Image.
   */
  loadImage(uri) {
    return this._load('loadImage', uri);
  }
};

const KeyDownEvent = 'keydown';
const KeyPressEvent = 'keypress';
const KeyUpEvent = 'keyup';
const DragEnterEvent = 'dragenter';
const DragLeaveEvent = 'dragleave';
const DragOverEvent = 'dragover';
const MouseDownEvent = 'mousedown';
const MouseUpEvent = 'mouseup';
const MouseMoveEvent = 'mousemove';
const MouseOutEvent = 'mouseout';
const MouseOverEvent = 'mouseover';
const ClickEvent = 'click';
const DoubleClickEvent = 'dblclick';
const WheelEvent = 'wheel';
const MouseWheelEvent = 'mousewheel';
const TouchStartEvent = 'touchstart';
const TouchMoveEvent = 'touchmove';
const TouchEndEvent = 'touchend';
const Events = [KeyDownEvent, KeyPressEvent, KeyUpEvent, DragEnterEvent, DragLeaveEvent, DragOverEvent, MouseDownEvent, MouseUpEvent, MouseMoveEvent, MouseOutEvent, MouseOverEvent, ClickEvent, DoubleClickEvent, WheelEvent, MouseWheelEvent, TouchStartEvent, TouchMoveEvent, TouchEndEvent];
const TooltipShowEvent = MouseMoveEvent;
const TooltipHideEvent = MouseOutEvent;
const HrefEvent = ClickEvent;

function CanvasHandler(loader, tooltip) {
  Handler.call(this, loader, tooltip);
  this._down = null;
  this._touch = null;
  this._first = true;
  this._events = {};
}
const eventBundle = type => type === TouchStartEvent || type === TouchMoveEvent || type === TouchEndEvent ? [TouchStartEvent, TouchMoveEvent, TouchEndEvent] : [type];

// lazily add listeners to the canvas as needed
function eventListenerCheck(handler, type) {
  eventBundle(type).forEach(_ => addEventListener(handler, _));
}
function addEventListener(handler, type) {
  const canvas = handler.canvas();
  if (canvas && !handler._events[type]) {
    handler._events[type] = 1;
    canvas.addEventListener(type, handler[type] ? evt => handler[type](evt) : evt => handler.fire(type, evt));
  }
}
function move(moveEvent, overEvent, outEvent) {
  return function (evt) {
    const a = this._active,
      p = this.pickEvent(evt);
    if (p === a) {
      // active item and picked item are the same
      this.fire(moveEvent, evt); // fire move
    } else {
      // active item and picked item are different
      if (!a || !a.exit) {
        // fire out for prior active item
        // suppress if active item was removed from scene
        this.fire(outEvent, evt);
      }
      this._active = p; // set new active item
      this.fire(overEvent, evt); // fire over for new active item
      this.fire(moveEvent, evt); // fire move for new active item
    }
  };
}

function inactive(type) {
  return function (evt) {
    this.fire(type, evt);
    this._active = null;
  };
}
inherits(CanvasHandler, Handler, {
  initialize(el, origin, obj) {
    this._canvas = el && domFind(el, 'canvas');

    // add minimal events required for proper state management
    [ClickEvent, MouseDownEvent, MouseMoveEvent, MouseOutEvent, DragLeaveEvent].forEach(type => eventListenerCheck(this, type));
    return Handler.prototype.initialize.call(this, el, origin, obj);
  },
  // return the backing canvas instance
  canvas() {
    return this._canvas;
  },
  // retrieve the current canvas context
  context() {
    return this._canvas.getContext('2d');
  },
  // supported events
  events: Events,
  // to keep old versions of firefox happy
  DOMMouseScroll(evt) {
    this.fire(MouseWheelEvent, evt);
  },
  mousemove: move(MouseMoveEvent, MouseOverEvent, MouseOutEvent),
  dragover: move(DragOverEvent, DragEnterEvent, DragLeaveEvent),
  mouseout: inactive(MouseOutEvent),
  dragleave: inactive(DragLeaveEvent),
  mousedown(evt) {
    this._down = this._active;
    this.fire(MouseDownEvent, evt);
  },
  click(evt) {
    if (this._down === this._active) {
      this.fire(ClickEvent, evt);
      this._down = null;
    }
  },
  touchstart(evt) {
    this._touch = this.pickEvent(evt.changedTouches[0]);
    if (this._first) {
      this._active = this._touch;
      this._first = false;
    }
    this.fire(TouchStartEvent, evt, true);
  },
  touchmove(evt) {
    this.fire(TouchMoveEvent, evt, true);
  },
  touchend(evt) {
    this.fire(TouchEndEvent, evt, true);
    this._touch = null;
  },
  // fire an event
  fire(type, evt, touch) {
    const a = touch ? this._touch : this._active,
      h = this._handlers[type];

    // set event type relative to scenegraph items
    evt.vegaType = type;

    // handle hyperlinks and tooltips first
    if (type === HrefEvent && a && a.href) {
      this.handleHref(evt, a, a.href);
    } else if (type === TooltipShowEvent || type === TooltipHideEvent) {
      this.handleTooltip(evt, a, type !== TooltipHideEvent);
    }

    // invoke all registered handlers
    if (h) {
      for (let i = 0, len = h.length; i < len; ++i) {
        h[i].handler.call(this._obj, evt, a);
      }
    }
  },
  // add an event handler
  on(type, handler) {
    const name = this.eventName(type),
      h = this._handlers,
      i = this._handlerIndex(h[name], type, handler);
    if (i < 0) {
      eventListenerCheck(this, type);
      (h[name] || (h[name] = [])).push({
        type: type,
        handler: handler
      });
    }
    return this;
  },
  // remove an event handler
  off(type, handler) {
    const name = this.eventName(type),
      h = this._handlers[name],
      i = this._handlerIndex(h, type, handler);
    if (i >= 0) {
      h.splice(i, 1);
    }
    return this;
  },
  pickEvent(evt) {
    const p = point(evt, this._canvas),
      o = this._origin;
    return this.pick(this._scene, p[0], p[1], p[0] - o[0], p[1] - o[1]);
  },
  // find the scenegraph item at the current mouse position
  // x, y -- the absolute x, y mouse coordinates on the canvas element
  // gx, gy -- the relative coordinates within the current group
  pick(scene, x, y, gx, gy) {
    const g = this.context(),
      mark = Marks[scene.marktype];
    return mark.pick.call(this, g, scene, x, y, gx, gy);
  }
});

function devicePixelRatio() {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}
var pixelRatio = devicePixelRatio();
function resize (canvas, width, height, origin, scaleFactor, opt) {
  const inDOM = typeof HTMLElement !== 'undefined' && canvas instanceof HTMLElement && canvas.parentNode != null,
    context = canvas.getContext('2d'),
    ratio = inDOM ? pixelRatio : scaleFactor;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  for (const key in opt) {
    context[key] = opt[key];
  }
  if (inDOM && ratio !== 1) {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }
  context.pixelRatio = ratio;
  context.setTransform(ratio, 0, 0, ratio, ratio * origin[0], ratio * origin[1]);
  return canvas;
}

function CanvasRenderer(loader) {
  Renderer.call(this, loader);
  this._options = {};
  this._redraw = false;
  this._dirty = new Bounds();
  this._tempb = new Bounds();
}
const base$1 = Renderer.prototype;
const viewBounds = (origin, width, height) => new Bounds().set(0, 0, width, height).translate(-origin[0], -origin[1]);
function clipToBounds(g, b, origin) {
  // expand bounds by 1 pixel, then round to pixel boundaries
  b.expand(1).round();

  // align to base pixel grid in case of non-integer scaling (#2425)
  if (g.pixelRatio % 1) {
    b.scale(g.pixelRatio).round().scale(1 / g.pixelRatio);
  }

  // to avoid artifacts translate if origin has fractional pixels
  b.translate(-(origin[0] % 1), -(origin[1] % 1));

  // set clip path
  g.beginPath();
  g.rect(b.x1, b.y1, b.width(), b.height());
  g.clip();
  return b;
}
inherits(CanvasRenderer, Renderer, {
  initialize(el, width, height, origin, scaleFactor, options) {
    this._options = options || {};
    this._canvas = this._options.externalContext ? null : canvas(1, 1, this._options.type); // instantiate a small canvas

    if (el && this._canvas) {
      domClear(el, 0).appendChild(this._canvas);
      this._canvas.setAttribute('class', 'marks');
    }

    // this method will invoke resize to size the canvas appropriately
    return base$1.initialize.call(this, el, width, height, origin, scaleFactor);
  },
  resize(width, height, origin, scaleFactor) {
    base$1.resize.call(this, width, height, origin, scaleFactor);
    if (this._canvas) {
      // configure canvas size and transform
      resize(this._canvas, this._width, this._height, this._origin, this._scale, this._options.context);
    } else {
      // external context needs to be scaled and positioned to origin
      const ctx = this._options.externalContext;
      if (!ctx) error('CanvasRenderer is missing a valid canvas or context');
      ctx.scale(this._scale, this._scale);
      ctx.translate(this._origin[0], this._origin[1]);
    }
    this._redraw = true;
    return this;
  },
  canvas() {
    return this._canvas;
  },
  context() {
    return this._options.externalContext || (this._canvas ? this._canvas.getContext('2d') : null);
  },
  dirty(item) {
    const b = this._tempb.clear().union(item.bounds);
    let g = item.mark.group;
    while (g) {
      b.translate(g.x || 0, g.y || 0);
      g = g.mark.group;
    }
    this._dirty.union(b);
  },
  _render(scene) {
    const g = this.context(),
      o = this._origin,
      w = this._width,
      h = this._height,
      db = this._dirty,
      vb = viewBounds(o, w, h);

    // setup
    g.save();
    const b = this._redraw || db.empty() ? (this._redraw = false, vb.expand(1)) : clipToBounds(g, vb.intersect(db), o);
    this.clear(-o[0], -o[1], w, h);

    // render
    this.draw(g, scene, b);

    // takedown
    g.restore();
    db.clear();
    return this;
  },
  draw(ctx, scene, bounds) {
    const mark = Marks[scene.marktype];
    if (scene.clip) clip(ctx, scene);
    mark.draw.call(this, ctx, scene, bounds);
    if (scene.clip) ctx.restore();
  },
  clear(x, y, w, h) {
    const opt = this._options,
      g = this.context();
    if (opt.type !== 'pdf' && !opt.externalContext) {
      // calling clear rect voids vector output in pdf mode
      // and could remove external context content (#2615)
      g.clearRect(x, y, w, h);
    }
    if (this._bgcolor != null) {
      g.fillStyle = this._bgcolor;
      g.fillRect(x, y, w, h);
    }
  }
});

function SVGHandler(loader, tooltip) {
  Handler.call(this, loader, tooltip);
  const h = this;
  h._hrefHandler = listener(h, (evt, item) => {
    if (item && item.href) h.handleHref(evt, item, item.href);
  });
  h._tooltipHandler = listener(h, (evt, item) => {
    h.handleTooltip(evt, item, evt.type !== TooltipHideEvent);
  });
}

// wrap an event listener for the SVG DOM
const listener = (context, handler) => evt => {
  let item = evt.target.__data__;
  item = Array.isArray(item) ? item[0] : item;
  evt.vegaType = evt.type;
  handler.call(context._obj, evt, item);
};
inherits(SVGHandler, Handler, {
  initialize(el, origin, obj) {
    let svg = this._svg;
    if (svg) {
      svg.removeEventListener(HrefEvent, this._hrefHandler);
      svg.removeEventListener(TooltipShowEvent, this._tooltipHandler);
      svg.removeEventListener(TooltipHideEvent, this._tooltipHandler);
    }
    this._svg = svg = el && domFind(el, 'svg');
    if (svg) {
      svg.addEventListener(HrefEvent, this._hrefHandler);
      svg.addEventListener(TooltipShowEvent, this._tooltipHandler);
      svg.addEventListener(TooltipHideEvent, this._tooltipHandler);
    }
    return Handler.prototype.initialize.call(this, el, origin, obj);
  },
  canvas() {
    return this._svg;
  },
  // add an event handler
  on(type, handler) {
    const name = this.eventName(type),
      h = this._handlers,
      i = this._handlerIndex(h[name], type, handler);
    if (i < 0) {
      const x = {
        type,
        handler,
        listener: listener(this, handler)
      };
      (h[name] || (h[name] = [])).push(x);
      if (this._svg) {
        this._svg.addEventListener(name, x.listener);
      }
    }
    return this;
  },
  // remove an event handler
  off(type, handler) {
    const name = this.eventName(type),
      h = this._handlers[name],
      i = this._handlerIndex(h, type, handler);
    if (i >= 0) {
      if (this._svg) {
        this._svg.removeEventListener(name, h[i].listener);
      }
      h.splice(i, 1);
    }
    return this;
  }
});

const ARIA_HIDDEN = 'aria-hidden';
const ARIA_LABEL = 'aria-label';
const ARIA_ROLE = 'role';
const ARIA_ROLEDESCRIPTION = 'aria-roledescription';
const GRAPHICS_OBJECT = 'graphics-object';
const GRAPHICS_SYMBOL = 'graphics-symbol';
const bundle = (role, roledesc, label) => ({
  [ARIA_ROLE]: role,
  [ARIA_ROLEDESCRIPTION]: roledesc,
  [ARIA_LABEL]: label || undefined
});

// these roles are covered by related roles
// we can ignore them, no need to generate attributes
const AriaIgnore = toSet(['axis-domain', 'axis-grid', 'axis-label', 'axis-tick', 'axis-title', 'legend-band', 'legend-entry', 'legend-gradient', 'legend-label', 'legend-title', 'legend-symbol', 'title']);

// aria attribute generators for guide roles
const AriaGuides = {
  'axis': {
    desc: 'axis',
    caption: axisCaption
  },
  'legend': {
    desc: 'legend',
    caption: legendCaption
  },
  'title-text': {
    desc: 'title',
    caption: item => `Title text '${titleCaption(item)}'`
  },
  'title-subtitle': {
    desc: 'subtitle',
    caption: item => `Subtitle text '${titleCaption(item)}'`
  }
};

// aria properties generated for mark item encoding channels
const AriaEncode = {
  ariaRole: ARIA_ROLE,
  ariaRoleDescription: ARIA_ROLEDESCRIPTION,
  description: ARIA_LABEL
};
function ariaItemAttributes(emit, item) {
  const hide = item.aria === false;
  emit(ARIA_HIDDEN, hide || undefined);
  if (hide || item.description == null) {
    for (const prop in AriaEncode) {
      emit(AriaEncode[prop], undefined);
    }
  } else {
    const type = item.mark.marktype;
    emit(ARIA_LABEL, item.description);
    emit(ARIA_ROLE, item.ariaRole || (type === 'group' ? GRAPHICS_OBJECT : GRAPHICS_SYMBOL));
    emit(ARIA_ROLEDESCRIPTION, item.ariaRoleDescription || `${type} mark`);
  }
}
function ariaMarkAttributes(mark) {
  return mark.aria === false ? {
    [ARIA_HIDDEN]: true
  } : AriaIgnore[mark.role] ? null : AriaGuides[mark.role] ? ariaGuide(mark, AriaGuides[mark.role]) : ariaMark(mark);
}
function ariaMark(mark) {
  const type = mark.marktype;
  const recurse = type === 'group' || type === 'text' || mark.items.some(_ => _.description != null && _.aria !== false);
  return bundle(recurse ? GRAPHICS_OBJECT : GRAPHICS_SYMBOL, `${type} mark container`, mark.description);
}
function ariaGuide(mark, opt) {
  try {
    const item = mark.items[0],
      caption = opt.caption || (() => '');
    return bundle(opt.role || GRAPHICS_SYMBOL, opt.desc, item.description || caption(item));
  } catch (err) {
    return null;
  }
}
function titleCaption(item) {
  return array(item.text).join(' ');
}
function axisCaption(item) {
  const datum = item.datum,
    orient = item.orient,
    title = datum.title ? extractTitle(item) : null,
    ctx = item.context,
    scale = ctx.scales[datum.scale].value,
    locale = ctx.dataflow.locale(),
    type = scale.type,
    xy = orient === 'left' || orient === 'right' ? 'Y' : 'X';
  return `${xy}-axis` + (title ? ` titled '${title}'` : '') + ` for a ${isDiscrete(type) ? 'discrete' : type} scale` + ` with ${domainCaption(locale, scale, item)}`;
}
function legendCaption(item) {
  const datum = item.datum,
    title = datum.title ? extractTitle(item) : null,
    type = `${datum.type || ''} legend`.trim(),
    scales = datum.scales,
    props = Object.keys(scales),
    ctx = item.context,
    scale = ctx.scales[scales[props[0]]].value,
    locale = ctx.dataflow.locale();
  return capitalize(type) + (title ? ` titled '${title}'` : '') + ` for ${channelCaption(props)}` + ` with ${domainCaption(locale, scale, item)}`;
}
function extractTitle(item) {
  try {
    return array(peek(item.items).items[0].text).join(' ');
  } catch (err) {
    return null;
  }
}
function channelCaption(props) {
  props = props.map(p => p + (p === 'fill' || p === 'stroke' ? ' color' : ''));
  return props.length < 2 ? props[0] : props.slice(0, -1).join(', ') + ' and ' + peek(props);
}
function capitalize(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

const innerText = val => (val + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attrText = val => innerText(val).replace(/"/g, '&quot;').replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');
function markup() {
  let buf = '',
    outer = '',
    inner = '';
  const stack = [],
    clear = () => outer = inner = '',
    push = tag => {
      if (outer) {
        buf += `${outer}>${inner}`;
        clear();
      }
      stack.push(tag);
    },
    attr = (name, value) => {
      if (value != null) outer += ` ${name}="${attrText(value)}"`;
      return m;
    },
    m = {
      open(tag) {
        push(tag);
        outer = '<' + tag;
        for (var _len = arguments.length, attrs = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          attrs[_key - 1] = arguments[_key];
        }
        for (const set of attrs) {
          for (const key in set) attr(key, set[key]);
        }
        return m;
      },
      close() {
        const tag = stack.pop();
        if (outer) {
          buf += outer + (inner ? `>${inner}</${tag}>` : '/>');
        } else {
          buf += `</${tag}>`;
        }
        clear();
        return m;
      },
      attr,
      text: t => (inner += innerText(t), m),
      toString: () => buf
    };
  return m;
}
const serializeXML = node => _serialize(markup(), node) + '';
function _serialize(m, node) {
  m.open(node.tagName);
  if (node.hasAttributes()) {
    const attrs = node.attributes,
      n = attrs.length;
    for (let i = 0; i < n; ++i) {
      m.attr(attrs[i].name, attrs[i].value);
    }
  }
  if (node.hasChildNodes()) {
    const children = node.childNodes;
    for (const child of children) {
      child.nodeType === 3 // text node
      ? m.text(child.nodeValue) : _serialize(m, child);
    }
  }
  return m.close();
}

const stylesAttr = {
  fill: 'fill',
  fillOpacity: 'fill-opacity',
  stroke: 'stroke',
  strokeOpacity: 'stroke-opacity',
  strokeWidth: 'stroke-width',
  strokeCap: 'stroke-linecap',
  strokeJoin: 'stroke-linejoin',
  strokeDash: 'stroke-dasharray',
  strokeDashOffset: 'stroke-dashoffset',
  strokeMiterLimit: 'stroke-miterlimit',
  opacity: 'opacity'
};
const stylesCss = {
  blend: 'mix-blend-mode'
};

// ensure miter limit default is consistent with canvas (#2498)
const rootAttributes = {
  'fill': 'none',
  'stroke-miterlimit': 10
};

const RootIndex = 0,
  xmlns = 'http://www.w3.org/2000/xmlns/',
  svgns = metadata.xmlns;
function SVGRenderer(loader) {
  Renderer.call(this, loader);
  this._dirtyID = 0;
  this._dirty = [];
  this._svg = null;
  this._root = null;
  this._defs = null;
}
const base = Renderer.prototype;
inherits(SVGRenderer, Renderer, {
  /**
   * Initialize a new SVGRenderer instance.
   * @param {DOMElement} el - The containing DOM element for the display.
   * @param {number} width - The coordinate width of the display, in pixels.
   * @param {number} height - The coordinate height of the display, in pixels.
   * @param {Array<number>} origin - The origin of the display, in pixels.
   *   The coordinate system will be translated to this point.
   * @param {number} [scaleFactor=1] - Optional scaleFactor by which to multiply
   *   the width and height to determine the final pixel size.
   * @return {SVGRenderer} - This renderer instance.
   */
  initialize(el, width, height, origin, scaleFactor) {
    // create the svg definitions cache
    this._defs = {};
    this._clearDefs();
    if (el) {
      this._svg = domChild(el, 0, 'svg', svgns);
      this._svg.setAttributeNS(xmlns, 'xmlns', svgns);
      this._svg.setAttributeNS(xmlns, 'xmlns:xlink', metadata['xmlns:xlink']);
      this._svg.setAttribute('version', metadata['version']);
      this._svg.setAttribute('class', 'marks');
      domClear(el, 1);

      // set the svg root group
      this._root = domChild(this._svg, RootIndex, 'g', svgns);
      setAttributes(this._root, rootAttributes);

      // ensure no additional child elements
      domClear(this._svg, RootIndex + 1);
    }

    // set background color if defined
    this.background(this._bgcolor);
    return base.initialize.call(this, el, width, height, origin, scaleFactor);
  },
  /**
   * Get / set the background color.
   */
  background(bgcolor) {
    if (arguments.length && this._svg) {
      this._svg.style.setProperty('background-color', bgcolor);
    }
    return base.background.apply(this, arguments);
  },
  /**
   * Resize the display.
   * @param {number} width - The new coordinate width of the display, in pixels.
   * @param {number} height - The new coordinate height of the display, in pixels.
   * @param {Array<number>} origin - The new origin of the display, in pixels.
   *   The coordinate system will be translated to this point.
   * @param {number} [scaleFactor=1] - Optional scaleFactor by which to multiply
   *   the width and height to determine the final pixel size.
   * @return {SVGRenderer} - This renderer instance;
   */
  resize(width, height, origin, scaleFactor) {
    base.resize.call(this, width, height, origin, scaleFactor);
    if (this._svg) {
      setAttributes(this._svg, {
        width: this._width * this._scale,
        height: this._height * this._scale,
        viewBox: `0 0 ${this._width} ${this._height}`
      });
      this._root.setAttribute('transform', `translate(${this._origin})`);
    }
    this._dirty = [];
    return this;
  },
  /**
   * Returns the SVG element of the visualization.
   * @return {DOMElement} - The SVG element.
   */
  canvas() {
    return this._svg;
  },
  /**
   * Returns an SVG text string for the rendered content,
   * or null if this renderer is currently headless.
   */
  svg() {
    const svg = this._svg,
      bg = this._bgcolor;
    if (!svg) return null;
    let node;
    if (bg) {
      svg.removeAttribute('style');
      node = domChild(svg, RootIndex, 'rect', svgns);
      setAttributes(node, {
        width: this._width,
        height: this._height,
        fill: bg
      });
    }
    const text = serializeXML(svg);
    if (bg) {
      svg.removeChild(node);
      this._svg.style.setProperty('background-color', bg);
    }
    return text;
  },
  /**
   * Internal rendering method.
   * @param {object} scene - The root mark of a scenegraph to render.
   */
  _render(scene) {
    // perform spot updates and re-render markup
    if (this._dirtyCheck()) {
      if (this._dirtyAll) this._clearDefs();
      this.mark(this._root, scene);
      domClear(this._root, 1);
    }
    this.defs();
    this._dirty = [];
    ++this._dirtyID;
    return this;
  },
  // -- Manage rendering of items marked as dirty --

  /**
   * Flag a mark item as dirty.
   * @param {Item} item - The mark item.
   */
  dirty(item) {
    if (item.dirty !== this._dirtyID) {
      item.dirty = this._dirtyID;
      this._dirty.push(item);
    }
  },
  /**
   * Check if a mark item is considered dirty.
   * @param {Item} item - The mark item.
   */
  isDirty(item) {
    return this._dirtyAll || !item._svg || !item._svg.ownerSVGElement || item.dirty === this._dirtyID;
  },
  /**
   * Internal method to check dirty status and, if possible,
   * make targetted updates without a full rendering pass.
   */
  _dirtyCheck() {
    this._dirtyAll = true;
    const items = this._dirty;
    if (!items.length || !this._dirtyID) return true;
    const id = ++this._dirtyID;
    let item, mark, type, mdef, i, n, o;
    for (i = 0, n = items.length; i < n; ++i) {
      item = items[i];
      mark = item.mark;
      if (mark.marktype !== type) {
        // memoize mark instance lookup
        type = mark.marktype;
        mdef = Marks[type];
      }
      if (mark.zdirty && mark.dirty !== id) {
        this._dirtyAll = false;
        dirtyParents(item, id);
        mark.items.forEach(i => {
          i.dirty = id;
        });
      }
      if (mark.zdirty) continue; // handle in standard drawing pass

      if (item.exit) {
        // EXIT
        if (mdef.nested && mark.items.length) {
          // if nested mark with remaining points, update instead
          o = mark.items[0];
          if (o._svg) this._update(mdef, o._svg, o);
        } else if (item._svg) {
          // otherwise remove from DOM
          o = item._svg.parentNode;
          if (o) o.removeChild(item._svg);
        }
        item._svg = null;
        continue;
      }
      item = mdef.nested ? mark.items[0] : item;
      if (item._update === id) continue; // already visited

      if (!item._svg || !item._svg.ownerSVGElement) {
        // ENTER
        this._dirtyAll = false;
        dirtyParents(item, id);
      } else {
        // IN-PLACE UPDATE
        this._update(mdef, item._svg, item);
      }
      item._update = id;
    }
    return !this._dirtyAll;
  },
  // -- Construct & maintain scenegraph to SVG mapping ---

  /**
   * Render a set of mark items.
   * @param {SVGElement} el - The parent element in the SVG tree.
   * @param {object} scene - The mark parent to render.
   * @param {SVGElement} prev - The previous sibling in the SVG tree.
   */
  mark(el, scene, prev) {
    if (!this.isDirty(scene)) {
      return scene._svg;
    }
    const svg = this._svg,
      mdef = Marks[scene.marktype],
      events = scene.interactive === false ? 'none' : null,
      isGroup = mdef.tag === 'g';
    const parent = bind(scene, el, prev, 'g', svg);
    parent.setAttribute('class', cssClass(scene));

    // apply aria attributes to parent container element
    const aria = ariaMarkAttributes(scene);
    for (const key in aria) setAttribute(parent, key, aria[key]);
    if (!isGroup) {
      setAttribute(parent, 'pointer-events', events);
    }
    setAttribute(parent, 'clip-path', scene.clip ? clip$1(this, scene, scene.group) : null);
    let sibling = null,
      i = 0;
    const process = item => {
      const dirty = this.isDirty(item),
        node = bind(item, parent, sibling, mdef.tag, svg);
      if (dirty) {
        this._update(mdef, node, item);
        if (isGroup) recurse(this, node, item);
      }
      sibling = node;
      ++i;
    };
    if (mdef.nested) {
      if (scene.items.length) process(scene.items[0]);
    } else {
      visit(scene, process);
    }
    domClear(parent, i);
    return parent;
  },
  /**
   * Update the attributes of an SVG element for a mark item.
   * @param {object} mdef - The mark definition object
   * @param {SVGElement} el - The SVG element.
   * @param {Item} item - The mark item.
   */
  _update(mdef, el, item) {
    // set dom element and values cache
    // provides access to emit method
    element = el;
    values = el.__values__;

    // apply aria-specific properties
    ariaItemAttributes(emit, item);

    // apply svg attributes
    mdef.attr(emit, item, this);

    // some marks need special treatment
    const extra = mark_extras[mdef.type];
    if (extra) extra.call(this, mdef, el, item);

    // apply svg style attributes
    // note: element state may have been modified by 'extra' method
    if (element) this.style(element, item);
  },
  /**
   * Update the presentation attributes of an SVG element for a mark item.
   * @param {SVGElement} el - The SVG element.
   * @param {Item} item - The mark item.
   */
  style(el, item) {
    if (item == null) return;
    for (const prop in stylesAttr) {
      let value = prop === 'font' ? fontFamily(item) : item[prop];
      if (value === values[prop]) continue;
      const name = stylesAttr[prop];
      if (value == null) {
        el.removeAttribute(name);
      } else {
        if (isGradient(value)) {
          value = gradientRef(value, this._defs.gradient, href());
        }
        el.setAttribute(name, value + '');
      }
      values[prop] = value;
    }
    for (const prop in stylesCss) {
      setStyle(el, stylesCss[prop], item[prop]);
    }
  },
  /**
   * Render SVG defs, as needed.
   * Must be called *after* marks have been processed to ensure the
   * collected state is current and accurate.
   */
  defs() {
    const svg = this._svg,
      defs = this._defs;
    let el = defs.el,
      index = 0;
    for (const id in defs.gradient) {
      if (!el) defs.el = el = domChild(svg, RootIndex + 1, 'defs', svgns);
      index = updateGradient(el, defs.gradient[id], index);
    }
    for (const id in defs.clipping) {
      if (!el) defs.el = el = domChild(svg, RootIndex + 1, 'defs', svgns);
      index = updateClipping(el, defs.clipping[id], index);
    }

    // clean-up
    if (el) {
      index === 0 ? (svg.removeChild(el), defs.el = null) : domClear(el, index);
    }
  },
  /**
   * Clear defs caches.
   */
  _clearDefs() {
    const def = this._defs;
    def.gradient = {};
    def.clipping = {};
  }
});

// mark ancestor chain with a dirty id
function dirtyParents(item, id) {
  for (; item && item.dirty !== id; item = item.mark.group) {
    item.dirty = id;
    if (item.mark && item.mark.dirty !== id) {
      item.mark.dirty = id;
    } else return;
  }
}

// update gradient definitions
function updateGradient(el, grad, index) {
  let i, n, stop;
  if (grad.gradient === 'radial') {
    // SVG radial gradients automatically transform to normalized bbox
    // coordinates, in a way that is cumbersome to replicate in canvas.
    // We wrap the radial gradient in a pattern element, allowing us to
    // maintain a circular gradient that matches what canvas provides.
    let pt = domChild(el, index++, 'pattern', svgns);
    setAttributes(pt, {
      id: patternPrefix + grad.id,
      viewBox: '0,0,1,1',
      width: '100%',
      height: '100%',
      preserveAspectRatio: 'xMidYMid slice'
    });
    pt = domChild(pt, 0, 'rect', svgns);
    setAttributes(pt, {
      width: 1,
      height: 1,
      fill: `url(${href()}#${grad.id})`
    });
    el = domChild(el, index++, 'radialGradient', svgns);
    setAttributes(el, {
      id: grad.id,
      fx: grad.x1,
      fy: grad.y1,
      fr: grad.r1,
      cx: grad.x2,
      cy: grad.y2,
      r: grad.r2
    });
  } else {
    el = domChild(el, index++, 'linearGradient', svgns);
    setAttributes(el, {
      id: grad.id,
      x1: grad.x1,
      x2: grad.x2,
      y1: grad.y1,
      y2: grad.y2
    });
  }
  for (i = 0, n = grad.stops.length; i < n; ++i) {
    stop = domChild(el, i, 'stop', svgns);
    stop.setAttribute('offset', grad.stops[i].offset);
    stop.setAttribute('stop-color', grad.stops[i].color);
  }
  domClear(el, i);
  return index;
}

// update clipping path definitions
function updateClipping(el, clip, index) {
  let mask;
  el = domChild(el, index, 'clipPath', svgns);
  el.setAttribute('id', clip.id);
  if (clip.path) {
    mask = domChild(el, 0, 'path', svgns);
    mask.setAttribute('d', clip.path);
  } else {
    mask = domChild(el, 0, 'rect', svgns);
    setAttributes(mask, {
      x: 0,
      y: 0,
      width: clip.width,
      height: clip.height
    });
  }
  domClear(el, 1);
  return index + 1;
}

// Recursively process group contents.
function recurse(renderer, el, group) {
  // child 'g' element is second to last among children (path, g, path)
  // other children here are foreground and background path elements
  el = el.lastChild.previousSibling;
  let prev,
    idx = 0;
  visit(group, item => {
    prev = renderer.mark(el, item, prev);
    ++idx;
  });

  // remove any extraneous DOM elements
  domClear(el, 1 + idx);
}

// Bind a scenegraph item to an SVG DOM element.
// Create new SVG elements as needed.
function bind(item, el, sibling, tag, svg) {
  let node = item._svg,
    doc;

  // create a new dom node if needed
  if (!node) {
    doc = el.ownerDocument;
    node = domCreate(doc, tag, svgns);
    item._svg = node;
    if (item.mark) {
      node.__data__ = item;
      node.__values__ = {
        fill: 'default'
      };

      // if group, create background, content, and foreground elements
      if (tag === 'g') {
        const bg = domCreate(doc, 'path', svgns);
        node.appendChild(bg);
        bg.__data__ = item;
        const cg = domCreate(doc, 'g', svgns);
        node.appendChild(cg);
        cg.__data__ = item;
        const fg = domCreate(doc, 'path', svgns);
        node.appendChild(fg);
        fg.__data__ = item;
        fg.__values__ = {
          fill: 'default'
        };
      }
    }
  }

  // (re-)insert if (a) not contained in SVG or (b) sibling order has changed
  if (node.ownerSVGElement !== svg || siblingCheck(node, sibling)) {
    el.insertBefore(node, sibling ? sibling.nextSibling : el.firstChild);
  }
  return node;
}

// check if two nodes are ordered siblings
function siblingCheck(node, sibling) {
  return node.parentNode && node.parentNode.childNodes.length > 1 && node.previousSibling != sibling; // treat null/undefined the same
}

// -- Set attributes & styles on SVG elements ---

let element = null,
  // temp var for current SVG element
  values = null; // temp var for current values hash

// Extra configuration for certain mark types
const mark_extras = {
  group(mdef, el, item) {
    const fg = element = el.childNodes[2];
    values = fg.__values__;
    mdef.foreground(emit, item, this);
    values = el.__values__; // use parent's values hash
    element = el.childNodes[1];
    mdef.content(emit, item, this);
    const bg = element = el.childNodes[0];
    mdef.background(emit, item, this);
    const value = item.mark.interactive === false ? 'none' : null;
    if (value !== values.events) {
      setAttribute(fg, 'pointer-events', value);
      setAttribute(bg, 'pointer-events', value);
      values.events = value;
    }
    if (item.strokeForeground && item.stroke) {
      const fill = item.fill;
      setAttribute(fg, 'display', null);

      // set style of background
      this.style(bg, item);
      setAttribute(bg, 'stroke', null);

      // set style of foreground
      if (fill) item.fill = null;
      values = fg.__values__;
      this.style(fg, item);
      if (fill) item.fill = fill;

      // leave element null to prevent downstream styling
      element = null;
    } else {
      // ensure foreground is ignored
      setAttribute(fg, 'display', 'none');
    }
  },
  image(mdef, el, item) {
    if (item.smooth === false) {
      setStyle(el, 'image-rendering', 'optimizeSpeed');
      setStyle(el, 'image-rendering', 'pixelated');
    } else {
      setStyle(el, 'image-rendering', null);
    }
  },
  text(mdef, el, item) {
    const tl = textLines(item);
    let key, value, doc, lh;
    if (isArray(tl)) {
      // multi-line text
      value = tl.map(_ => textValue(item, _));
      key = value.join('\n'); // content cache key

      if (key !== values.text) {
        domClear(el, 0);
        doc = el.ownerDocument;
        lh = lineHeight(item);
        value.forEach((t, i) => {
          const ts = domCreate(doc, 'tspan', svgns);
          ts.__data__ = item; // data binding
          ts.textContent = t;
          if (i) {
            ts.setAttribute('x', 0);
            ts.setAttribute('dy', lh);
          }
          el.appendChild(ts);
        });
        values.text = key;
      }
    } else {
      // single-line text
      value = textValue(item, tl);
      if (value !== values.text) {
        el.textContent = value;
        values.text = value;
      }
    }
    setAttribute(el, 'font-family', fontFamily(item));
    setAttribute(el, 'font-size', fontSize(item) + 'px');
    setAttribute(el, 'font-style', item.fontStyle);
    setAttribute(el, 'font-variant', item.fontVariant);
    setAttribute(el, 'font-weight', item.fontWeight);
  }
};
function emit(name, value, ns) {
  // early exit if value is unchanged
  if (value === values[name]) return;

  // use appropriate method given namespace (ns)
  if (ns) {
    setAttributeNS(element, name, value, ns);
  } else {
    setAttribute(element, name, value);
  }

  // note current value for future comparison
  values[name] = value;
}
function setStyle(el, name, value) {
  if (value !== values[name]) {
    if (value == null) {
      el.style.removeProperty(name);
    } else {
      el.style.setProperty(name, value + '');
    }
    values[name] = value;
  }
}
function setAttributes(el, attrs) {
  for (const key in attrs) {
    setAttribute(el, key, attrs[key]);
  }
}
function setAttribute(el, name, value) {
  if (value != null) {
    // if value is provided, update DOM attribute
    el.setAttribute(name, value);
  } else {
    // else remove DOM attribute
    el.removeAttribute(name);
  }
}
function setAttributeNS(el, name, value, ns) {
  if (value != null) {
    // if value is provided, update DOM attribute
    el.setAttributeNS(ns, name, value);
  } else {
    // else remove DOM attribute
    el.removeAttributeNS(ns, name);
  }
}
function href() {
  let loc;
  return typeof window === 'undefined' ? '' : (loc = window.location).hash ? loc.href.slice(0, -loc.hash.length) : loc.href;
}

function SVGStringRenderer(loader) {
  Renderer.call(this, loader);
  this._text = null;
  this._defs = {
    gradient: {},
    clipping: {}
  };
}
inherits(SVGStringRenderer, Renderer, {
  /**
   * Returns the rendered SVG text string,
   * or null if rendering has not yet occurred.
   */
  svg() {
    return this._text;
  },
  /**
   * Internal rendering method.
   * @param {object} scene - The root mark of a scenegraph to render.
   */
  _render(scene) {
    const m = markup();

    // svg tag
    m.open('svg', extend({}, metadata, {
      class: 'marks',
      width: this._width * this._scale,
      height: this._height * this._scale,
      viewBox: `0 0 ${this._width} ${this._height}`
    }));

    // background, if defined
    const bg = this._bgcolor;
    if (bg && bg !== 'transparent' && bg !== 'none') {
      m.open('rect', {
        width: this._width,
        height: this._height,
        fill: bg
      }).close();
    }

    // root content group
    m.open('g', rootAttributes, {
      transform: 'translate(' + this._origin + ')'
    });
    this.mark(m, scene);
    m.close(); // </g>

    // defs
    this.defs(m);

    // get SVG text string
    this._text = m.close() + '';
    return this;
  },
  /**
   * Render a set of mark items.
   * @param {object} m - The markup context.
   * @param {object} scene - The mark parent to render.
   */
  mark(m, scene) {
    const mdef = Marks[scene.marktype],
      tag = mdef.tag,
      attrList = [ariaItemAttributes, mdef.attr];

    // render opening group tag
    m.open('g', {
      'class': cssClass(scene),
      'clip-path': scene.clip ? clip$1(this, scene, scene.group) : null
    }, ariaMarkAttributes(scene), {
      'pointer-events': tag !== 'g' && scene.interactive === false ? 'none' : null
    });

    // render contained elements
    const process = item => {
      const href = this.href(item);
      if (href) m.open('a', href);
      m.open(tag, this.attr(scene, item, attrList, tag !== 'g' ? tag : null));
      if (tag === 'text') {
        const tl = textLines(item);
        if (isArray(tl)) {
          // multi-line text
          const attrs = {
            x: 0,
            dy: lineHeight(item)
          };
          for (let i = 0; i < tl.length; ++i) {
            m.open('tspan', i ? attrs : null).text(textValue(item, tl[i])).close();
          }
        } else {
          // single-line text
          m.text(textValue(item, tl));
        }
      } else if (tag === 'g') {
        const fore = item.strokeForeground,
          fill = item.fill,
          stroke = item.stroke;
        if (fore && stroke) {
          item.stroke = null;
        }
        m.open('path', this.attr(scene, item, mdef.background, 'bgrect')).close();

        // recurse for group content
        m.open('g', this.attr(scene, item, mdef.content));
        visit(item, scene => this.mark(m, scene));
        m.close();
        if (fore && stroke) {
          if (fill) item.fill = null;
          item.stroke = stroke;
          m.open('path', this.attr(scene, item, mdef.foreground, 'bgrect')).close();
          if (fill) item.fill = fill;
        } else {
          m.open('path', this.attr(scene, item, mdef.foreground, 'bgfore')).close();
        }
      }
      m.close(); // </tag>
      if (href) m.close(); // </a>
    };

    if (mdef.nested) {
      if (scene.items && scene.items.length) process(scene.items[0]);
    } else {
      visit(scene, process);
    }

    // render closing group tag
    return m.close(); // </g>
  },

  /**
   * Get href attributes for a hyperlinked mark item.
   * @param {Item} item - The mark item.
   */
  href(item) {
    const href = item.href;
    let attr;
    if (href) {
      if (attr = this._hrefs && this._hrefs[href]) {
        return attr;
      } else {
        this.sanitizeURL(href).then(attr => {
          // rewrite to use xlink namespace
          attr['xlink:href'] = attr.href;
          attr.href = null;
          (this._hrefs || (this._hrefs = {}))[href] = attr;
        });
      }
    }
    return null;
  },
  /**
   * Get an object of SVG attributes for a mark item.
   * @param {object} scene - The mark parent.
   * @param {Item} item - The mark item.
   * @param {array|function} attrs - One or more attribute emitters.
   * @param {string} tag - The tag being rendered.
   */
  attr(scene, item, attrs, tag) {
    const object = {},
      emit = (name, value, ns, prefixed) => {
        object[prefixed || name] = value;
      };

    // apply mark specific attributes
    if (Array.isArray(attrs)) {
      attrs.forEach(fn => fn(emit, item, this));
    } else {
      attrs(emit, item, this);
    }

    // apply style attributes
    if (tag) {
      style(object, item, scene, tag, this._defs);
    }
    return object;
  },
  /**
   * Render SVG defs, as needed.
   * Must be called *after* marks have been processed to ensure the
   * collected state is current and accurate.
   * @param {object} m - The markup context.
   */
  defs(m) {
    const gradient = this._defs.gradient,
      clipping = this._defs.clipping,
      count = Object.keys(gradient).length + Object.keys(clipping).length;
    if (count === 0) return; // nothing to do

    m.open('defs');
    for (const id in gradient) {
      const def = gradient[id],
        stops = def.stops;
      if (def.gradient === 'radial') {
        // SVG radial gradients automatically transform to normalized bbox
        // coordinates, in a way that is cumbersome to replicate in canvas.
        // We wrap the radial gradient in a pattern element, allowing us to
        // maintain a circular gradient that matches what canvas provides.

        m.open('pattern', {
          id: patternPrefix + id,
          viewBox: '0,0,1,1',
          width: '100%',
          height: '100%',
          preserveAspectRatio: 'xMidYMid slice'
        });
        m.open('rect', {
          width: '1',
          height: '1',
          fill: 'url(#' + id + ')'
        }).close();
        m.close(); // </pattern>

        m.open('radialGradient', {
          id: id,
          fx: def.x1,
          fy: def.y1,
          fr: def.r1,
          cx: def.x2,
          cy: def.y2,
          r: def.r2
        });
      } else {
        m.open('linearGradient', {
          id: id,
          x1: def.x1,
          x2: def.x2,
          y1: def.y1,
          y2: def.y2
        });
      }
      for (let i = 0; i < stops.length; ++i) {
        m.open('stop', {
          offset: stops[i].offset,
          'stop-color': stops[i].color
        }).close();
      }
      m.close();
    }
    for (const id in clipping) {
      const def = clipping[id];
      m.open('clipPath', {
        id: id
      });
      if (def.path) {
        m.open('path', {
          d: def.path
        }).close();
      } else {
        m.open('rect', {
          x: 0,
          y: 0,
          width: def.width,
          height: def.height
        }).close();
      }
      m.close();
    }
    m.close();
  }
});

// Helper function for attr for style presentation attributes
function style(s, item, scene, tag, defs) {
  let styleList;
  if (item == null) return s;
  if (tag === 'bgrect' && scene.interactive === false) {
    s['pointer-events'] = 'none';
  }
  if (tag === 'bgfore') {
    if (scene.interactive === false) {
      s['pointer-events'] = 'none';
    }
    s.display = 'none';
    if (item.fill !== null) return s;
  }
  if (tag === 'image' && item.smooth === false) {
    styleList = ['image-rendering: optimizeSpeed;', 'image-rendering: pixelated;'];
  }
  if (tag === 'text') {
    s['font-family'] = fontFamily(item);
    s['font-size'] = fontSize(item) + 'px';
    s['font-style'] = item.fontStyle;
    s['font-variant'] = item.fontVariant;
    s['font-weight'] = item.fontWeight;
  }
  for (const prop in stylesAttr) {
    let value = item[prop];
    const name = stylesAttr[prop];
    if (value === 'transparent' && (name === 'fill' || name === 'stroke')) ; else if (value != null) {
      if (isGradient(value)) {
        value = gradientRef(value, defs.gradient, '');
      }
      s[name] = value;
    }
  }
  for (const prop in stylesCss) {
    const value = item[prop];
    if (value != null) {
      styleList = styleList || [];
      styleList.push(`${stylesCss[prop]}: ${value};`);
    }
  }
  if (styleList) {
    s.style = styleList.join(' ');
  }
  return s;
}

const Canvas = 'canvas';
const PNG = 'png';
const SVG = 'svg';
const None = 'none';
const RenderType = {
  Canvas: Canvas,
  PNG: PNG,
  SVG: SVG,
  None: None
};
const modules = {};
modules[Canvas] = modules[PNG] = {
  renderer: CanvasRenderer,
  headless: CanvasRenderer,
  handler: CanvasHandler
};
modules[SVG] = {
  renderer: SVGRenderer,
  headless: SVGStringRenderer,
  handler: SVGHandler
};
modules[None] = {};
function renderModule(name, _) {
  name = String(name || '').toLowerCase();
  if (arguments.length > 1) {
    modules[name] = _;
    return this;
  } else {
    return modules[name];
  }
}

function intersect(scene, bounds, filter) {
  const hits = [],
    // intersection results
    box = new Bounds().union(bounds),
    // defensive copy
    type = scene.marktype;
  return type ? intersectMark(scene, box, filter, hits) : type === 'group' ? intersectGroup(scene, box, filter, hits) : error('Intersect scene must be mark node or group item.');
}
function intersectMark(mark, box, filter, hits) {
  if (visitMark(mark, box, filter)) {
    const items = mark.items,
      type = mark.marktype,
      n = items.length;
    let i = 0;
    if (type === 'group') {
      for (; i < n; ++i) {
        intersectGroup(items[i], box, filter, hits);
      }
    } else {
      for (const test = Marks[type].isect; i < n; ++i) {
        const item = items[i];
        if (intersectItem(item, box, test)) hits.push(item);
      }
    }
  }
  return hits;
}
function visitMark(mark, box, filter) {
  // process if bounds intersect and if
  // (1) mark is a group mark (so we must recurse), or
  // (2) mark is interactive and passes filter
  return mark.bounds && box.intersects(mark.bounds) && (mark.marktype === 'group' || mark.interactive !== false && (!filter || filter(mark)));
}
function intersectGroup(group, box, filter, hits) {
  // test intersect against group
  // skip groups by default unless filter says otherwise
  if (filter && filter(group.mark) && intersectItem(group, box, Marks.group.isect)) {
    hits.push(group);
  }

  // recursively test children marks
  // translate box to group coordinate space
  const marks = group.items,
    n = marks && marks.length;
  if (n) {
    const x = group.x || 0,
      y = group.y || 0;
    box.translate(-x, -y);
    for (let i = 0; i < n; ++i) {
      intersectMark(marks[i], box, filter, hits);
    }
    box.translate(x, y);
  }
  return hits;
}
function intersectItem(item, box, test) {
  // test bounds enclosure, bounds intersection, then detailed test
  const bounds = item.bounds;
  return box.encloses(bounds) || box.intersects(bounds) && test(item, box);
}

const clipBounds = new Bounds();
function boundClip (mark) {
  const clip = mark.clip;
  if (isFunction(clip)) {
    clip(boundContext(clipBounds.clear()));
  } else if (clip) {
    clipBounds.set(0, 0, mark.group.width, mark.group.height);
  } else return;
  mark.bounds.intersect(clipBounds);
}

const TOLERANCE = 1e-9;
function sceneEqual(a, b, key) {
  return a === b ? true : key === 'path' ? pathEqual(a, b) : a instanceof Date && b instanceof Date ? +a === +b : isNumber(a) && isNumber(b) ? Math.abs(a - b) <= TOLERANCE : !a || !b || !isObject(a) && !isObject(b) ? a == b : objectEqual(a, b);
}
function pathEqual(a, b) {
  return sceneEqual(parse(a), parse(b));
}
function objectEqual(a, b) {
  var ka = Object.keys(a),
    kb = Object.keys(b),
    key,
    i;
  if (ka.length !== kb.length) return false;
  ka.sort();
  kb.sort();
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i]) return false;
  }
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!sceneEqual(a[key], b[key], key)) return false;
  }
  return typeof a === typeof b;
}

function resetSVGDefIds() {
  resetSVGClipId();
  resetSVGGradientId();
}

export { Bounds, CanvasHandler, CanvasRenderer, Gradient, GroupItem, Handler, Item, Marks, RenderType, Renderer, ResourceLoader, SVGHandler, SVGRenderer, SVGStringRenderer, Scenegraph, boundClip, boundContext, boundItem, boundMark, boundStroke, domChild, domClear, domCreate, domFind, font, fontFamily, fontSize, intersect, intersectBoxLine, intersectPath, intersectPoint, intersectRule, lineHeight, markup, multiLineOffset, curves as pathCurves, pathEqual, parse as pathParse, vg_rect as pathRectangle, pathRender, symbols as pathSymbols, vg_trail as pathTrail, point, renderModule, resetSVGClipId, resetSVGDefIds, sceneEqual, sceneFromJSON, pickVisit as scenePickVisit, sceneToJSON, visit as sceneVisit, zorder as sceneZOrder, serializeXML, textMetrics };
