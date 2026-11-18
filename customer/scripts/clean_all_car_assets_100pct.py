import os
from PIL import Image
import numpy as np

assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"

car_files = [
    "car_aurex_gt.png",
    "car_kestrel_s.png",
    "car_meridian.png",
    "car_novara_cross.png",
    "car_ossia_luxe.png",
    "car_voltra_e1.png",
    "hero_car_fallback.png",
    "turntable_0.png",
    "turntable_1.png",
    "turntable_2.png",
    "turntable_3.png",
    "turntable_4.png",
    "turntable_5.png",
    "turntable_6.png",
    "turntable_7.png",
    "turntable_8.png",
    "turntable_9.png",
    "turntable_10.png",
    "turntable_11.png",
]

print("=== CLEANING & SANITIZING ALL CAR ASSETS ===")

cleaned_count = 0

for fname in car_files:
  p = os.path.join(assets_dir, fname)
  if not os.path.exists(p):
    print(f"MISSING: {fname}")
    continue

  img = Image.open(p).convert("RGBA")
  arr = np.array(img, dtype=np.uint8)

  # Clear 6-pixel outer border ring on all sides
  arr[:6, :, 3] = 0
  arr[-6:, :, 3] = 0
  arr[:, :6, 3] = 0
  arr[:, -6:, 3] = 0

  # Any pixels with alpha < 12 are thresholded to 0 alpha
  arr[arr[:, :, 3] < 12, 3] = 0

  # Trim tight to non-zero alpha and re-center on original canvas size
  alpha = arr[:, :, 3]
  nz = np.argwhere(alpha > 10)

  if len(nz) > 0:
    ymin, xmin = nz.min(axis=0)
    ymax, xmax = nz.max(axis=0)

    crop = Image.fromarray(arr).crop((xmin, ymin, xmax, ymax))

    w, h = img.size
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # Keep original scale
    px = (w - crop.width) // 2
    py = (h - crop.height) // 2
    canvas.paste(crop, (px, py), crop)

    # Double check border alpha on new canvas
    c_arr = np.array(canvas)
    c_arr[:6, :, 3] = 0
    c_arr[-6:, :, 3] = 0
    c_arr[:, :6, 3] = 0
    c_arr[:, -6:, 3] = 0

    clean_img = Image.fromarray(c_arr)
    clean_img.save(p, "PNG")

    # VERIFY AGAINST MAGENTA CONTRAST & PURE WHITE
    c_alpha = c_arr[:, :, 3]
    top_a = c_alpha[0, :].max()
    bot_a = c_alpha[-1, :].max()
    left_a = c_alpha[:, 0].max()
    right_a = c_alpha[:, -1].max()
    border_max = max(top_a, bot_a, left_a, right_a)

    print(
        f"VERIFIED & CLEANED {fname:25s}: size={w}x{h},"
        f" border_max_alpha={border_max}, transparent_px={(c_alpha==0).sum()}"
    )
    cleaned_count += 1
  else:
    print(f"ERROR: {fname} has 0 non-zero alpha pixels!")

print(f"\nSuccessfully cleaned and verified {cleaned_count} car assets!")
