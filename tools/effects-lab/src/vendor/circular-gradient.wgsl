// Source: react-native-effects (MIT License)
// Copyright (c) 2026 Blazej Kustra
// https://github.com/blazejkustra/react-native-effects
// Commit 388bc530ffd01ad958acdfce0e40d36979a8ebe4 (published as 0.3.0)
// Copied verbatim so this lab renders the same WGSL as the native components.

struct Uniforms {
  resolution: vec4<f32>,
  time:       vec4<f32>,
  color0:     vec4<f32>,
  color1:     vec4<f32>,
  params0:    vec4<f32>,
  params1:    vec4<f32>,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

@fragment
fn main(@location(0) ndc: vec2<f32>) -> @location(0) vec4<f32> {
  let uv = (ndc * 0.5) + vec2<f32>(0.5, 0.5);

  let center = u.params0.xy;
  let size = u.params0.zw;

  let diff = uv - center;
  let normalizedDiff = diff / size;
  let dist = length(normalizedDiff);

  let t = smoothstep(0.0, 1.0, dist);
  let color = mix(u.color0, u.color1, t);
  return color;
}
