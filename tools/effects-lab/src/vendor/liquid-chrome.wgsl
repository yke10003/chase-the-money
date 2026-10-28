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

fn renderImage(uvCoord: vec2<f32>) -> vec4<f32> {
  let resolution2D = u.resolution.xy;
  let time = u.time.x;
  let amplitude = u.params0.x;
  let frequencyX = u.params0.y;
  let frequencyY = u.params0.z;

  let fragCoord = uvCoord * resolution2D;
  var uv = (2.0 * fragCoord - resolution2D) / min(u.resolution.x, u.resolution.y);

  for (var i: f32 = 1.0; i < 10.0; i = i + 1.0) {
    uv.x = uv.x + amplitude / i * cos(i * frequencyX * uv.y + time);
    uv.y = uv.y + amplitude / i * cos(i * frequencyY * uv.x + time);
  }

  let baseColor = u.color0;
  let color = baseColor.rgb / abs(sin(time - uv.y - uv.x));
  return vec4<f32>(color, baseColor.a);
}

@fragment
fn main(@location(0) ndc: vec2<f32>) -> @location(0) vec4<f32> {
  let vUv = ndc * 0.5 + vec2<f32>(0.5, 0.5);
  let resolution2D = u.resolution.xy;

  var col = vec4<f32>(0.0);
  var samples = 0;

  for (var i: i32 = -1; i <= 1; i = i + 1) {
    for (var j: i32 = -1; j <= 1; j = j + 1) {
      let offset = vec2<f32>(f32(i), f32(j)) * (1.0 / min(resolution2D.x, resolution2D.y));
      col = col + renderImage(vUv + offset);
      samples = samples + 1;
    }
  }

  return col / f32(samples);
}
