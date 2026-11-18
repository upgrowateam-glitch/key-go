import os
from PIL import Image
import numpy as np

src_path = r"d:\upgrowa-workspace\rental-car\assets\images\car_aurex_gt.png"
dst_path = r"d:\upgrowa-workspace\rental-car\assets\images\hero_car_fallback.png"

img = Image.open(src_path).convert("RGBA")
arr = np.array(img)

# Crop tight to non-zero alpha
alpha = arr[:, :, 3]
nz = np.argwhere(alpha > 20)
ymin, xmin = nz.min(axis=0)
ymax, xmax = nz.max(axis=0)

car_crop = img.crop((xmin, ymin, xmax, ymax))

# Create 900x500 canvas
canvas_w, canvas_h = 900, 500
canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

# Resize car crop to fit 85% width / 80% height preserving aspect ratio
car_crop.thumbnail((int(canvas_w * 0.85), int(canvas_h * 0.80)), Image.Resampling.LANCZOS)

# Paste centered
px = (canvas_w - car_crop.width) // 2
py = (canvas_h - car_crop.height) // 2 + 10

canvas.paste(car_crop, (px, py), car_crop)
canvas.save(dst_path, "PNG")

print(f"Prepared pristine hero car fallback: size={canvas.size}, car_crop={car_crop.size} centered at ({px},{py})")
