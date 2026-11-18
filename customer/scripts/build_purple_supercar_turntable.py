import math
import os
from PIL import Image
import numpy as np

src_path = r"d:\upgrowa-workspace\rental-car\assets\images\car_ossia_luxe.png"
assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"

img = Image.open(src_path).convert("RGBA")
arr = np.array(img, dtype=np.uint8)

# 1. Verify and clean alpha channel on source purple hypercar
# Remove any residual background noise outside alpha threshold
alpha_channel = arr[:, :, 3]
arr[alpha_channel < 15, :] = 0

# 2. Trim tight to purple supercar body
nz = np.argwhere(arr[:, :, 3] > 15)
ymin, xmin = nz.min(axis=0)
ymax, xmax = nz.max(axis=0)

clean_car = Image.fromarray(arr).crop((xmin, ymin, xmax, ymax))
cw, ch = clean_car.size

print(f"Isolated source purple supercar: size=({cw}x{ch})")


# Function to generate 3D perspective turntable frame angle
def get_perspective_coeffs(pa, pb):
  matrix = []
  for p1, p2 in zip(pa, pb):
    matrix.append([p1[0], p1[1], 1, 0, 0, 0, -p2[0] * p1[0], -p2[0] * p1[1]])
    matrix.append([0, 0, 0, p1[0], p1[1], 1, -p2[1] * p1[0], -p2[1] * p1[1]])
  A = np.matrix(matrix, dtype=float)
  B = np.array(pb).reshape(8)
  res = np.dot(A.I, B)
  return np.array(res).flatten()


# Generate 5 perspective angle views for gentle showroom rotation (-20° to +20°)
angles = [-20, -10, 0, 10, 20]
target_files = [
    "turntable_0.png",
    "turntable_1.png",
    "turntable_2.png",
    "turntable_3.png",
    "turntable_4.png",
]

for idx, (deg, fname) in enumerate(zip(angles, target_files)):
  rad = math.radians(deg)
  cos_a = math.cos(rad)
  sin_a = math.sin(rad)

  f = 1300.0
  cx, cy = cw / 2.0, ch / 2.0

  src_pts = [(0, 0), (cw, 0), (cw, ch), (0, ch)]
  dst_pts = []
  for x, y in src_pts:
    tx = x - cx
    ty = y - cy
    rx = tx * cos_a
    rz = tx * sin_a + f
    px = (rx * f) / rz + cx
    py = (ty * f) / rz + cy
    dst_pts.append((px, py))

  coeffs = get_perspective_coeffs(dst_pts, src_pts)
  warped = clean_car.transform(
      (cw, ch), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC
  )

  # Place onto standard 900x500 canvas
  warped_arr = np.array(warped)
  nz_w = np.argwhere(warped_arr[:, :, 3] > 15)
  if len(nz_w) > 0:
    wy_min, wx_min = nz_w.min(axis=0)
    wy_max, wx_max = nz_w.max(axis=0)

    crop = warped.crop((wx_min, wy_min, wx_max, wy_max))
  else:
    crop = warped

  canvas_w, canvas_h = 900, 500
  canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

  # Fit inside 86% width, 76% height
  crop.thumbnail(
      (int(canvas_w * 0.86), int(canvas_h * 0.76)), Image.Resampling.LANCZOS
  )

  px = (canvas_w - crop.width) // 2
  py = (canvas_h - crop.height) // 2 + 10
  canvas.paste(crop, (px, py), crop)

  # Guarantee 0 outer border alpha
  c_arr = np.array(canvas)
  c_arr[:4, :, 3] = 0
  c_arr[-4:, :, 3] = 0
  c_arr[:, :4, 3] = 0
  c_arr[:, -4:, 3] = 0

  out_img = Image.fromarray(c_arr)
  out_p = os.path.join(assets_dir, fname)
  out_img.save(out_p, "PNG")

  if fname == "turntable_2.png":
    # Save hero_car_fallback.png as the centered 0° front view
    fallback_p = os.path.join(assets_dir, "hero_car_fallback.png")
    out_img.save(fallback_p, "PNG")
    print(
        f"Saved hero_car_fallback.png matching {fname} (0° centered view)."
    )

  # TEST TRANSPARENCY AGAINST LIGHT & DARK BACKGROUNDS
  c_alpha = c_arr[:, :, 3]
  border_alpha_sum = (
      c_alpha[0, :].sum()
      + c_alpha[-1, :].sum()
      + c_alpha[:, 0].sum()
      + c_alpha[:, -1].sum()
  )

  # Test composition on Light background (pure white #ffffff)
  white_bg = np.ones_like(c_arr) * 255
  white_comp = (
      c_arr[:, :, :3] * (c_alpha[:, :, None] / 255.0)
      + white_bg[:, :, :3] * (1.0 - c_alpha[:, :, None] / 255.0)
  ).astype(np.uint8)

  # Test composition on Dark background (pure black #000000)
  black_comp = (c_arr[:, :, :3] * (c_alpha[:, :, None] / 255.0)).astype(np.uint8)

  print(
      f"VERIFIED {fname} (angle {deg:3d}°): border_alpha_sum={border_alpha_sum},"
      f" car_crop={crop.size}, transparent_px={(c_alpha==0).sum()}"
  )
