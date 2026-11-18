import os
from PIL import Image
import numpy as np

def clean_image_transparency(img_path, output_path):
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img, dtype=np.uint8)
    
    height, width = data.shape[:2]
    
    r = data[:, :, 0].astype(float)
    g = data[:, :, 1].astype(float)
    b = data[:, :, 2].astype(float)
    a = data[:, :, 3].astype(float)
    
    max_c = np.maximum(np.maximum(r, g), b)
    
    # Threshold dark background pixels (< 65 brightness) that are part of studio backdrop/floor
    is_dark = max_c < 65
    
    # 1. Clear 4 outer border margins if they are dark
    # Create mask of background starting from outer 15% edges
    mask = np.zeros((height, width), dtype=bool)
    
    margin_y = int(height * 0.15)
    margin_x = int(width * 0.15)
    
    # Top margin
    mask[:margin_y, :] |= (max_c[:margin_y, :] < 85)
    # Bottom margin
    mask[-margin_y:, :] |= (max_c[-margin_y:, :] < 85)
    # Left margin
    mask[:, :margin_x] |= (max_c[:, :margin_x] < 85)
    # Right margin
    mask[:, -margin_x:] |= (max_c[:, -margin_x:] < 85)
    
    # 2. Also clear any pixel with brightness < 45
    mask |= (max_c < 45)
    
    # Apply alpha = 0
    data[mask, 3] = 0
    
    # Check remaining edge pixels
    alpha = data[:, :, 3]
    top_a, bot_a, left_a, right_a = alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]
    non_zero_edge = (top_a > 0).sum() + (bot_a > 0).sum() + (left_a > 0).sum() + (right_a > 0).sum()
    
    # If any edge pixels remain, clear the 2-pixel outer border completely
    if non_zero_edge > 0:
        data[:3, :, 3] = 0
        data[-3:, :, 3] = 0
        data[:, :3, 3] = 0
        data[:, -3:, 3] = 0
        
    alpha = data[:, :, 3]
    top_a, bot_a, left_a, right_a = alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]
    final_edge = (top_a > 0).sum() + (bot_a > 0).sum() + (left_a > 0).sum() + (right_a > 0).sum()

    out_img = Image.fromarray(data)
    out_img.save(output_path, "PNG")
    print(f"{os.path.basename(img_path)} -> Cleaned! Edge non-zero pixels: {final_edge}")

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    car_files = [
        "car_novara_cross.png",
        "car_voltra_e1.png",
        "car_aurex_gt.png",
        "car_kestrel_s.png",
        "car_meridian.png",
        "car_ossia_luxe.png",
        "hero_car_fallback.png",
        "turntable_0.png",
        "turntable_1.png",
        "turntable_2.png",
        "turntable_3.png",
        "turntable_4.png",
    ]
    for filename in car_files:
        p = os.path.join(assets_dir, filename)
        if os.path.exists(p):
            clean_image_transparency(p, p)
