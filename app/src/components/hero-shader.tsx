'use dom';

import { useEffect, useRef, useState } from 'react';

/** Iridescence speed from the lab. The tint is the screen color passed in as `from`. */
const SPEED = 0.2;

// Same Iridescence math as react-native-effects (MIT, Copyright (c) 2026 Blazej Kustra).
// The cockpit DOM webview has no WebGPU, so this is the WGSL written as WebGL2.
const VERT = `#version 300 es
out vec2 vNdc;
void main() {
  vec2 p = vec2(3.0, 1.0);
  if (gl_VertexID == 0) p = vec2(-1.0, -3.0);
  else if (gl_VertexID == 1) p = vec2(-1.0, 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
  vNdc = p;
}
`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform vec4 uResolution;
uniform vec4 uTime;
uniform vec4 uColor0;
out vec4 fragColor;

void main() {
  float time = uTime.x;
  vec2 vUv = vNdc * 0.5 + vec2(0.5);
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv * 2.0 - vec2(1.0)) * (uResolution.xy / mr);
  float d = -time * 0.5;
  float a = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    a += cos(fi - d - a * uv.x);
    d += sin(uv.y * fi + a);
  }
  d += time * 0.5;
  vec2 c1 = cos(uv * vec2(d, a)) * 0.6 + 0.4;
  float c2 = cos(a + d) * 0.5 + 0.5;
  vec3 col = vec3(c1.x, c1.y, c2);
  vec3 finalCol = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);
  vec3 colored = clamp(finalCol * uColor0.rgb, vec3(0.0), vec3(1.0));
  fragColor = vec4(colored, uColor0.a);
}
`;

type Rgba = [number, number, number, number];

function report(step: string, detail: Record<string, string | number | boolean> = {}) {
  const parts = Object.entries(detail).map(([key, value]) => `${key}=${value}`);
  console.log(`[wash] ${step}${parts.length > 0 ? ` ${parts.join(' ')}` : ''}`);
}

function pageColor(hex: string): Rgba {
  const raw = hex.trim().replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return [0, 0, 0, 1];
  }

  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
    1,
  ];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);

  if (!shader) {
    throw new Error('Could not create a shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Shader compile failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

export default function HeroShader({
  from,
  to,
  mid,
  reduce,
  onDrawn,
}: {
  from: string;
  to: string;
  mid: string;
  onColor: string;
  corner: number;
  reduce: boolean;
  /** Tells the native splash the first frame is on the canvas. */
  onDrawn?: () => void;
  /** Native WebView options. Ignored when this file runs as a normal web component. */
  dom?: object;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(from);
  const reduceRef = useRef(reduce);
  const onDrawnRef = useRef(onDrawn);
  colorRef.current = from;
  reduceRef.current = reduce;
  onDrawnRef.current = onDrawn;
  const [flat, setFlat] = useState(false);
  const painted = useRef(false);
  const told = useRef(false);
  const announcedWait = useRef(false);

  function publishDrawn() {
    if (told.current || !painted.current) {
      return;
    }

    const notify = onDrawnRef.current;

    if (!notify) {
      if (!announcedWait.current) {
        announcedWait.current = true;
        report('bridge', { waiting: true });
      }

      return;
    }

    told.current = true;
    report('frame');
    notify();
  }

  useEffect(() => {
    publishDrawn();
  }, [onDrawn]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || flat) {
      return;
    }

    let cancelled = false;
    let frame = 0;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false });

    if (!gl) {
      report('fallback', { reason: 'no-webgl2' });
      setFlat(true);
      painted.current = true;
      publishDrawn();
      return;
    }

    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let vao: WebGLVertexArrayObject | null = null;

    const fail = (reason: string, message?: string) => {
      report('fallback', { reason, message: message ?? '' });
      painted.current = true;
      publishDrawn();

      if (!cancelled) {
        setFlat(true);
      }
    };

    try {
      vertex = compile(gl, gl.VERTEX_SHADER, VERT);
      fragment = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram();

      if (!program) {
        throw new Error('Could not create a program');
      }

      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'Program link failed');
      }

      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.useProgram(program);
    } catch (error) {
      fail('compile', error instanceof Error ? error.message : String(error));
      return () => {
        cancelled = true;
      };
    }

    const resolution = gl.getUniformLocation(program, 'uResolution');
    const time = gl.getUniformLocation(program, 'uTime');
    const color = gl.getUniformLocation(program, 'uColor0');
    let accumulated = 0;
    let last = performance.now();
    let paintedCssWidth = 0;
    let paintedCssHeight = 0;
    let draws = 0;

    const draw = (advance: boolean) => {
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;

      if (cssWidth < 2 || cssHeight < 2) {
        return false;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(cssWidth * dpr));
      const height = Math.max(1, Math.round(cssHeight * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
      }

      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (advance) {
        accumulated += dt * SPEED;
      }

      const tint = pageColor(colorRef.current);
      gl.uniform4f(resolution, width, height, width / Math.max(height, 1), dpr);
      gl.uniform4f(time, accumulated, advance ? dt * SPEED : 0, 0, 0);
      gl.uniform4f(color, tint[0], tint[1], tint[2], tint[3]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      paintedCssWidth = cssWidth;
      paintedCssHeight = cssHeight;

      return true;
    };

    report('webgl', { view: `${window.innerWidth}x${window.innerHeight}` });

    const loop = () => {
      if (cancelled) {
        return;
      }

      if (gl.isContextLost()) {
        fail('context-lost');
        return;
      }

      const advance = !reduceRef.current;
      const resized = canvas.clientWidth !== paintedCssWidth || canvas.clientHeight !== paintedCssHeight;

      if (advance || resized || paintedCssWidth === 0) {
        if (draw(advance)) {
          draws += 1;

          if (draws === 1) {
            report('draw', { color: colorRef.current, css: `${canvas.clientWidth}x${canvas.clientHeight}` });
            painted.current = true;
            requestAnimationFrame(() => {
              if (!cancelled) {
                publishDrawn();
              }
            });
          }
        }
      }

      frame = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      gl.bindVertexArray(null);
      gl.useProgram(null);

      if (vao) {
        gl.deleteVertexArray(vao);
      }

      if (program) {
        gl.deleteProgram(program);
      }

      if (vertex) {
        gl.deleteShader(vertex);
      }

      if (fragment) {
        gl.deleteShader(fragment);
      }
    };
  }, [flat]);

  const fallback = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `linear-gradient(135deg, ${mid}, ${from} 45%, ${to})`,
      }}
    />
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: from }}>
      {flat ? fallback : (
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      )}
    </div>
  );
}
