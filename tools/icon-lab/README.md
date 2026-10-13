# Nolume icon lab

Isolated visual study for an abstract Nolume mark. It does not touch the Expo app or the Laravel API.

Six compositions share one material language: inflated ellipses and discs, per-shape gradients, and a glossy surface. The square is 1024×1024, full-bleed, with no type inside the icon and no pre-rounded corners.

## Run

Node 22 (see `.nvmrc`).

```bash
cd tools/icon-lab
npm install
npm run dev
```

Open the URL Vite prints (port 5179). Arrow keys move between concepts.

`npm run export` writes the default stills into `exports/`. It launches system Chrome with WebGPU enabled and a 1400×1400 window, because the shader library will not draw a canvas larger than the window. If Chrome is elsewhere, set `CHROME_PATH`.

The in-page PNG button uses the shader when the window is at least 1024px in both directions (or the backing store is already that large). Otherwise it downloads the painted version and says so.

## What is a shader, and what is not

The live **Shader** view and the default PNG export use the [`shaders`](https://shaders.com/) package on WebGPU:

- `SolidColor` and `RadialGradient` fill the square.
- `Plastic` shades each body: OKLCH gradient, bevel inflation, studio highlight, fresnel rim. Environment drift is pinned at speed 0 so a still is deterministic. Round discs use a lower reflectivity so they don't turn into chrome buttons.
- `Glass` is the lens on Liquid Coin. It refracts the disc underneath, with a little chromatic aberration and a fresnel rim. That refraction is not stored in the SVG. The other five marks are plastic only.

The **Painted** toggle is a canvas approximation of the same layout: clipped gradients, a multiply shade, a specular, an inner rim, and a zoomed copy inside the lens. Use it when WebGPU is missing. The page falls back to it per icon if a shader fails. `exports/RENDER.txt` records which renderer produced each PNG.

`*.geometry.svg` is the editable shape layout with flat fills. It is not the shaded icon.

`*.hybrid.svg` is an SVG wrapper around the sibling PNG. The picture is still raster.

Exported PNGs are encoded from a canvas whose buffer is at least 1024 pixels on each side, then drawn into a 1024×1024 image. They are not screenshots of the page, so the gallery and controls are not in the file.

Preview light-drift is display-only. Export uses the light slider and does not advance shader time.

## Concepts

| File | Mark |
| --- | --- |
| `01-glass-bloom` | Radial petals, each with its own gradient, plus a glass core |
| `02-liquid-coin` | Fluid disc, inclusion, and refractive lens |
| `03-orbit` | Crossing elliptical rings |
| `04-fluid-petals` | Asymmetric inflated cluster |
| `05-growth` | Spiral of swelling discs |
| `06-aperture` | Tangential segments around a core |

## License note

The `shaders` package is free for personal, non-commercial, and evaluation use. Shipping it inside a commercial product needs a Shaders Pro or Team license. These PNGs are generated studies, not an integration into Nolume.
