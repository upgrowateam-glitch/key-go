import os
from PIL import Image
import numpy as np

src_path = r"d:\upgrowa-workspace\rental-car\assets\images\car_ossia_luxe.png"
dst_path = r"d:\upgrowa-workspace\rental-car\assets\images\hero_car_fallback.png"

img = Image.open(src_path).convert("RGBA")
arr = np.array(img, dtype=np.uint8)

# Threshold alpha: any pixel with alpha < 15 is set to 0 alpha
arr[arr[:, :, 3] < 15, 3] = 0

# Trim tight to supercar body & wheels
alpha = arr[:, :, 3]
nz = np.argwhere(alpha > 10)
ymin, xmin = nz.min(axis=0)
ymax, xmax = nz.max(axis=0)

car_crop = Image.fromarray(arr).crop((xmin, ymin, xmax, ymax))

# Canvas 900x500
canvas_w, canvas_h = 900, 500
canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

# Scale car crop (fit inside 86% width, 76% height)
car_crop.thumbnail(
    (int(canvas_w * 0.86), int(canvas_h * 0.76)), Image.Resampling.LANCZOS
)

# Center horizontally and position vertically over the hero ring
px = (canvas_w - car_crop.width) // 2
py = (canvas_h - car_crop.height) // 2 + 10

canvas.paste(car_crop, (px, py), car_crop)

# Clear 6-pixel outer border ring to guarantee 0 border alpha
c_arr = np.array(canvas)
c_arr[:6, :, 3] = 0
c_arr[-6:, :, 3] = 0
c_arr[:, :6, 3] = 0
c_arr[:, -6:, 3] = 0

out_img = Image.fromarray(c_arr)
out_img.save(dst_path, "PNG")

# 1. VERIFY ALPHA CORNERS & BORDER
c_alpha = c_arr[:, :, 3]
top_a = c_alpha[0, :].max()
bot_a = c_alpha[-1, :].max()
left_a = c_alpha[:, 0].max()
right_a = c_alpha[:, -1].max()
border_max_alpha = max(top_a, bot_a, left_a, right_a)

# 2. VERIFY COMPOSITION OVER WHITE BACKGROUND (#ffffff)
white_bg = np.ones_like(c_arr) * 255
white_comp = (
    c_arr[:, :, :3] * (c_alpha[:, :, None] / 255.0)
    + white_bg[:, :, :3] * (1.0 - c_alpha[:, :, None] / 255.0)
).astype(np.uint8)

# 3. VERIFY COMPOSITION OVER BLACK BACKGROUND (#000000)
black_comp = (c_arr[:, :, :3] * (c_alpha[:, :, None] / 255.0)).astype(np.uint8)

# 4. CHECK GREEN BACKDROP PIXELS
r = c_arr[:, :, 0].astype(float)
g = c_arr[:, :, 1].astype(float)
b = c_arr[:, :, 2].astype(float)
green_backdrop_px = (
    (c_alpha > 50) & (g > 80) & (r < 70) & (b < 70) & (c_arr[:, :, 1] > 100)
).sum()

print("=== VERIFICATION REPORT FOR NEW HERO ASSET ===")
print(f"File Path: {dst_path}")
print(f"Canvas Dimensions: {canvas_w}x{canvas_h}")
print(f"Car Body Dimensions: {car_crop.width}x{car_crop.height}")
print(f"Border Max Alpha: {border_max_alpha} (Must be 0)")
print(f"Transparent Pixels: {(c_alpha == 0).sum()} / {canvas_w * canvas_h}")
print(f"Green Backdrop Pixels: {green_backdrop_px} (Must be 0)")
print("White Background Composite Corner Pixels:", white_comp[0, 0])
print("Black Background Composite Corner Pixels:", black_comp[0, 0])
