const iconCache = new Map<string, string>();

interface RGB {
  r: number;
  g: number;
  b: number;
}

function resolveColor(color: string): string {
  if (color.startsWith('var(')) {
    const varName = color.match(/var\(([^)]+)\)/)?.[1];
    if (varName) {
      const computed = getComputedStyle(document.documentElement).getPropertyValue(varName);
      return computed.trim();
    }
  }
  return color;
}

function hexToRgb(hex: string): RGB {
  const resolved = resolveColor(hex);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(resolved);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export async function colorizeIcon(iconUrl: string, color: string): Promise<string> {
  const cacheKey = `${iconUrl}|${color}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const rgb = hexToRgb(color);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha > 0) {
          const originalR = data[i];
          const originalG = data[i + 1];
          const originalB = data[i + 2];

          const luminance = (0.299 * originalR + 0.587 * originalG + 0.114 * originalB) / 255;

          data[i] = Math.round(rgb.r * luminance + originalR * 0.3);
          data[i + 1] = Math.round(rgb.g * luminance + originalG * 0.3);
          data[i + 2] = Math.round(rgb.b * luminance + originalB * 0.3);
        }
      }

      ctx.putImageData(imageData, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      iconCache.set(cacheKey, dataUrl);
      resolve(dataUrl);
    };

    img.onerror = () => reject(new Error(`Failed to load icon: ${iconUrl}`));
    img.src = iconUrl;
  });
}
