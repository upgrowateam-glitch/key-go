import os
from PIL import Image
import numpy as np

car_files = [
    "turntable_0.png",
    "turntable_1.png",
    "turntable_2.png",
    "turntable_3.png",
    "turntable_4.png",
    "hero_car_fallback.png",
    "car_novara_cross.png",
    "car_voltra_e1.png",
    "car_aurex_gt.png",
    "car_kestrel_s.png",
    "car_meridian.png",
    "car_ossia_luxe.png"
]

assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"

for name in car_files:
    path = os.path.join(assets_dir, name)
    if not os.path.exists(path):
        print(f"MISSING: {name}")
        continue
    img = Image.open(path).convert("RGBA")
    data = np.array(img)
    alpha = data[:, :, 3]
    
    # Check top row, bottom row, left col, right col alpha
    top_a = alpha[0, :]
    bot_a = alpha[-1, :]
    left_a = alpha[:, 0]
    right_a = alpha[:, -1]
    
    max_edge_alpha = max(top_a.max(), bot_a.max(), left_a.max(), right_a.max())
    non_zero_edge = (top_a > 0).sum() + (bot_a > 0).sum() + (left_a > 0).sum() + (right_a > 0).sum()
    
    print(f"{name}: Edge Max Alpha = {max_edge_alpha}, Non-zero Edge Pixels = {non_zero_edge}, Image Shape = {data.shape}")
