import { existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';

const NEWS_IMAGE_TYPES = new Set(['news-cover', 'news-image', 'news-file']);
const SKIP_MIME = new Set(['image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);

type OptimizeInput = {
  type: string;
  absolutePath: string;
  filename: string;
  mimetype?: string;
};

type OptimizeResult = {
  filename: string;
  absolutePath: string;
  changed: boolean;
};

/**
 * Re-encode news stills to WebP for lighter LCP without changing upload flow.
 * GIF/video stay as uploaded. Already-webp files are left alone.
 */
export const optimizeNewsUpload = async (input: OptimizeInput): Promise<OptimizeResult> => {
  const type = String(input.type || '');
  const mime = String(input.mimetype || '').toLowerCase();
  if (!NEWS_IMAGE_TYPES.has(type) || SKIP_MIME.has(mime)) {
    return { filename: input.filename, absolutePath: input.absolutePath, changed: false };
  }
  if (!existsSync(input.absolutePath)) {
    return { filename: input.filename, absolutePath: input.absolutePath, changed: false };
  }

  let sharp: ((path: string) => {
    rotate: () => any;
  }) | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('sharp');
    sharp = typeof mod === 'function' ? mod : mod.default;
  } catch {
    return { filename: input.filename, absolutePath: input.absolutePath, changed: false };
  }
  if (!sharp) {
    return { filename: input.filename, absolutePath: input.absolutePath, changed: false };
  }

  const nextName = input.filename.replace(/\.(jpe?g|png)$/i, '.webp');
  if (nextName === input.filename) {
    return { filename: input.filename, absolutePath: input.absolutePath, changed: false };
  }

  const nextPath = join(dirname(input.absolutePath), nextName);
  const isCover = type === 'news-cover';

  try {
    let pipeline = sharp(input.absolutePath).rotate();
    if (isCover) {
      pipeline = pipeline.resize({
        width: 1600,
        height: 900,
        fit: 'inside',
        withoutEnlargement: true,
      });
    } else {
      pipeline = pipeline.resize({
        width: 1600,
        withoutEnlargement: true,
      });
    }
    await pipeline.webp({ quality: 78, effort: 4 }).toFile(nextPath);
    try {
      unlinkSync(input.absolutePath);
    } catch {
      /* keep original if delete fails */
    }
    return { filename: nextName, absolutePath: nextPath, changed: true };
  } catch {
    return { filename: input.filename, absolutePath: input.absolutePath, changed: false };
  }
};

export const publicAdminUploadPath = (type: string, filename: string) =>
  `/uploads/admin/${type}/${filename}`;
