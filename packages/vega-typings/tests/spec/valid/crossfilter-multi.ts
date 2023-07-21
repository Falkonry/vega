import { Spec } from 'falkonry-vega';

export const spec: Spec = {
  $schema: 'https://vega.github.io/schema/vega/v5.json',
  width: 500,
  padding: 5,

  signals: [
    { name: 'chartHeight', value: 100 },
    { name: 'chartPadding', value: 50 },
    { name: 'height', update: '(chartHeight + chartPadding) * 3' },
    { name: 'delayExtent', value: [-60, 180] },
    { name: 'timeExtent', value: [0, 24] },
    { name: 'distExtent', value: [0, 2400] },
    { name: 'delayStep', value: 10, bind: { input: 'range', min: 2, max: 20, step: 1 } },
    { name: 'timeStep', value: 1, bind: { input: 'range', min: 0.25, max: 2, step: 0.25 } },
    { name: 'distStep', value: 100, bind: { input: 'range', min: 50, max: 200, step: 50 } },
    {
      name: 'delayRange',
      value: [-60, 58],
      on: [
        {
          events: { signal: 'delayZoom' },
          update:
            '[(delayRange[0]+delayRange[1])/2 - delayZoom, (delayRange[0]+delayRange[1])/2 + delayZoom]'
        },
        {
          events: '[@delayBrush:mousedown, window:mouseup] > window:mousemove!',
          update:
            "[delayRange[0] + invert('delayScale', x()) - invert('delayScale', xmove), delayRange[1] + invert('delayScale', x()) - invert('delayScale', xmove)]"
        },
        {
          events: '[@delay:mousedown, window:mouseup] > window:mousemove!',
          update:
            "[min(delayAnchor, invert('delayScale', x())), max(delayAnchor, invert('delayScale', x()))]"
        }
      ]
    },
    {
      name: 'delayRange2',
      value: [62, 180],
      on: [
        {
          events: { signal: 'delayZoom2' },
          update:
            '[(delayRange2[0]+delayRange2[1])/2 - delayZoom2, (delayRange2[0]+delayRange2[1])/2 + delayZoom2]'
        },
        {
          events: '[@delayBrush2:mousedown, window:mouseup] > window:mousemove!',
          update:
            "[delayRange2[0] + invert('delayScale', x()) - invert('delayScale', xmove), delayRange2[1] + invert('delayScale', x()) - invert('delayScale', xmove)]"
        }
      ]
    },
    {
      name: 'delayZoom',
      value: 0,
      on: [
        {
          events: '@delay:wheel!, @delayBrush:wheel!',
          update:
            '0.5 * abs(span(delayRange)) * pow(1.0005, event.deltaY * pow(16, event.deltaMode))'
        }
      ]
    },
    {
      name: 'delayZoom2',
      value: 0,
      on: [
        {
          events: '@delay:wheel!, @delayBrush2:wheel!',
          update:
            '0.5 * abs(span(delayRange2)) * pow(1.0005, event.deltaY * pow(16, event.deltaMode))'
        }
      ]
    },
    {
      name: 'delayAnchor',
      value: 0,
      on: [
        {
          events: '@delay:mousedown!',
          update: "invert('delayScale', x())"
        }
      ]
    },
    {
      name: 'timeRange',
      update: 'timeExtent',
      on: [
        {
          events: { signal: 'timeZoom' },
          update:
            '[(timeRange[0]+timeRange[1])/2 - timeZoom, (timeRange[0]+timeRange[1])/2 + timeZoom]'
        },
        {
          events: '@time:dblclick!, @timeBrush:dblclick!',
          update: '[timeExtent[0], timeExtent[1]]'
        },
        {
          events: '[@timeBrush:mousedown, window:mouseup] > window:mousemove!',
          update:
            "[timeRange[0] + invert('timeScale', x()) - invert('timeScale', xmove), timeRange[1] + invert('timeScale', x()) - invert('timeScale', xmove)]"
        },
        {
          events: '[@time:mousedown, window:mouseup] > window:mousemove!',
          update:
            "[min(timeAnchor, invert('timeScale', x())), max(timeAnchor, invert('timeScale', x()))]"
        }
      ]
    },
    {
      name: 'timeZoom',
      value: 0,
      on: [
        {
          events: '@time:wheel!, @timeBrush:wheel!',
          update:
            '0.5 * abs(span(timeRange)) * pow(1.0005, event.deltaY * pow(16, event.deltaMode))'
        }
      ]
    },
    {
      name: 'timeAnchor',
      value: 0,
      on: [
        {
          events: '@time:mousedown!',
          update: "invert('timeScale', x())"
        }
      ]
    },
    {
      name: 'distRange',
      update: 'distExtent',
      on: [
        {
          events: { signal: 'distZoom' },
          update:
            '[(distRange[0]+distRange[1])/2 - distZoom, (distRange[0]+distRange[1])/2 + distZoom]'
        },
        {
          events: '@dist:dblclick!, @distBrush:dblclick!',
          update: '[distExtent[0], distExtent[1]]'
        },
        {
          events: '[@distBrush:mousedown, window:mouseup] > window:mousemove!',
          update:
            "[distRange[0] + invert('distScale', x()) - invert('distScale', xmove), distRange[1] + invert('distScale', x()) - invert('distScale', xmove)]"
        },
        {
          events: '[@dist:mousedown, window:mouseup] > window:mousemove!',
          update:
            "[min(distAnchor, invert('distScale', x())), max(distAnchor, invert('distScale', x()))]"
        }
      ]
    },
    {
      name: 'distZoom',
      value: 0,
      on: [
        {
          events: '@dist:wheel!, @distBrush:wheel!',
          update:
            '0.5 * abs(span(distRange)) * pow(1.0005, event.deltaY * pow(16, event.deltaMode))'
        }
      ]
    },
    {
      name: 'distAnchor',
      value: 0,
      on: [
        {
          events: '@dist:mousedown!',
          update: "invert('distScale', x())"
        }
      ]
    },
    { name: 'xmove', value: 0, on: [{ events: 'window:mousemove', update: 'x()' }] }
  ],

  data: [
    {
      name: 'flights',
      url: 'data/flights-200k.json',
      transform: [
        {
          type: 'bin',
          field: 'delay',
          extent: { signal: 'delayExtent' },
          step: { signal: 'delayStep' },
          as: ['delay0', 'delay1']
        },
        {
          type: 'bin',
          field: 'time',
          extent: { signal: 'timeExtent' },
          step: { signal: 'timeStep' },
          as: ['time0', 'time1']
        },
        {
          type: 'bin',
          field: 'distance',
          extent: { signal: 'distExtent' },
          step: { signal: 'distStep' },
          as: ['dist0', 'dist1']
        },
        {
          type: 'crossfilter',
          signal: 'xfilter',
          fields: ['delay', 'time', 'distance', 'delay'],
          query: [
            { signal: 'delayRange' },
            { signal: 'timeRange' },
            { signal: 'distRange' },
            { signal: 'delayRange2' }
          ]
        }
      ]
    }
  ],

  scales: [
    {
      name: 'layout',
      type: 'band',
      domain: ['delay', 'time', 'distance'],
      range: 'height'
    },
    {
      name: 'delayScale',
      type: 'linear',
      round: true,
      domain: { signal: 'delayExtent' },
      range: 'width'
    },
    {
      name: 'timeScale',
      type: 'linear',
      round: true,
      domain: { signal: 'timeExtent' },
      range: 'width'
    },
    {
      name: 'distScale',
      type: 'linear',
      round: true,
      domain: { signal: 'distExtent' },
      range: 'width'
    }
  ],

  marks: [
    {
      description: 'Delay Histogram',
      name: 'delay',
      type: 'group',
      encode: {
        enter: {
          y: { scale: 'layout', value: 'delay', offset: 20 },
          width: { signal: 'width' },
          height: { signal: 'chartHeight' },
          fill: { value: 'transparent' }
        }
      },

      data: [
        {
          name: 'delay-bins',
          source: 'flights',
          transform: [
            {
              type: 'resolvefilter',
              ignore: 9,
              filter: { signal: 'xfilter' }
            },
            {
              type: 'aggregate',
              groupby: ['delay0', 'delay1'],
              key: 'delay0',
              drop: false
            }
          ]
        }
      ],

      scales: [
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'delay-bins', field: 'count' },
          range: [{ signal: 'chartHeight' }, 0]
        }
      ],

      axes: [{ orient: 'bottom', scale: 'delayScale' }],

      marks: [
        {
          type: 'rect',
          name: 'delayBrush',
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: '#fcfcfc' }
            },
            update: {
              x: { signal: "scale('delayScale', delayRange[0])" },
              x2: { signal: "scale('delayScale', delayRange[1])" }
            }
          }
        },
        {
          type: 'rect',
          name: 'delayBrush2',
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: '#fcfcfc' }
            },
            update: {
              x: { signal: "scale('delayScale', delayRange2[0])" },
              x2: { signal: "scale('delayScale', delayRange2[1])" }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          from: { data: 'delay-bins' },
          encode: {
            enter: {
              fill: { value: 'steelblue' }
            },
            update: {
              x: { scale: 'delayScale', field: 'delay0' },
              x2: { scale: 'delayScale', field: 'delay1', offset: -1 },
              y: { scale: 'yscale', field: 'count' },
              y2: { scale: 'yscale', value: 0 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'firebrick' }
            },
            update: {
              x: { signal: "scale('delayScale', delayRange[0])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'firebrick' }
            },
            update: {
              x: { signal: "scale('delayScale', delayRange[1])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'forestgreen' }
            },
            update: {
              x: { signal: "scale('delayScale', delayRange2[0])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'forestgreen' }
            },
            update: {
              x: { signal: "scale('delayScale', delayRange2[1])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'text',
          interactive: false,
          encode: {
            enter: {
              y: { value: -5 },
              text: { value: 'Arrival Delay (min)' },
              baseline: { value: 'bottom' },
              fontSize: { value: 14 },
              fontWeight: { value: 500 },
              fill: { value: 'black' }
            }
          }
        }
      ]
    },

    {
      description: 'Time Histogram',
      name: 'time',
      type: 'group',
      encode: {
        enter: {
          y: { scale: 'layout', value: 'time', offset: 20 },
          width: { signal: 'width' },
          height: { signal: 'chartHeight' },
          fill: { value: 'transparent' }
        }
      },

      data: [
        {
          name: 'time-bins',
          source: 'flights',
          transform: [
            {
              type: 'resolvefilter',
              ignore: 10,
              filter: { signal: 'xfilter' }
            },
            {
              type: 'aggregate',
              groupby: ['time0', 'time1'],
              key: 'time0',
              drop: false
            }
          ]
        }
      ],

      scales: [
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'time-bins', field: 'count' },
          range: [{ signal: 'chartHeight' }, 0]
        }
      ],

      axes: [{ orient: 'bottom', scale: 'timeScale' }],

      marks: [
        {
          type: 'rect',
          name: 'timeBrush',
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: '#fcfcfc' }
            },
            update: {
              x: { signal: "scale('timeScale', timeRange[0])" },
              x2: { signal: "scale('timeScale', timeRange[1])" }
            }
          }
        },
        {
          type: 'rect',
          from: { data: 'time-bins' },
          interactive: false,
          encode: {
            enter: {
              fill: { value: 'steelblue' }
            },
            update: {
              x: { scale: 'timeScale', field: 'time0' },
              x2: { scale: 'timeScale', field: 'time1', offset: -1 },
              y: { scale: 'yscale', field: 'count' },
              y2: { scale: 'yscale', value: 0 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'firebrick' }
            },
            update: {
              x: { signal: "scale('timeScale', timeRange[0])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'firebrick' }
            },
            update: {
              x: { signal: "scale('timeScale', timeRange[1])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'text',
          interactive: false,
          encode: {
            enter: {
              y: { value: -5 },
              text: { value: 'Local Departure Time (hour)' },
              baseline: { value: 'bottom' },
              fontSize: { value: 14 },
              fontWeight: { value: 500 },
              fill: { value: 'black' }
            }
          }
        }
      ]
    },

    {
      description: 'Distance Histogram',
      name: 'dist',
      type: 'group',
      encode: {
        enter: {
          y: { scale: 'layout', value: 'distance', offset: 20 },
          width: { signal: 'width' },
          height: { signal: 'chartHeight' },
          fill: { value: 'transparent' }
        }
      },

      data: [
        {
          name: 'dist-bins',
          source: 'flights',
          transform: [
            {
              type: 'resolvefilter',
              ignore: 5,
              filter: { signal: 'xfilter' }
            },
            {
              type: 'aggregate',
              groupby: ['dist0', 'dist1'],
              key: 'dist0',
              drop: false
            }
          ]
        }
      ],

      scales: [
        {
          name: 'yscale',
          type: 'linear',
          domain: { data: 'dist-bins', field: 'count' },
          range: [{ signal: 'chartHeight' }, 0]
        }
      ],

      axes: [{ orient: 'bottom', scale: 'distScale' }],

      marks: [
        {
          type: 'rect',
          name: 'distBrush',
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: '#fcfcfc' }
            },
            update: {
              x: { signal: "scale('distScale', distRange[0])" },
              x2: { signal: "scale('distScale', distRange[1])" }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          from: { data: 'dist-bins' },
          encode: {
            enter: {
              fill: { value: 'steelblue' }
            },
            update: {
              x: { scale: 'distScale', field: 'dist0' },
              x2: { scale: 'distScale', field: 'dist1', offset: -1 },
              y: { scale: 'yscale', field: 'count' },
              y2: { scale: 'yscale', value: 0 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'firebrick' }
            },
            update: {
              x: { signal: "scale('distScale', distRange[0])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'rect',
          interactive: false,
          encode: {
            enter: {
              y: { value: 0 },
              height: { signal: 'chartHeight' },
              fill: { value: 'firebrick' }
            },
            update: {
              x: { signal: "scale('distScale', distRange[1])" },
              width: { value: 1 }
            }
          }
        },
        {
          type: 'text',
          interactive: false,
          encode: {
            enter: {
              y: { value: -5 },
              text: { value: 'Travel Distance (miles)' },
              baseline: { value: 'bottom' },
              fontSize: { value: 14 },
              fontWeight: { value: 500 },
              fill: { value: 'black' }
            }
          }
        }
      ]
    }
  ]
};
