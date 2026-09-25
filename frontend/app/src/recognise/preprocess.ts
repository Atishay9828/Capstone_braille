/**
 * Turning a photograph into something a maths-recognition model can read.
 *
 * This is where most of the accuracy lives. The model was trained on tightly-cropped formula
 * images on white; a phone photo of a notebook is none of those things. Four steps fix that, and
 * skipping any one of them noticeably degrades the result:
 *
 *   1. **Grayscale** — colour carries no information about a pencil stroke.
 *   2. **Auto-invert by histogram** — a whiteboard photographed under a projector, or a photo
 *      taken in "dark mode", arrives as light ink on dark. Counting dark against light pixels and
 *      flipping when needed means the user never has to know or care.
 *   3. **Crop to the ink** — a formula occupying 10% of the frame is 10% of the model's attention.
 *      Cropping to the bounding box of the marks is the single biggest win on real photos.
 *   4. **Letterbox to 384×384 and normalise** — the model's expected input, padded on white so the
 *      aspect ratio is never distorted.
 *
 * The recipe follows the reference implementation credited in THIRD_PARTY.md; the code is ours.
 */

/** The model's input size and the normalisation it was trained with. */
export const TARGET_SIZE = 384;
export const NORM_MEAN = 0.7931;
export const NORM_STD = 0.1738;

/** Pixels darker than this count as ink. */
const INK_THRESHOLD = 200;

/** Ink is padded by this fraction of the crop before letterboxing, so strokes are not clipped. */
const CROP_PADDING = 0.06;

export interface PreparedImage {
  /** Normalised single-channel pixels, TARGET_SIZE², row-major. */
  readonly pixels: Float32Array;
  /** True when the source was light-on-dark and had to be inverted. */
  readonly inverted: boolean;
  /** How much of the original frame the ink actually occupied, 0–1. Low values mean a distant photo. */
  readonly inkCoverage: number;
  /** False when the image appears to be blank — the caller should say so rather than guess. */
  readonly hasContent: boolean;
}

/** Anything we can draw: a URL, a data URL, a File/Blob, or a canvas. */
export type ImageSource = Blob | string;

export interface PrepareOptions {
  /**
   * How hard to push the greys apart before cropping. 1 leaves the image alone.
   *
   * A pencil photographed in a classroom is grey on grey; the model was trained on crisp black on
   * white. Raising this darkens what is already dark and lightens what is already light, which is
   * the difference between a stroke and a shadow. Used for the *second* reading of an image the
   * recogniser was unsure about — see `RecognisePanel`.
   */
  readonly contrast?: number;
}

/**
 * A levels curve about mid-grey, clamped.
 *
 * Deliberately linear rather than an S-curve: a soft curve flatters photographs and loses the
 * faintest strokes, which are exactly the ones this exists to rescue.
 */
export function applyContrast(value: number, contrast: number): number {
  if (contrast === 1) return value;
  const shifted = (value - 128) * contrast + 128;
  return Math.max(0, Math.min(255, Math.round(shifted)));
}

interface Decoded {
  readonly image: CanvasImageSource;
  readonly width: number;
  readonly height: number;
  readonly release: () => void;
}

/**
 * Decode an image to something drawable.
 *
 * Deliberately an `<img>` element rather than `createImageBitmap`: Chrome refuses SVG blobs in
 * `createImageBitmap`, and Braillix's own sample images are SVG. Going through an image element
 * handles SVG, PNG, JPEG and a phone's HEIC-transcoded output identically, which is worth more
 * than the small speed advantage of the bitmap path.
 */
function decode(source: ImageSource): Promise<Decoded> {
  const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source);
  const src = objectUrl ?? (source as string);

  return new Promise<Decoded>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';

    image.onload = () => {
      // An SVG without intrinsic dimensions reports 0; give it a sensible canvas to draw into
      // rather than failing on a file that a browser would happily display.
      const width = image.naturalWidth || image.width || 640;
      const height = image.naturalHeight || image.height || 240;
      resolve({
        image,
        width,
        height,
        release: () => {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
        },
      });
    };

    image.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('that image could not be decoded — try a PNG or JPEG'));
    };

    image.src = src;
  });
}

function makeCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(canvas: OffscreenCanvas | HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error('this browser would not give us a 2D canvas');
  return ctx;
}

/**
 * Decide whether the image is light-on-dark.
 *
 * Counting pixels below and above the ink threshold is crude but robust: a photo of a page is
 * overwhelmingly light, a photo of a blackboard overwhelmingly dark, and the ratio says which.
 */
function shouldInvert(grey: Uint8Array): boolean {
  let dark = 0;
  for (const value of grey) if (value < INK_THRESHOLD) dark += 1;
  return dark * 2 > grey.length;
}

/** Bounding box of everything darker than the threshold. */
function inkBounds(grey: Uint8Array, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (grey[y * width + x] < INK_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1, found: false };
  return { minX, minY, maxX, maxY, found: true };
}

/** Prepare an image for the recognition model. */
export async function prepareImage(source: ImageSource, options: PrepareOptions = {}): Promise<PreparedImage> {
  const decoded = await decode(source);
  const { width, height } = decoded;

  const sourceCanvas = makeCanvas(width, height);
  const sourceCtx = context2d(sourceCanvas);
  // White first: a PNG with transparency would otherwise read as solid black ink.
  sourceCtx.fillStyle = '#ffffff';
  sourceCtx.fillRect(0, 0, width, height);
  sourceCtx.drawImage(decoded.image, 0, 0, width, height);
  decoded.release();

  const rgba = sourceCtx.getImageData(0, 0, width, height).data;

  const grey = new Uint8Array(width * height);
  for (let i = 0; i < grey.length; i += 1) {
    // Rec. 601 luma — matches how the model's training data was converted.
    grey[i] = Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }

  const inverted = shouldInvert(grey);
  if (inverted) {
    for (let i = 0; i < grey.length; i += 1) grey[i] = 255 - grey[i];
  }

  // After inverting, so the curve always works on dark-ink-on-light.
  const contrast = options.contrast ?? 1;
  if (contrast !== 1) {
    for (let i = 0; i < grey.length; i += 1) grey[i] = applyContrast(grey[i], contrast);
  }

  const bounds = inkBounds(grey, width, height);
  const rawW = bounds.maxX - bounds.minX + 1;
  const rawH = bounds.maxY - bounds.minY + 1;

  // A little breathing room, because strokes have soft edges and the crop is a hard one.
  const padX = Math.round(rawW * CROP_PADDING);
  const padY = Math.round(rawH * CROP_PADDING);
  const cropX = Math.max(0, bounds.minX - padX);
  const cropY = Math.max(0, bounds.minY - padY);
  const cropW = Math.min(width - cropX, rawW + padX * 2);
  const cropH = Math.min(height - cropY, rawH + padY * 2);

  const cropCanvas = makeCanvas(cropW, cropH);
  const cropCtx = context2d(cropCanvas);
  const cropData = cropCtx.createImageData(cropW, cropH);
  for (let y = 0; y < cropH; y += 1) {
    for (let x = 0; x < cropW; x += 1) {
      const value = grey[(y + cropY) * width + (x + cropX)];
      const index = (y * cropW + x) * 4;
      cropData.data[index] = value;
      cropData.data[index + 1] = value;
      cropData.data[index + 2] = value;
      cropData.data[index + 3] = 255;
    }
  }
  cropCtx.putImageData(cropData, 0, 0);

  // Letterbox: scale to fit, centre, pad with white. Never stretch — a squashed radical is a
  // different symbol as far as the model is concerned.
  const scale = Math.min(TARGET_SIZE / cropW, TARGET_SIZE / cropH);
  const drawW = Math.max(1, Math.round(cropW * scale));
  const drawH = Math.max(1, Math.round(cropH * scale));
  const offsetX = Math.floor((TARGET_SIZE - drawW) / 2);
  const offsetY = Math.floor((TARGET_SIZE - drawH) / 2);

  const outCanvas = makeCanvas(TARGET_SIZE, TARGET_SIZE);
  const outCtx = context2d(outCanvas);
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(cropCanvas as CanvasImageSource, offsetX, offsetY, drawW, drawH);

  const outRgba = outCtx.getImageData(0, 0, TARGET_SIZE, TARGET_SIZE).data;
  const pixels = new Float32Array(TARGET_SIZE * TARGET_SIZE);
  for (let i = 0; i < pixels.length; i += 1) {
    pixels[i] = (outRgba[i * 4] / 255 - NORM_MEAN) / NORM_STD;
  }

  return {
    pixels,
    inverted,
    inkCoverage: bounds.found ? (rawW * rawH) / (width * height) : 0,
    hasContent: bounds.found,
  };
}

/**
 * A warning about the photograph itself, or null if it looks usable.
 *
 * Told before recognition rather than after, because "move closer and try again" is far more
 * useful than a confident wrong answer.
 */
export function imageWarning(prepared: PreparedImage): string | null {
  if (!prepared.hasContent) return 'This image looks blank — no dark marks were found.';
  if (prepared.inkCoverage < 0.01) {
    return 'The writing fills very little of the frame. Move closer or crop before trying again.';
  }
  return null;
}
