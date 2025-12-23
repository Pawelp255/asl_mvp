# three.js vendor files

Pinned version: three@0.149.0

Files:
- three.min.js (global THREE): https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js
- OrbitControls.js (classic, non-module): https://cdn.jsdelivr.net/npm/three@0.149.0/examples/js/controls/OrbitControls.js

Why:
- Works on GitHub Pages / static hosting without bundlers.
- OrbitControls attaches to window.THREE.OrbitControls and is compatible with three.min.js.

