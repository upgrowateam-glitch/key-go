import os
from PIL import Image
import numpy as np
from scipy.ndimage import label, binary_closing

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
    print(f"MISSING: {src_name}")
    continue

  img = Image.open(src_p).convert("RGBA")
  data = np.array(img, dtype=np.uint8)
  h, w = data.shape[:2]

  r = data[:, :, 0].astype(float)
  g = data[:, :, 1].astype(float)
  b = data[:, :, 2].astype(float)

  # 1. Zero out studio ceiling lights & wall structures above the car (y < 33% height)
  top_cutoff = int(h * 0.33)
  data[:top_cutoff, :, 3] = 0

  # 2. Zero out upside-down floor reflection below the tires (y > 63% height)
  bot_cutoff = int(h * 0.63)
  data[bot_cutoff:, :, 3] = 0

  # 3. Inside the car band (33% <= y <= 63%), remove studio dark background room pixels
  # Studio background room is dark gray / near black (max(R,G,B) < 26)
  max_c = np.maximum(np.maximum(r, g), b)
  bg_mask = max_c < 24

  # Clear background room pixels
  data[bg_mask, 3] = 0

  # 4. Connected Component Analysis: keep only the largest connected component (the supercar body)
  alpha_mask = data[:, :, 3] > 30

  # Morphological closing to bridge small body reflections/gaps inside car
  closed_mask = binary_closing(alpha_mask, structure=np.ones((5, 5)))
  labeled, num_features = label(closed_mask)

  if num_features > 0:
    sizes = [np.sum(labeled == i) for i in range(1, num_features + 1)]
    max_label = np.argmax(sizes) + 1
    max_size = sizes[max_label - 1]

    # Remove floating noise components (< 5% of max supercar component)
    for i, s in enumerate(sizes, 1):
      if s < max_size * 0.05:
        data[labeled == i, 3] = 0

  # 5. Clear 4-pixel outer border ring to guarantee 0 border alpha
  data[:4, :, 3] = 0
  data[-4:, :, 3] = 0
  data[:, :4, 3] = 0
  data[:, -4:, 3] = 0

  # 6. Trim tight to supercar body & center onto 900x500 canvas
  final_alpha = data[:, :, 3]
  nz = np.argwhere(final_alpha > 15)

  if len(nz) > 0:
    ymin, xmin = nz.min(axis=0)
    ymax, xmax = nz.max(axis=0)

    car_crop = Image.fromarray(data).crop((xmin, ymin, xmax, ymax))

    canvas_w, canvas_h = 900, 500
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

    # Scale car crop cleanly (fit inside 88% canvas width, 75% height)
    car_crop.thumbnail(
        (int(canvas_w * 0.88), int(canvas_h * 0.75)), Image.Resampling.LANCZOS
    )

    # Center horizontally & position vertically over the hero ring
    px = (canvas_w - car_crop.width) // 2
    py = (canvas_h - car_crop.height) // 2 + 5

    canvas.paste(car_crop, (px, py), car_crop)
    canvas.save(out_p, "PNG")

    print(
        f"EXTRACTED CLEAN SUPERCAR CUTOUT {out_name} from {src_name}:"
        f" car_crop={car_crop.size} centered at ({px},{py})"
    )
  else:
    print(f"ERROR: Failed to extract car body from {src_name}")
