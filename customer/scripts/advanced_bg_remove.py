import os
from PIL import Image
import numpy as np

def isolate_car_from_dark_studio(img_path, output_path, bg_threshold=45):
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img, dtype=float)
    
    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
    
    # Calculate brightness and color saturation
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = np.where(max_c > 0, (max_c - min_c) / max_c, 0)
    
    # Background in these studio renders is dark and low saturation (gray/black)
    # Background condition: max_c < threshold AND sat < 0.25 (or dark shadow)
    # However, car highlights or metallic chrome might be bright gray/white (sat < 0.2, max_c high)
    # Car body has either high saturation OR is located inside the car central region.
    
    # Floodfill from edges:
    height, width = data.shape[:2]
    is_bg = np.zeros((height, width), dtype=bool)
    
    # Seed corners and borders
    # Border pixels that are dark or low saturation are background
    queue = []
    
    for y in range(height):
        for x in [0, width - 1]:
            if max_c[y, x] < bg_threshold or (max_c[y, x] < bg_threshold + 25 and sat[y, x] < 0.2):
                is_bg[y, x] = True
                queue.append((y, x))
    for x in range(width):
        for y in [0, height - 1]:
            if not is_bg[y, x] and (max_c[y, x] < bg_threshold or (max_c[y, x] < bg_threshold + 25 and sat[y, x] < 0.2)):
                is_bg[y, x] = True
                queue.append((y, x))

    idx = 0
    while idx < len(queue):
        cy, cx = queue[idx]
        idx += 1
        
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < height and 0 <= nx < width and not is_bg[ny, nx]:
                val = max_c[ny, nx]
                s = sat[ny, nx]
                
                # Expand background into dark studio areas or floor shadow
                # We stop if we hit bright parts of the car or colored car paint
                if val < bg_threshold:
                    is_bg[ny, nx] = True
                    queue.append((ny, nx))
                elif val < bg_threshold + 30 and s < 0.25:
                    is_bg[ny, nx] = True
                    queue.append((ny, nx))
                elif val < bg_threshold + 50 and s < 0.15:
                    # gradient studio floor
                    is_bg[ny, nx] = True
                    queue.append((ny, nx))

    # Apply transparency
    out_data = data.copy()
    out_data[is_bg, 3] = 0
    
    # Soft alpha feathering on transition edges
    # Find border of background
    from scipy.ndimage import binary_dilation
    border = binary_dilation(is_bg, iterations=2) & ~is_bg
    # Set edge alpha to semi-transparent (128)
    out_data[border, 3] = np.minimum(out_data[border, 3], 140)

    result = Image.fromarray(out_data.astype(np.uint8))
    result.save(output_path, "PNG")
    
    # Verify edge alpha
    alpha = out_data[:, :, 3]
    top_a, bot_a, left_a, right_a = alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]
    non_zero_edge = (top_a > 0).sum() + (bot_a > 0).sum() + (left_a > 0).sum() + (right_a > 0).sum()
    print(f"Isolated {os.path.basename(img_path)} -> Non-zero edge pixels: {non_zero_edge}")

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    car_files = [
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
            isolate_car_from_dark_studio(p, p, bg_threshold=50)
