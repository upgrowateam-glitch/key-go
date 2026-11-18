import os
from PIL import Image, ImageDraw, ImageFont
import math

def draw_rydluma_logo(size=1024, bg_color=(18, 21, 27, 255)):
    # Create high-res canvas
    img = Image.new("RGBA", (size, size), bg_color)
    draw = ImageDraw.Draw(img)
    
    padding = int(size * 0.06)
    corner_radius = int(size * 0.24)
    
    # Outer dark shield box
    shield_box = [padding, padding, size - padding, size - padding]
    draw.rounded_rectangle(
        shield_box,
        radius=corner_radius,
        fill=(23, 27, 33, 255),
        outline=(198, 244, 50, 80),
        width=int(size * 0.02)
    )
    
    # Scale coordinates relative to size
    s = size / 100.0
    
    # White R structural body points
    # Outer loop & stem
    stem_w = int(10 * s)
    x0 = int(22 * s)
    y0 = int(22 * s)
    h = int(58 * s)
    
    # White main R path fill:
    r_poly = [
        (18 * s, 22 * s),
        (66 * s, 22 * s),
        (76 * s, 36 * s),
        (72 * s, 50 * s),
        (54 * s, 57 * s),
        (72 * s, 80 * s),
        (56 * s, 80 * s),
        (40 * s, 57 * s),
        (28 * s, 57 * s),
        (28 * s, 80 * s),
        (18 * s, 80 * s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in r_poly], fill=(255, 255, 255, 255))
    
    # Cutout inner R loop
    loop_poly = [
        (28 * s, 31 * s),
        (56 * s, 31 * s),
        (63 * s, 39 * s),
        (56 * s, 48 * s),
        (28 * s, 48 * s),
    ]
    draw.polygon([(int(x), int(y)) for x, y in loop_poly], fill=(23, 27, 33, 255))
    
    # Lime Green Road Stripe (#c6f432)
    lime = (198, 244, 50, 255)
    line_w = int(5 * s)
    
    # Curved road stripe inside loop
    # Draw arc and lines using line segments
    road_pts = []
    # Horizontal line across loop
    for x in range(int(30 * s), int(54 * s)):
        road_pts.append((x, int(39 * s)))
    # Curve
    for deg in range(-90, 90, 10):
        rad = math.radians(deg)
        rx = int(54 * s + 8 * s * math.cos(rad))
        ry = int(43.5 * s + 4.5 * s * math.sin(rad))
        road_pts.append((rx, ry))
    for x in range(int(54 * s), int(34 * s), -1):
        road_pts.append((x, int(48 * s)))
        
    draw.line([(int(x), int(y)) for x, y in road_pts], fill=lime, width=line_w, joint="curve")
    
    # Curved exit ramp stripe
    ramp_pts = []
    for t in [i/20.0 for i in range(21)]:
        # Quadratic bezier from (38, 57) control (50, 63) to (62, 76)
        bx = (1-t)**2 * 38*s + 2*(1-t)*t * 50*s + t**2 * 62*s
        by = (1-t)**2 * 57*s + 2*(1-t)*t * 63*s + t**2 * 76*s
        ramp_pts.append((bx, by))
    draw.line([(int(x), int(y)) for x, y in ramp_pts], fill=lime, width=line_w, joint="curve")

    # Dark dashed centerline on left stem
    dash_w = int(3.5 * s)
    dash_h = int(6 * s)
    gap = int(5 * s)
    curr_y = int(26 * s)
    while curr_y < int(76 * s):
        draw.line([(int(23 * s), curr_y), (int(23 * s), min(curr_y + dash_h, int(76 * s)))], fill=(23, 27, 33, 255), width=dash_w)
        curr_y += dash_h + gap
        
    return img

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    
    # 1. Main Icon 1024x1024
    icon_img = draw_rydluma_logo(1024)
    icon_img.save(os.path.join(assets_dir, "icon.png"), "PNG")
    print("Saved assets/images/icon.png")
    
    # 2. Splash Icon 1024x1024 (transparent background)
    splash_img = draw_rydluma_logo(1024, bg_color=(0, 0, 0, 0))
    splash_img.save(os.path.join(assets_dir, "splash-icon.png"), "PNG")
    print("Saved assets/images/splash-icon.png")

    # 3. Android Foreground / Monochrome
    fg_img = draw_rydluma_logo(1024, bg_color=(0, 0, 0, 0))
    fg_img.save(os.path.join(assets_dir, "android-icon-foreground.png"), "PNG")
    fg_img.save(os.path.join(assets_dir, "android-icon-monochrome.png"), "PNG")
    print("Saved android icons")
    
    # 4. Favicon 64x64
    fav_img = draw_rydluma_logo(128)
    fav_img.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(assets_dir, "favicon.png"), "PNG")
    print("Saved assets/images/favicon.png")
