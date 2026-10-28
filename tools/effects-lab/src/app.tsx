import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { formatCssColor, normalizeHex } from './color'
import {
  EFFECTS,
  FRAMES,
  LIBRARY_URL,
  LIBRARY_VERSION,
  PALETTES,
  applyPreset,
  buildDrawState,
  defaultValues,
  getEffect,
  quantize,
  type ColorControl,
  type EffectDef,
  type EffectId,
  type NumberControl,
  type PresetId,
  type ValueMap,
} from './catalog'
import { subscribeGpuErrors, webgpuAvailable } from './device'
import { toJson, toTsx } from './export'
import { loadState, saveState, type StageTone } from './persist'
import { PreviewRenderer } from './renderer'
import { subscribeThumbnails } from './thumbnails'

const gpu = webgpuAvailable()

export function App() {
  const [state, setState] = useState(loadState)
  const [thumbs, setThumbs] = useState<Partial<Record<EffectId, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [exportKind, setExportKind] = useState<'tsx' | 'json'>('tsx')
  const [copyNote, setCopyNote] = useState<string | null>(null)
  const skipSave = useRef(true)

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false
      return
    }
    saveState(state)
  }, [state])

  useEffect(() => subscribeThumbnails((id, url) => {
    setThumbs((current) => (current[id] === url ? current : { ...current, [id]: url }))
  }), [])

  useEffect(() => {
    if (!copyNote) return
    const timeout = window.setTimeout(() => setCopyNote(null), 1800)
    return () => window.clearTimeout(timeout)
  }, [copyNote])

  const effect = getEffect(state.effectId)
  const values = state.values[effect.id]
  const presetId = state.presets[effect.id]
  const snippet = exportKind === 'tsx' ? toTsx(effect, values) : toJson(effect, values)

  function selectEffect(id: EffectId) {
    setError(null)
    setState((current) => ({ ...current, effectId: id }))
  }

  function patchValues(next: ValueMap, preset: PresetId) {
    setState((current) => ({
      ...current,
      values: { ...current.values, [effect.id]: next },
      presets: { ...current.presets, [effect.id]: preset },
    }))
  }

  function changeValue(key: string, value: string | number) {
    const next = { ...values, [key]: value }
    const colorEdited = effect.controls.some((control) => {
      if (control.kind !== 'color') return false
      return key === control.key || (control.alpha && key === `${control.key}Alpha`)
    })
    patchValues(next, colorEdited ? 'custom' : presetId)
  }

  function choosePreset(id: PresetId) {
    if (id === 'custom') {
      patchValues(values, 'custom')
      return
    }
    const palette = PALETTES.find((item) => item.id === id)
    if (!palette) return
    patchValues(applyPreset(effect, values, palette), id)
  }

  function reset() {
    patchValues(defaultValues(effect), 'custom')
  }

  async function copy(kind: 'tsx' | 'json') {
    const text = kind === 'tsx' ? toTsx(effect, values) : toJson(effect, values)
    try {
      await navigator.clipboard.writeText(text)
      setCopyNote(kind === 'tsx' ? 'Copied React Native code' : 'Copied JSON')
    } catch (copyError) {
      console.error('[effects-lab] Copy failed:', copyError)
      setCopyNote('Could not copy. Select the snippet below.')
    }
  }

  const running = effect.animates && !effect.isStatic(values) && !state.paused
  const transportLabel = !effect.animates || effect.isStatic(values) ? 'Still' : running ? 'Pause' : 'Play'

  return (
    <div className="app">
      <aside className="panel list-panel">
        <header className="brand">
          <p className="brand-kicker">Nolume</p>
          <h1>Effects Lab</h1>
          <p className="brand-copy">
            Upstream shaders from react-native-effects {LIBRARY_VERSION}, rendered here with WebGPU.
          </p>
        </header>
        <ul className="effect-list">
          {EFFECTS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={item.id === effect.id ? 'effect is-active' : 'effect'}
                aria-current={item.id === effect.id ? 'true' : undefined}
                onClick={() => selectEffect(item.id)}
              >
                <span className="thumb">
                  {thumbs[item.id] ? (
                    <img src={thumbs[item.id]} alt="" />
                  ) : (
                    <span className="thumb-empty" />
                  )}
                </span>
                <span className="effect-copy">
                  <span className="effect-name">{item.label}</span>
                  <span className="effect-desc">{item.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <footer className="brand-foot">
          <a href={LIBRARY_URL} target="_blank" rel="noreferrer">
            Blazej Kustra, MIT
          </a>
          <span>{gpu ? 'WebGPU adapter' : 'WebGPU missing'}</span>
        </footer>
      </aside>

      <main className="center">
        <header className="center-bar">
          <div className="titles">
            <p className="component-name">{effect.component}</p>
            <h2>{effect.label}</h2>
          </div>
          <div className="tools">
            <div className="segment" role="group" aria-label="Preview size">
              {FRAMES.map((frame) => (
                <button
                  key={frame.id}
                  type="button"
                  aria-pressed={state.frame === frame.id}
                  onClick={() => setState((current) => ({ ...current, frame: frame.id }))}
                >
                  {frame.label}
                  <small>{frame.detail}</small>
                </button>
              ))}
            </div>
            <div className="segment" role="group" aria-label="Stage background">
              {(['dark', 'light'] as StageTone[]).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  aria-pressed={state.stage === tone}
                  onClick={() => setState((current) => ({ ...current, stage: tone }))}
                >
                  {tone === 'dark' ? 'Dark' : 'Light'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="transport"
              disabled={!effect.animates || effect.isStatic(values)}
              onClick={() => setState((current) => ({ ...current, paused: !current.paused }))}
            >
              {transportLabel}
            </button>
            <button
              type="button"
              className={state.overlay ? 'overlay-toggle is-on' : 'overlay-toggle'}
              aria-pressed={state.overlay}
              onClick={() => setState((current) => ({ ...current, overlay: !current.overlay }))}
            >
              Sample UI
            </button>
          </div>
        </header>

        <div className={`stage stage-${state.stage}`}>
          <div className={`frame frame-${state.frame}`}>
            {gpu ? (
              <LiveCanvas
                effect={effect}
                values={values}
                paused={state.paused}
                onError={setError}
              />
            ) : (
              <div className="gpu-missing">
                <p>This browser has no WebGPU.</p>
                <p>
                  Effects Lab draws the library's WGSL on a real GPU. Open it in a current desktop
                  version of Chrome, Edge, or Safari.
                </p>
              </div>
            )}
            {error ? <p className="preview-error" role="alert">{error}</p> : null}
            {state.overlay ? (
              <div className="sample-ui" aria-hidden="true">
                <p className="sample-kicker">Nolume</p>
                <p className="sample-title">Tonight's number</p>
                <p className="sample-body">A card on the effect, so type and a button stay readable.</p>
                <span className="sample-button">Continue</span>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      <aside className="panel control-panel">
        <div className="control-scroll">
        <section className="presets">
          <div className="section-head">
            <h3>Presets</h3>
          </div>
          <div className="preset-row" role="group" aria-label="Color presets">
            {PALETTES.map((palette) => (
              <button
                key={palette.id}
                type="button"
                className={presetId === palette.id ? 'preset is-active' : 'preset'}
                aria-pressed={presetId === palette.id}
                onClick={() => choosePreset(palette.id)}
              >
                <span className="dots">
                  {palette.colors.map((color, index) => {
                    const used = effect.controls.some(
                      (control) => control.kind === 'color' && control.presetIndex === index,
                    )
                    return (
                      <span
                        key={`${palette.id}-${index}`}
                        className={used ? 'dot is-used' : 'dot'}
                        style={{ background: color }}
                        title={used ? `${color} is used` : `${color} is not used by this effect`}
                      />
                    )
                  })}
                </span>
                <span className="preset-copy">
                  <span>{palette.screen}</span>
                  <span className="preset-tone">{palette.tone}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              className={presetId === 'custom' ? 'preset preset-wide is-active' : 'preset preset-wide'}
              aria-pressed={presetId === 'custom'}
              onClick={() => choosePreset('custom')}
            >
              <span className="dots">
                {effect.controls.filter((control): control is ColorControl => control.kind === 'color').map((control) => (
                  <span
                    key={control.key}
                    className="dot is-used"
                    style={{
                      background: formatCssColor(
                        String(values[control.key]),
                        control.alpha ? Number(values[`${control.key}Alpha`]) : undefined,
                      ),
                    }}
                  />
                ))}
              </span>
              <span>Custom</span>
            </button>
          </div>
          <p className="hint">{presetHint(effect)}</p>
        </section>

        <section className="controls">
          <div className="section-head">
            <h3>Controls</h3>
            <button type="button" className="text-button" onClick={reset}>
              Reset to defaults
            </button>
          </div>
          <p className="hint">{effect.note}</p>
          <p className="hint">Sliders cover a useful range. The component itself does not clamp these numbers.</p>
          <div className="control-list">
            {effect.controls.map((control) => (
              control.kind === 'color' ? (
                <ColorControlInput
                  key={control.key}
                  control={control}
                  values={values}
                  onChange={changeValue}
                />
              ) : (
                <NumberControlInput
                  key={control.key}
                  control={control}
                  value={Number(values[control.key])}
                  onChange={(value) => changeValue(control.key, value)}
                />
              )
            ))}
          </div>
        </section>
        </div>

        <section className="export">
          <div className="section-head">
            <h3>Export</h3>
            <div className="segment compact" role="group" aria-label="Snippet format">
              <button type="button" aria-pressed={exportKind === 'tsx'} onClick={() => setExportKind('tsx')}>
                TSX
              </button>
              <button type="button" aria-pressed={exportKind === 'json'} onClick={() => setExportKind('json')}>
                JSON
              </button>
            </div>
          </div>
          <div className="export-actions">
            <button type="button" className="primary" onClick={() => void copy('tsx')}>
              Copy React Native code
            </button>
            <button type="button" onClick={() => void copy('json')}>
              Copy configuration JSON
            </button>
          </div>
          {copyNote ? <p className="copy-note" role="status">{copyNote}</p> : null}
          <pre className="snippet">{snippet}</pre>
        </section>
      </aside>
    </div>
  )
}

function presetHint(effect: EffectDef): string {
  const labels = effect.controls
    .filter((control): control is ColorControl => control.kind === 'color')
    .map((control) => control.label.toLowerCase())
  if (labels.length === 1) return `A preset sets the ${labels[0]} only. Faded swatches are unused.`
  return `A preset sets ${labels.join(' and ')} only. Faded swatches are unused.`
}

function LiveCanvas({
  effect,
  values,
  paused,
  onError,
}: {
  effect: EffectDef
  values: ValueMap
  paused: boolean
  onError: (message: string | null) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<PreviewRenderer | null>(null)
  const stateRef = useRef({ effect, values, paused })
  const onErrorRef = useRef(onError)
  stateRef.current = { effect, values, paused }
  onErrorRef.current = onError

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const renderer = new PreviewRenderer(
      canvas,
      () => buildDrawState(stateRef.current.effect, stateRef.current.values, stateRef.current.paused),
      (message) => onErrorRef.current(message),
    )
    rendererRef.current = renderer
    void renderer.start()
    const unsubscribe = subscribeGpuErrors((message) => onErrorRef.current(message))
    return () => {
      unsubscribe()
      renderer.dispose()
      rendererRef.current = null
    }
  }, [])

  useLayoutEffect(() => {
    rendererRef.current?.requestUpdate()
  })

  return <canvas ref={canvasRef} aria-label={`${effect.label} preview`} />
}

function ColorControlInput({
  control,
  values,
  onChange,
}: {
  control: ColorControl
  values: ValueMap
  onChange: (key: string, value: string | number) => void
}) {
  const value = String(values[control.key] ?? control.default)
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const shown = focused ? draft : value

  return (
    <div className="control">
      <div className="control-label">
        <span>{control.label}</span>
        <code>{control.key}</code>
      </div>
      <div className="color-row">
        <input
          type="color"
          aria-label={control.label}
          value={normalizeHex(value) ?? '#000000'}
          onChange={(event) => {
            const hex = normalizeHex(event.target.value)
            if (hex) onChange(control.key, hex)
          }}
        />
        <input
          className="hex"
          spellCheck={false}
          aria-label={`${control.label} hex`}
          value={shown}
          onFocus={() => {
            setDraft(value)
            setFocused(true)
          }}
          onBlur={() => {
            setFocused(false)
            const hex = normalizeHex(draft)
            if (hex) onChange(control.key, hex)
          }}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            const hex = normalizeHex(next)
            if (hex) onChange(control.key, hex)
          }}
        />
      </div>
      {control.alpha ? (
        <NumberControlInput
          control={{
            kind: 'number',
            key: 'alpha',
            label: 'Edge alpha',
            default: control.defaultAlpha ?? 1,
            min: 0,
            max: 1,
            step: 0.01,
          }}
          value={Number(values[`${control.key}Alpha`])}
          onChange={(alpha) => onChange(`${control.key}Alpha`, alpha)}
        />
      ) : null}
    </div>
  )
}

function NumberControlInput({
  control,
  value,
  onChange,
}: {
  control: NumberControl
  value: number
  onChange: (value: number) => void
}) {
  const set = (next: number) => {
    if (!Number.isFinite(next)) return
    onChange(quantize(next, control.min, control.max, control.step))
  }

  return (
    <div className="control">
      <div className="control-label">
        <span>{control.label}</span>
        <code>{control.key}</code>
      </div>
      <div className="slider-row">
        <input
          type="range"
          aria-label={control.label}
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          onChange={(event) => set(event.target.valueAsNumber)}
        />
        <input
          type="number"
          aria-label={`${control.label} value`}
          min={control.min}
          max={control.max}
          step={control.step}
          value={value}
          onChange={(event) => set(event.target.valueAsNumber)}
        />
        {control.unit ? <span className="unit">{control.unit}</span> : null}
      </div>
    </div>
  )
}
