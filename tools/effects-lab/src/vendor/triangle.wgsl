// Source: react-native-effects (MIT License)
// Copyright (c) 2026 Blazej Kustra
// https://github.com/blazejkustra/react-native-effects
// Commit 388bc530ffd01ad958acdfce0e40d36979a8ebe4 (published as 0.3.0)
// Copied verbatim so this lab renders the same WGSL as the native components.

  struct VSOut { 
    @builtin(position) pos: vec4<f32>,
    @location(0) ndc: vec2<f32>,
  };
  
  @vertex 
  fn main(@builtin(vertex_index) vid: u32) -> VSOut {
    var p = array<vec2<f32>,3>(
      vec2<f32>(-1.0,-3.0), vec2<f32>(-1.0,1.0), vec2<f32>(3.0,1.0)
    );
    var o: VSOut;
    o.pos = vec4<f32>(p[vid], 0, 1.0);
    o.ndc = p[vid];
    return o;
  }
