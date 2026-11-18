import os
from PIL import Image
import numpy as np

def autocrop_transparent(img_path, output_path, padding_percent=0.03):
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img)
    alpha = data[:, :, 3]
    
    # Find bounding box of non-zero alpha
    non_zero = np.argwhere(alpha > 10)
    if non_zero.size == 0:
        print(f"Skipping empty image: {img_path}")
        return
        
    y_min, x_min = non_zero.min(axis=0)
    y_max, x_max = non_zero.max(axis=0)
    
    h = y_max - y_min
    w = x_max - x_min
    
    pad_h = int(h * padding_percent)
    pad_w = int(w * padding_percent)
    
    crop_y0 = max(0, y_min - pad_h)
    crop_y1 = min(img.height, y_max + pad_h)
    crop_x0 = max(0, x_min - pad_w)
    crop_x1 = min(img.width, x_max + pad_w)
    
    cropped = img.crop((crop_x0, crop_y0, crop_x1, crop_y1))
    cropped.save(output_path, "PNG")
    print(f"Autocropped {os.path.basename(img_path)}: Original {img.size} -> BBox ({w}x{h}) -> Saved {cropped.size}")

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
    for name in car_files:
        p = os.path.join(assets_dir, name)
        if os.path.exists(p):
            autocrop_transparent(p, p)
