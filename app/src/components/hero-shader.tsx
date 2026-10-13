'use dom';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type ShaderModule = typeof import('shaders/react');

type Plate = {
  scale: number;
  shapeType: 'roundedRectSDF';
  center: { x: number; y: number };
  shape: { type: 'roundedRectSDF'; radius: number; height: number; rounding: number };
};

const BLEED = 0.22;

const LOOK = {
  lensBulge: 0.06,
  swirl: 0,
  dispersion: 0.75,
  spread: 0.7,
  refraction: 1.9,
  aberration: 1.1,
  highlight: 0.7,
  edgeSoftness: 0.03,
  tint: 0,
  blur: 0,
};

function heroPlate(width: number, height: number, corner: number): Plate {
  const aspect = width / Math.max(height, 1);
  const scale = Math.max(aspect, 1);
  const field = scale * height;

  return {
    scale,
    shapeType: 'roundedRectSDF',
    center: { x: 0.5, y: 0.5 },
    shape: {
      type: 'roundedRectSDF',
      radius: (0.5 * aspect) / scale,
      height: 0.5 / scale,
      rounding: corner / field,
    },
  };
}

export default function HeroShader({
  from,
  to,
  mid,
  onColor,
  corner,
  reduce,
}: {
  from: string;
  to: string;
  mid: string;
  onColor: string;
  corner: number;
  reduce: boolean;
  /** Native WebView options. Ignored when this file runs as a normal web component. */
  dom?: object;
}) {
  const paint = { from, to, mid, on: onColor };
  const frameRef = useRef<HTMLDivElement>(null);
  const [mod, setMod] = useState<ShaderModule | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = frameRef.current;

    if (!node) {
      return;
    }

    const measure = () => {
      const next = { width: node.clientWidth, height: node.clientHeight };
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) {
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
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reduce]);

  const measured = size.width > 1 && size.height > 1;
  const showShader = mod != null && !unavailable && !reduce && measured;
  const plate = heroPlate(size.width * (1 + BLEED * 2), size.height * (1 + BLEED * 2), corner);

  return (
    <div ref={frameRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: to }}>
      {showShader && mod ? (
        <mod.Shader
          style={{
            position: 'absolute',
            left: `-${BLEED * 100}%`,
            top: `-${BLEED * 100}%`,
            width: `${100 + BLEED * 200}%`,
            height: `${100 + BLEED * 200}%`,
          }}
          onUnavailable={() => setUnavailable(true)}
        >
          {layers(mod, paint, plate)}
        </mod.Shader>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${mid}, ${from} 45%, ${to})`,
          }}
        />
      )}
    </div>
  );
}

function layers(mod: ShaderModule, paint: { from: string; to: string; mid: string; on: string }, plate: Plate): ReactNode {
  return (
    <>
      <mod.SolidColor color={paint.to} />
      <mod.LensDistortion center={{ x: 0.5, y: 0.5 }} lensBulge={LOOK.lensBulge} swirl={LOOK.swirl} dispersion={LOOK.dispersion} spread={LOOK.spread}>
        <mod.Glass
          {...plate}
          cutout
          tintColor={paint.mid}
          tintIntensity={LOOK.tint}
          refraction={LOOK.refraction}
          aberration={LOOK.aberration}
          highlight={LOOK.highlight}
          edgeSoftness={LOOK.edgeSoftness}
          blur={LOOK.blur}
        >
          <mod.MeshGradient
            stops={[
              { color: paint.to, position: 0 },
              { color: paint.from, position: 0.36 },
              { color: paint.on, position: 0.48 },
              { color: paint.mid, position: 0.56 },
              { color: paint.from, position: 0.78 },
              { color: paint.to, position: 1 },
            ]}
            count={6}
            smoothness={0.65}
            variation={1.15}
            swirl={1.35}
            drift={1.25}
            wrapping={0}
            speed={1.55}
            seed={7}
            colorSpace="oklab"
          />
        </mod.Glass>
      </mod.LensDistortion>
    </>
  );
}
