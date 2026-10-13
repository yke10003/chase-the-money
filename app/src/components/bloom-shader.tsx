'use dom';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type ShaderModule = typeof import('shaders/react');

/** Ground behind the lab canvas. */
const GROUND = '#0b1d3a';

type Stop = { color: string; position: number };

/** Sunset neon, eight stops, same ramp as the petal lab. */
const SUNSET: Stop[] = [
  { color: '#2A0A4A', position: 0 },
  { color: '#7A5CFF', position: 0.16 },
  { color: '#FF2E63', position: 0.34 },
  { color: '#FF2E63', position: 0.48 },
  { color: '#FF6B2C', position: 0.62 },
  { color: '#FFC857', position: 0.76 },
  { color: '#FFC857', position: 0.88 },
  { color: '#FF6B2C', position: 1 },
];

/** Screenshot values. Soft material dulls roughness, shine, shading, and rim below. */
const LOOK = {
  lightAngle: 310,
  gradientAngle: 90,
  curvature: 0.32,
  waveScale: 1,
  thickness: 1,
  roughness: Math.min(0.92, 0.5 * 0.35 + 0.55),
  reflectivity: 0.28 * 0.35,
  shading: 0.86 * 0.72,
  rim: 0.16 * 0.4,
  edgeSoftness: 0.04,
  motion: 0.3,
  driftSpeed: 0.35,
  count: 14,
  overlap: 0.82,
  radial: 0.22,
  arrangement: -6,
  gradientScale: 0.42,
  tilt: 0.5,
};

type Petal = {
  id: string;
  x: number;
  y: number;
  depth: number;
  scale: number;
  rotation: number;
  radiusX: number;
  radiusY: number;
  radiusZ: number;
};

const PETALS = placePetals();

export default function BloomShader({
  reduce,
  onReady,
}: {
  reduce: boolean;
  onReady?: () => void;
  /** Native WebView options. Ignored when this file runs as a normal web component. */
  dom?: object;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const told = useRef(false);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const [mod, setMod] = useState<ShaderModule | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [live, setLive] = useState(false);
  const [side, setSide] = useState(0);
  const [pose, setPose] = useState({ drift: 0, tumble: 20 });
  const ready = useCallback(() => {
    if (told.current) {
      return;
    }

    told.current = true;
    onReadyRef.current?.();
  }, []);
  const handleReady = useCallback(() => {
    ready();
    setLive(true);
  }, [ready]);
  const handleUnavailable = useCallback(() => {
    setUnavailable(true);
    ready();
  }, [ready]);

  useEffect(() => {
    const node = frameRef.current;

    if (!node) {
      return;
    }

    const measure = () => {
      const next = Math.min(node.clientWidth, node.clientHeight);
      setSide((current) => (current === next ? current : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) {
      ready();
      return;
    }

    let cancelled = false;

    import('shaders/react')
      .then((loaded) => {
        if (!cancelled) {
          setMod(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnavailable(true);
          ready();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ready, reduce]);

  useEffect(() => {
    if (reduce || !live) {
      return;
    }

    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = (now - started) / 1000;
      const tumble = 20 + Math.sin(t * 0.42) * 38;
      const drift = Math.sin(t * LOOK.driftSpeed * 0.85) * LOOK.motion * 0.5;
      setPose({ drift, tumble });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [live, reduce]);

  const showShader = mod != null && !unavailable && !reduce && side > 1;
  const stops = sheetStops(pose.drift);

  return (
    <div ref={frameRef} style={{ position: 'absolute', inset: 0, background: GROUND }}>
      {showShader && mod ? (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: side,
            height: side,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <mod.Shader
            style={{ width: '100%', height: '100%' }}
            onReady={handleReady}
            onUnavailable={handleUnavailable}
          >
            {layers(mod, stops, pose.tumble)}
          </mod.Shader>
        </div>
      ) : null}
    </div>
  );
}

function layers(mod: ShaderModule, stops: Stop[], tumble: number): ReactNode {
  return (
    <mod.Glow intensity={0.75} threshold={0.28} size={56}>
      <mod.SolidColor color={GROUND} />
      {PETALS.map((petal) => (
        <mod.Plastic
          key={petal.id}
          id={petal.id}
          center={{ x: petal.x, y: petal.y }}
          scale={petal.scale}
          rotation={petal.rotation}
          colorA={stops[stops.length - 1].color}
          colorB={stops[0].color}
          stops={stops}
          gradientAngle={LOOK.gradientAngle}
          colorSpace="oklch"
          thickness={LOOK.thickness}
          roughness={LOOK.roughness}
          reflectivity={LOOK.reflectivity}
          crumple={0}
          crumpleScale={1}
          crumpleCoverage={0}
          seed={1}
          edgeSoftness={LOOK.edgeSoftness}
          lightAngle={LOOK.lightAngle}
          speed={0}
          shading={LOOK.shading}
          rim={LOOK.rim}
          rimColor="#fff6ee"
          shape={{
            type: 'ellipsoid3D',
            radiusX: petal.radiusX,
            radiusY: petal.radiusY,
            radiusZ: petal.radiusZ,
            rotX: tumble,
            rotY: 0,
            rotZ: 0,
          }}
        />
      ))}
    </mod.Glow>
  );
}

function placePetals(): Petal[] {
  const count = LOOK.count;
  const squeeze = 1 - LOOK.tilt * 0.48;
  const ring = LOOK.radial;
  const chord = 2 * ring * Math.sin(Math.PI / count);
  const length = ring * (0.62 + LOOK.overlap * 0.12);
  const packed = (chord / 2) * (1.2 + LOOK.overlap * 0.55);
  const width = Math.min(packed, length * 0.72);
  const thick = length * 0.4;
  const placed: Petal[] = [];

  for (let index = 0; index < count; index += 1) {
    const turn = (index / count) * Math.PI * 2 + (LOOK.arrangement * Math.PI) / 180;
    const dx = Math.cos(turn);
    const dy = Math.sin(turn) * squeeze;
    const near = (Math.sin(turn) + 1) / 2;
    const y = 0.48 + dy * ring;

    placed.push({
      id: `body-${index}`,
      x: 0.5 + dx * ring,
      y,
      depth: y,
      scale: 0.94 + near * 0.12,
      rotation: (Math.atan2(dy, dx) * 180) / Math.PI + 90,
      radiusX: width,
      radiusY: length,
      radiusZ: thick,
    });
  }

  placed.sort((a, b) => a.depth - b.depth);

  return placed;
}

const FOLD = 0.14;

function sheetStops(drift: number): Stop[] {
  const wavelength = 0.5 - LOOK.gradientScale * 0.28;
  const travel = drift / wavelength;
  const span = 0.7 + LOOK.gradientScale * 0.6;
  const last = SUNSET.length - 1;
  const sampled = SUNSET.map((_, index) => {
    const along = index / last;

    return {
      position: along,
      color: sampleField(travel + (span * along)),
    };
  });

  return bendStops(sampled);
}

function bendStops(stops: Stop[]): Stop[] {
  const bent = stops.map((stop) => {
    const bow = Math.sin(stop.position * Math.PI * LOOK.waveScale) * LOOK.curvature * 0.16;
    const position = Math.min(0.985, Math.max(0.015, stop.position + bow));

    return { color: stop.color, position };
  });

  bent.sort((a, b) => a.position - b.position);
  bent[0] = { ...bent[0], position: 0 };
  bent[bent.length - 1] = { ...bent[bent.length - 1], position: 1 };

  return bent;
}

function sampleField(cycle: number): string {
  const reach = 0.08;
  const behind = samplePoint(cycle - reach);
  const at = samplePoint(cycle);
  const ahead = samplePoint(cycle + reach);
  const mid = mixHex(behind, ahead, 0.5);

  return mixHex(mid, at, 0.55);
}

function samplePoint(cycle: number): string {
  return sampleRamp(mirroredUnit(cycle));
}

function mirroredUnit(cycle: number): number {
  const x = ((cycle % 2) + 2) % 2;

  if (x < FOLD) {
    return roundedValley(x);
  }

  if (x > 2 - FOLD) {
    return roundedValley(x - 2);
  }

  if (Math.abs(x - 1) < FOLD) {
    return roundedPeak(x);
  }

  return x <= 1 ? x : 2 - x;
}

function roundedValley(x: number): number {
  const u = (x + FOLD) / (2 * FOLD);

  return FOLD - 2 * FOLD * u * (1 - u);
}

function roundedPeak(x: number): number {
  const u = (x - (1 - FOLD)) / (2 * FOLD);

  return (1 - FOLD) + 2 * FOLD * u * (1 - u);
}

function sampleRamp(t: number): string {
  const u = Math.min(1, Math.max(0, t));

  if (u <= SUNSET[0].position) {
    return SUNSET[0].color;
  }

  for (let index = 1; index < SUNSET.length; index += 1) {
    const previous = SUNSET[index - 1];
    const stop = SUNSET[index];

    if (u <= stop.position) {
      const span = stop.position - previous.position;
      const amount = span === 0 ? 0 : (u - previous.position) / span;

      return mixHex(previous.color, stop.color, amount);
    }
  }

  return SUNSET[SUNSET.length - 1].color;
}

function mixHex(a: string, b: string, amount: number): string {
  const mix = Math.min(1, Math.max(0, amount));
  const value = [0, 1, 2].map((index) => Math.round(channel(a, index) + (channel(b, index) - channel(a, index)) * mix));

  return `#${value.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}
