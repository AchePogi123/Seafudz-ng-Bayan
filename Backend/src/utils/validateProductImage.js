import sharp from 'sharp';

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

export async function validateAndNormalizeProductImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error('Choose a non-empty image no larger than 5 MB.');
  }

  const pipeline = sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  });
  const metadata = await pipeline.metadata();
  const format = metadata.format;
  if (!['jpeg', 'png', 'webp'].includes(format)) {
    throw new Error('Only JPEG, PNG, and WebP images are supported.');
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS) {
    throw new Error('Image dimensions are invalid or exceed the 40-megapixel limit.');
  }

  const outputFormat = format === 'jpeg' ? 'jpeg' : format;
  const normalized = await sharp(buffer, {
    failOn: 'error',
    limitInputPixels: MAX_IMAGE_PIXELS,
  })
    .rotate()
    .toFormat(outputFormat)
    .toBuffer();

  return {
    buffer: normalized,
    extension: format === 'jpeg' ? 'jpg' : format,
    contentType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
  };
}
