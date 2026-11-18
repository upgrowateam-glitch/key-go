import os
from PIL import Image
import numpy as np

brain_dir = r"C:\Users\Lenovo\.gemini\antigravity\brain\148b3a7d-a6e5-4eb8-b554-3274558a068e"
assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"

files = {
  "hero_car_fallback.png": "hero_car_front_1790311292286.png",
  "turntable_0.png": "turntable_000_1790311555189.png",
  "turntable_1.png": "turntable_045_1790311572594.png",
  "turntable_2.png": "turntable_090_1790312287762.png",
  "turntable_3.png": "turntable_180_1790312306964.png",
  "turntable_4.png": "turntable_270_1790312328863.png",
}

for out_name, src_name in files.items():
  src_p = os.path.join(brain_dir, src_name)
  out_p = os.path.join(assets_dir, out_name)

  if not os.path.exists(src_p):
    print(f"MISSING SOURCE: {src_name}")
    continue

  img = Image.open(src_p).convert("RGBA")
  arr = np.array(img)

  r = arr[:, :, 0].astype(float)
  g = arr[:, :, 1].astype(float)
  b = arr[:, :, 2].astype(float)

  # Background is studio room (dark walls / neon lines)
  # Background walls are near black (r<25, g<25, b<30) or neon ceiling lines (y < 42% height)
  h, w = arr.shape[:2]

  # Mask studio room ceiling (top 38% of frame where neon studio lights are)
  ceiling_mask = np.zeros((h, w), dtype=bool)
  ceiling_mask[: int(h * 0.40), :] = True

  # Bright green neon ceiling lights: G > 140, R > 100, B < 120
  is_neon_green = (g > 130) & (r > 90) & (b < 120)

  # Purple room pillars: B > 120, R > 60, G < 100
  is_purple_pillar = (b > 120) & (r > 60) & (g < 110)

  # Dark room background: max(R,G,B) < 22
  is_dark_bg = np.maximum(np.maximum(r, g), b) < 18

  # Wipe background noise outside the main supercar body
  arr[ceiling_mask & (is_neon_green | is_purple_pillar | is_dark_bg), 3] = 0
  arr[is_dark_bg, 3] = 0

  # Clear 3-px outer ring
  arr[:4, :, 3] = 0
  arr[-4:, :, 3] = 0
  arr[:, :4, 3] = 0
  arr[:, -4:, 3] = 0

  # Find non-zero alpha bounding box
  alpha = arr[:, :, 3]
  nz = np.argwhere(alpha > 20)

  if len(nz) > 0:
    ymin, xmin = nz.min(axis=0)
    ymax, xmax = nz.max(axis=0)

    crop = Image.fromarray(arr).crop((xmin, ymin, xmax, ymax))

    # Center crop onto 900x500 canvas
    canvas_w, canvas_h = 900, 500
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    crop.thumbnail(
        (int(canvas_w * 0.88), int(canvas_h * 0.82)), Image.Resampling.LANCZOS
    )

    px = (canvas_w - crop.width) // 2
    py = (canvas_h - crop.height) // 2 + 10

    canvas.paste(crop, (px, py), crop)
    canvas.save(out_p, "PNG")

    print(
        f"Processed {out_name} from {src_name}: crop={crop.size}, canvas=900x500"
    )
  else:
    print(f"FAILED TO EXTRACT CAR FROM {src_name}")
