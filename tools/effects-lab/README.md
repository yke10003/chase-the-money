# Effects lab

A desktop playground for the shaders in [react-native-effects](https://github.com/blazejkustra/react-native-effects) 0.3.0. It does not touch the Nolume app.

The library renders through `react-native-webgpu` on a `react-native-worklets` background runtime, so the components cannot run in a browser. This lab plays the same WGSL through a small WebGPU canvas instead. Shader sources live in `src/vendor/` and keep the upstream MIT license (`LICENSE.react-native-effects`).

```bash
cd tools/effects-lab
npm install
npm run dev
```

Open the URL Vite prints (port 5183). Use a desktop browser with WebGPU (Chrome, Edge, or Safari).

`npm run typecheck` and `npm run build` check the project without starting the server.

The page remembers the last effect and its settings in local storage.
