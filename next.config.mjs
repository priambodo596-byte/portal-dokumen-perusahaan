/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // OCR & rasterisasi PDF memakai binari native/wasm; biarkan di-require dari node_modules saat runtime.
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core', 'pdf-to-img', '@napi-rs/canvas', 'pdfjs-dist', 'mammoth'],
}

export default nextConfig
