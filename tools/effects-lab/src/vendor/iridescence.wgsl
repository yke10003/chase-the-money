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
  let time = u.time.x;

  let vUv = ndc * 0.5 + vec2<f32>(0.5, 0.5);
  let mr = min(u.resolution.x, u.resolution.y);
  var uv = (vUv * 2.0 - vec2<f32>(1.0, 1.0)) * (u.resolution.xy / mr);

  var d = -time * 0.5;
  var a = 0.0;
  for (var i: f32 = 0.0; i < 8.0; i = i + 1.0) {
    a = a + cos(i - d - a * uv.x);
    d = d + sin(uv.y * i + a);
  }
  d = d + time * 0.5;

  let c1 = cos(uv * vec2<f32>(d, a)) * 0.6 + 0.4;
  let c2 = cos(a + d) * 0.5 + 0.5;
  let col = vec3<f32>(c1.x, c1.y, c2);

  let finalCol = cos(col * cos(vec3<f32>(d, a, 2.5)) * 0.5 + 0.5);
  let coloredCol = finalCol * u.color0.rgb;
  return vec4<f32>(clamp(coloredCol, vec3<f32>(0.0), vec3<f32>(1.0)), u.color0.a);
}
