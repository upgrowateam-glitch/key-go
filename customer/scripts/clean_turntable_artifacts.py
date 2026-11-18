import os
from PIL import Image
import numpy as np

def clean_frame_artifacts(img_path, output_path):
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img, dtype=np.uint8)
    
    height, width = data.shape[:2]
    
    r = data[:, :, 0].astype(float)
    g = data[:, :, 1].astype(float)
    b = data[:, :, 2].astype(float)
    a = data[:, :, 3].astype(float)
    
    # Analyze image layers
    # Neon green/yellow ceiling lights: High G, High R (lime/yellow #c6f432 / #a0e000)
    # Purple room pillars: High B, High R (violet #7c5cff / #5020a0)
    # Background room floor/walls: dark gray / black
    
    # Find bounding box of main car subject (which is in lower/middle half of frame)
    # Ceiling lights are in upper half (y < 0.40 * height)
    # Floor reflections/artifacts below tires (y > 0.88 * height)
    
    # 1. Clear top 35% of frame where neon ceiling lights reside
    # (The car body is centered in the lower-middle portion)
    
    # Find car vertical bounds
    # Car body has metallic black/dark grey/gold supercar paint with wheels
    
    # Clear top ceiling area if it's not part of car
    # Let's inspect rows from top to find car top roof:
    car_top_y = 0
    for y in range(int(height * 0.15), int(height * 0.55)):
        row_alpha = a[y, :]
        row_color = np.maximum(r[y, :], g[y, :])
        # If there's a gap between ceiling lights and car roof:
        if (row_alpha > 0).sum() < 20:
            car_top_y = y
            
    # Clear anything above car_top_y if car_top_y > 0
    if car_top_y > int(height * 0.25):
        data[:car_top_y, :, 3] = 0
        
    # Remove neon green light pixels (R > 120, G > 180, B < 100) outside car body
    is_neon_green = (g > 140) & (r > 100) & (b < 120)
    
    # Remove purple studio pillar pixels (R > 80, B > 140, G < 100) outside car body
    is_purple_pillar = (b > 130) & (r > 60) & (g < 110)
    
    # Mask top 45% for neon/purple artifacts
    top_45_mask = np.zeros((height, width), dtype=bool)
    top_45_mask[:int(height * 0.48), :] = True
    
    data[top_45_mask & (is_neon_green | is_purple_pillar), 3] = 0
    
    # Also remove stray isolated pixels (small floating dot artifacts)
    from scipy.ndimage import binary_opening, binary_closing, label
    
    alpha_mask = data[:, :, 3] > 30
    
    # Connected component analysis: keep only the largest component (the supercar)
    labeled, num_features = label(alpha_mask)
    if num_features > 1:
        sizes = [np.sum(labeled == i) for i in range(1, num_features + 1)]
        max_label = np.argmax(sizes) + 1
        
        # Remove small floating components (< 5% of max component size)
        max_size = sizes[max_label - 1]
        for i, s in enumerate(sizes, 1):
            if s < max_size * 0.08:
                data[labeled == i, 3] = 0

    # Crop tight to car subject and re-center on a 1000x600 canvas for consistent size/position across all frames
    final_alpha = data[:, :, 3]
    nz = np.argwhere(final_alpha > 10)
    if nz.size > 0:
        y_min, x_min = nz.min(axis=0)
        y_max, x_max = nz.max(axis=0)
        
        car_crop = Image.fromarray(data).crop((x_min, y_min, x_max, y_max))
        
        # Create standard unified canvas 900x500
        canvas_w, canvas_h = 900, 500
        unified_canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        
        # Fit car inside canvas preserving aspect ratio
        car_crop.thumbnail((int(canvas_w * 0.92), int(canvas_h * 0.82)), Image.Resampling.LANCZOS)
        
        # Center inside unified canvas
        paste_x = (canvas_w - car_crop.width) // 2
        paste_y = (canvas_h - car_crop.height) // 2 + int(canvas_h * 0.04) # slightly lower for ground ring alignment
        
        unified_canvas.paste(car_crop, (paste_x, paste_y), car_crop)
        unified_canvas.save(output_path, "PNG")
        print(f"Cleaned & Normalized {os.path.basename(img_path)} -> Car size {car_crop.size} centered on ({canvas_w}x{canvas_h})")

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    turntable_files = [
        "turntable_0.png",
        "turntable_1.png",
        "turntable_2.png",
        "turntable_3.png",
        "turntable_4.png",
        "hero_car_fallback.png",
    ]
    for name in turntable_files:
        p = os.path.join(assets_dir, name)
        if os.path.exists(p):
            clean_frame_artifacts(p, p)
