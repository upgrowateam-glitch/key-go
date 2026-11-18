import os
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

def add_contact_shadow_to_car(img_path, output_path):
    img = Image.open(img_path).convert("RGBA")
    w, h = img.size
    
    data = np.array(img)
    alpha = data[:, :, 3]
    
    # Find bounding box of car subject
    non_zero = np.argwhere(alpha > 20)
    if non_zero.size == 0:
        return
        
    y_min, x_min = non_zero.min(axis=0)
    y_max, x_max = non_zero.max(axis=0)
    
    car_w = x_max - x_min
    car_h = y_max - y_min
    
    # Create canvas with extra room at the bottom for natural contact shadow
    canvas_h = h + int(car_h * 0.15)
    canvas_w = w
    
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    
    # Create soft contact shadow layer underneath wheels
    shadow_layer = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    
    # Shadow ellipse parameters right under bottom of tires (y_max)
    shadow_center_x = (x_min + x_max) // 2
    shadow_center_y = y_max + int(car_h * 0.04)
    shadow_rx = int(car_w * 0.44)
    shadow_ry = max(12, int(car_h * 0.08))
    
    shadow_box = [
        shadow_center_x - shadow_rx,
        shadow_center_y - shadow_ry,
        shadow_center_x + shadow_rx,
        shadow_center_y + shadow_ry
    ]
    
    # Draw dark shadow with alpha gradient
    shadow_draw.ellipse(shadow_box, fill=(0, 0, 0, 180))
    
    # Blur shadow layer for natural soft edge
    shadow_blurred = shadow_layer.filter(ImageFilter.GaussianBlur(radius=int(car_h * 0.05)))
    
    # Second tight contact shadow right at wheel touchpoints
    tight_shadow = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    tight_draw = ImageDraw.Draw(tight_shadow)
    tight_box = [
        shadow_center_x - int(car_w * 0.40),
        y_max - int(car_h * 0.02),
        shadow_center_x + int(car_w * 0.40),
        y_max + int(car_h * 0.03)
    ]
    tight_draw.ellipse(tight_box, fill=(0, 0, 0, 220))
    tight_blurred = tight_shadow.filter(ImageFilter.GaussianBlur(radius=int(car_h * 0.02)))
    
    # Composite: background canvas -> soft shadow -> tight shadow -> car image
    canvas.paste(shadow_blurred, (0, 0), shadow_blurred)
    canvas.paste(tight_blurred, (0, 0), tight_blurred)
    canvas.paste(img, (0, 0), img)
    
    # Autocrop canvas to tight content bounds
    final_data = np.array(canvas)
    final_alpha = final_data[:, :, 3]
    nz = np.argwhere(final_alpha > 5)
    if nz.size > 0:
        fy_min, fx_min = nz.min(axis=0)
        fy_max, fx_max = nz.max(axis=0)
        
        # Add small padding
        pad = 8
        cy0 = max(0, fy_min - pad)
        cy1 = min(canvas_h, fy_max + pad)
        cx0 = max(0, fx_min - pad)
        cx1 = min(canvas_w, fx_max + pad)
        
        canvas = canvas.crop((cx0, cy0, cx1, cy1))

    canvas.save(output_path, "PNG")
    print(f"Added natural contact shadow to {os.path.basename(img_path)} -> Size: {canvas.size}")

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
    ]
    for name in car_files:
        p = os.path.join(assets_dir, name)
        if os.path.exists(p):
            add_contact_shadow_to_car(p, p)
