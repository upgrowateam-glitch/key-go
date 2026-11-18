import os
from PIL import Image, ImageDraw, ImageFont
import math

def draw_rydluma_road_r(size=1024, bg_color=(9, 13, 22, 255)):
    img = Image.new("RGBA", (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    s = size / 100.0
    
    teal = (20, 184, 166, 255)       # #14b8a6 Muted Teal
    warm_white = (248, 250, 252, 255) # #f8fafc Warm White
    lane_dash = (148, 163, 184, 255)  # #94a3b8 Slate Muted
    
    # Left Teal Road Curve
    # Sweeping vertical stem at x=36..48, curving up and right across top
    teal_pts = []
    # Bottom stem
    for y in range(int(82 * s), int(45 * s), -1):
        teal_pts.append((int(36 * s), y))
    
    # Curve upward and right
    for t in [i/30.0 for i in range(31)]:
        # Bezier from (36, 45) -> (36, 26) -> (58, 26)
        bx = (1-t)**2 * 36*s + 2*(1-t)*t * 36*s + t**2 * 58*s
        by = (1-t)**2 * 45*s + 2*(1-t)*t * 26*s + t**2 * 26*s
        teal_pts.append((int(bx), int(by)))
        
    # Top flat extension
    for x in range(int(58 * s), int(26 * s), -1):
        teal_pts.append((x, int(26 * s)))
        
    # Thick Teal Road Stroke
    teal_line_width = int(12 * s)
    
    # Left Teal Ribbon Path (Smooth polygon)
    teal_poly = [
        (35 * s, 82 * s),
        (48 * s, 82 * s),
        (48 * s, 48 * s),
        (57 * s, 36 * s),
        (56 * s, 26 * s),
        (26 * s, 26 * s),
        (32 * s, 34 * s),
        (35 * s, 48 * s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in teal_poly], fill=teal)
    
    # Right Warm White Road Curve with Inner Dashes
    white_poly = [
        (28 * s, 26 * s),
        (66 * s, 26 * s),
        (76 * s, 38 * s),
        (72 * s, 50 * s),
        (54 * s, 57 * s),
        (72 * s, 82 * s),
        (58 * s, 82 * s),
        (42 * s, 60 * s),
        (48 * s, 48 * s),
        (58 * s, 38 * s),
        (36 * s, 38 * s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in white_poly], fill=warm_white)
    
    # Dashed Lane Line on Warm White Road Ribbon
    dash_w = int(3.0 * s)
    dash_pts = [
        (36 * s, 32 * s),
        (48 * s, 32 * s),
        (58 * s, 32 * s),
        (64 * s, 38 * s),
        (62 * s, 46 * s),
        (50 * s, 54 * s),
        (56 * s, 65 * s),
        (64 * s, 77 * s),
    ]
    
    # Draw dashed centerline
    for i in range(len(dash_pts) - 1):
        if i % 2 == 0:
            x1, y1 = dash_pts[i]
            x2, y2 = dash_pts[i+1]
            draw.line([(int(x1), int(y1)), (int(x2), int(y2))], fill=lane_dash, width=dash_w)

    return img

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    
    # 1. Main App Icon (Symbol alone on Deep Navy)
    icon_img = draw_rydluma_road_r(1024, bg_color=(9, 13, 22, 255))
    icon_img.save(os.path.join(assets_dir, "icon.png"), "PNG")
    print("Saved icon.png (Symbol alone)")

    # 2. Splash Icon (Symbol alone with transparent background)
    splash_img = draw_rydluma_road_r(1024, bg_color=(0, 0, 0, 0))
    splash_img.save(os.path.join(assets_dir, "splash-icon.png"), "PNG")
    print("Saved splash-icon.png (Symbol alone transparent)")

    # 3. Android Adaptive Icons
    splash_img.save(os.path.join(assets_dir, "android-icon-foreground.png"), "PNG")
    splash_img.save(os.path.join(assets_dir, "android-icon-monochrome.png"), "PNG")
    
    # 4. Favicon
    draw_rydluma_road_r(128, bg_color=(9, 13, 22, 255)).resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(assets_dir, "favicon.png"), "PNG")
    print("Saved favicon.png")
