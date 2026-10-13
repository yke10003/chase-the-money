# Petal material

Inflated petals, rendered only with the `shaders` package. This does not touch the app.

```bash
cd tools/petal-lab
npm install
npm run dev
```

Open the URL Vite prints (port 5181). Two views:

- **Master Petal** is the phase 1 study. One ellipsoid, `Plastic` for the bevel and the studio light, and a `LinearGradient` in OKLCH bowed by `WaveDistortion`. The wave is masked to the plastic and blended with `color`, so the hue moves and the silhouette stays put.
- **Bloom Composition** sets 6–20 short lobes on a ring. The ring is drawn as an ellipse (`Head tilt`), and the near side is painted last so it covers the far side. The lobes are shorter than the ring radius, so the middle stays open. **Uniform gradients** repeats one local ramp on each petal. **Coordinated gradients** gives each petal a different slice of one ramp.

`npm run export` writes the five master-petal palette stills, `master-petal.png`, and `bloom-composition.png`, all 1024×1024. Chrome is launched with a 1400×1400 window because this library will not draw a canvas larger than the viewport.

## How the bloom color works

A single canvas gradient, masked onto every petal, would be one continuous field. Past about five of those masked layers the GPU draws a blank frame, so the bloom does not do that.

The bloom samples one sheet. Field direction is the gradient angle plus Field direction. Field scale sets how wide one palette cycle is. Motion slides that sheet across the petals. It does not turn each petal's ramp. Plastic cannot share one coordinate, so each lobe is given the slice of the sheet that covers it. Glass and Crystal refract one real gradient behind the ring, with mirror or wrap edges.

Mirrored repeat runs the palette out and back (A–E–A). Straight repeat restarts it (A–E–A). Mirrored is the default.

Material Lab is the single lobe with every effect. Bloom keeps the effects that still draw as a ring: Plastic, Soft, Gloss, Pearl, Heatmap, Chrome, Holographic, and Goo. Glass, Thin film, and Crystal draw on one lobe and go blank as fourteen copies, so choosing them from the bloom opens the lab. Emboss is a flat relief. Irradiance is a dark lobe with a few lights. Goo is one tint.
