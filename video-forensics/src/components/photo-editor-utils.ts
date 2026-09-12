import { EditorState } from './photo-editor-types';

export function drawToCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  state: EditorState,
  isPreview: boolean = false
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const srcW = image.width;
  const srcH = image.height;

  // Calculate crop coordinates based on original image size
  // Ensure we don't crop more than 99% to avoid 0 width/height
  const left = Math.min(state.cropLeft, 99) / 100;
  const right = Math.min(state.cropRight, 99 - left * 100) / 100;
  const top = Math.min(state.cropTop, 99) / 100;
  const bottom = Math.min(state.cropBottom, 99 - top * 100) / 100;

  const cX = left * srcW;
  const cY = top * srcH;
  const cW = Math.max(1, srcW - (left + right) * srcW);
  const cH = Math.max(1, srcH - (top + bottom) * srcH);

  const isRotated = state.rotation === 90 || state.rotation === 270;

  // Destination canvas size matches the final rotated crop dimensions
  const destW = isRotated ? cH : cW;
  const destH = isRotated ? cW : cH;

  // Scale down for preview to maintain performance
  let scale = 1;
  if (isPreview) {
    const MAX_DIM = 2048;
    if (destW > MAX_DIM || destH > MAX_DIM) {
      scale = MAX_DIM / Math.max(destW, destH);
    }
  }

  canvas.width = destW * scale;
  canvas.height = destH * scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Apply filters
  ctx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) grayscale(${state.grayscale}%) sepia(${state.sepia}%)`;

  // Apply transforms: move to center, rotate, flip, move back
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);

  // Draw the cropped region into the transformed context
  ctx.drawImage(
    image,
    cX, cY, cW, cH,
    (-cW * scale) / 2, (-cH * scale) / 2, cW * scale, cH * scale
  );
}
