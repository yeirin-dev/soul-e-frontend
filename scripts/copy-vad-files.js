/**
 * Copy VAD (Voice Activity Detection) files to public directory
 * Required files for @ricky0123/vad-web to work in browser
 */

const fs = require('fs');
const path = require('path');

const vadSourceDir = path.join(__dirname, '../node_modules/@ricky0123/vad-web/dist');
const onnxSourceDir = path.join(__dirname, '../node_modules/onnxruntime-web/dist');
const destDir = path.join(__dirname, '../public/vad');

// Create destination directory
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log(`Created directory: ${destDir}`);
}

// VAD files to copy
const vadFiles = [
  'vad.worklet.bundle.min.js',
  'silero_vad_v5.onnx',
  'silero_vad_legacy.onnx',
];

vadFiles.forEach(file => {
  const src = path.join(vadSourceDir, file);
  const dest = path.join(destDir, file);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`Warning: ${file} not found at ${src}`);
  }
});

// ONNX Runtime files (WASM + MJS)
const onnxFiles = [
  // Main WASM + MJS (required)
  'ort-wasm-simd-threaded.wasm',
  'ort-wasm-simd-threaded.mjs',
];

onnxFiles.forEach(file => {
  const src = path.join(onnxSourceDir, file);
  const dest = path.join(destDir, file);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${file}`);
  } else {
    console.warn(`Warning: ${file} not found at ${src}`);
  }
});

console.log('\nVAD files copied successfully!');
console.log(`Destination: ${destDir}`);
