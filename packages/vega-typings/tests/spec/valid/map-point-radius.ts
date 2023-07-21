import { Spec } from 'falkonry-vega';

export const spec: Spec = {
  $schema: 'https://vega.github.io/schema/vega/v5.json',
  padding: 10,
  width: 450,
  height: 450,
  autosize: 'none',

  signals: [
    {
      name: 'quakeSize',
      value: 6,
      bind: { input: 'range', min: 0, max: 12 }
    },
    {
      name: 'rotate0',
      value: 90,
      bind: { input: 'range', min: -180, max: 180 }
    },
    {
      name: 'rotate1',
      value: 0,
      bind: { input: 'range', min: -180, max: 180 }
    }
  ],

  data: [
    {
      name: 'sphere',
      values: [{ type: 'Sphere' }]
    },
    {
      name: 'world',
      url: 'data/world-110m.json',
      format: {
        type: 'topojson',
        feature: 'countries'
      }
    },
    {
      name: 'earthquakes',
      url: 'data/earthquakes.json',
      format: {
        type: 'json',
        property: 'features'
      }
    }
  ],

  projections: [
    {
      name: 'projection',
      scale: 225,
      type: 'orthographic',
      translate: { signal: '[width/2, height/2]' },
      rotate: [{ signal: 'rotate0' }, { signal: 'rotate1' }, 0]
    }
  ],

  scales: [
    {
      name: 'size',
      type: 'sqrt',
      domain: [0, 100],
      range: [0, { signal: 'quakeSize' }]
    }
  ],

  marks: [
    {
      type: 'shape',
      from: { data: 'sphere' },
      encode: {
        update: {
          fill: { value: 'aliceblue' },
          stroke: { value: 'black' },
          strokeWidth: { value: 1.5 }
        }
      },
      transform: [
        {
          type: 'geoshape',
          projection: 'projection'
        }
      ]
    },
    {
      type: 'shape',
      from: { data: 'world' },
      encode: {
        update: {
          fill: { value: 'mintcream' },
          stroke: { value: 'black' },
          strokeWidth: { value: 0.35 }
        }
      },
      transform: [
        {
          type: 'geoshape',
          projection: 'projection'
        }
      ]
    },
    {
      type: 'shape',
      from: { data: 'earthquakes' },
      encode: {
        update: {
          opacity: { value: 0.25 },
          fill: { value: 'red' }
        }
      },
      transform: [
        {
          type: 'geoshape',
          projection: 'projection',
          pointRadius: { expr: "scale('size', exp(datum.properties.mag))" }
        }
      ]
    }
  ]
};
