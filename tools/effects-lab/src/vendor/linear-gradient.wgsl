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
  let uv = ndc * 0.5 + vec2<f32>(0.5, 0.5);
  let baseAngle = u.params0.x;
  let rotationSpeed = u.params0.y;
  let angle = (baseAngle + u.time.x * rotationSpeed) * 3.14159265359 / 180.0;
  let dir = vec2<f32>(cos(angle), sin(angle));
  let fromCenter = uv - vec2<f32>(0.5, 0.5);
  let corrected = vec2<f32>(fromCenter.x * u.resolution.z, fromCenter.y);
  let t = clamp(dot(corrected, dir) + 0.5, 0.0, 1.0);
  return mix(u.color0, u.color1, t);
}
