import os
from PIL import Image
import numpy as np

assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
files = [
    "hero_car_fallback.png",
    "turntable_0.png",
    "turntable_1.png",
    "turntable_2.png",
    "turntable_3.png",
    "turntable_4.png",
]

for fname in files:
    p = os.path.join(assets_dir, fname)
    img = Image.open(p)
    arr = np.array(img)
    alpha = arr[:, :, 3]

    top_edge = (alpha[0, :] > 0).sum()
    bot_edge = (alpha[-1, :] > 0).sum()
    left_edge = (alpha[:, 0] > 0).sum()
    right_edge = (alpha[:, -1] > 0).sum()

    border_total = top_edge + bot_edge + left_edge + right_edge
    non_zero_px = (alpha > 0).sum()

    nz = np.argwhere(alpha > 10)
    if len(nz) > 0:
        ymin, xmin = nz.min(axis=0)
        ymax, xmax = nz.max(axis=0)
        w = xmax - xmin
        h = ymax - ymin
        print(f"{fname:22s}: size={img.size}, car_bounds=({xmin},{ymin}) to ({xmax},{ymax}), w={w}, h={h}, border_nonzero={border_total}, supercar_body_px={non_zero_px}")
    else:
        print(f"ERROR: {fname} has 0 non-zero alpha!")
