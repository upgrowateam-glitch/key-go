import os
from PIL import Image, ImageDraw, ImageFont
import math

def create_bmw_logo(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Outer black ring with silver stroke
    center = size // 2
    radius = size // 2 - 4
    
    draw.ellipse([center - radius, center - radius, center + radius, center + radius], fill=(15, 20, 28, 255), outline=(220, 225, 230, 255), width=6)
    
    # Inner circle split into 4 quadrants (Blue #0066B1 and White #FFFFFF)
    r_inner = radius - int(size * 0.22)
    blue = (0, 102, 177, 255)
    white = (255, 255, 255, 255)
    
    # Top-Right: Blue, Top-Left: White, Bottom-Left: Blue, Bottom-Right: White
    draw.pieslice([center - r_inner, center - r_inner, center + r_inner, center + r_inner], start=270, end=360, fill=blue)
    draw.pieslice([center - r_inner, center - r_inner, center + r_inner, center + r_inner], start=180, end=270, fill=white)
    draw.pieslice([center - r_inner, center - r_inner, center + r_inner, center + r_inner], start=90, end=180, fill=blue)
    draw.pieslice([center - r_inner, center - r_inner, center + r_inner, center + r_inner], start=0, end=90, fill=white)
    
    # Inner silver circle border
    draw.ellipse([center - r_inner, center - r_inner, center + r_inner, center + r_inner], outline=(200, 205, 210, 255), width=3)
    
    # Draw "B M W" text around top ring
    # Draw simple clean B M W letters at top
    try:
        font = ImageFont.truetype("arial.ttf", int(size * 0.11))
    except:
        font = ImageFont.load_default()
        
    draw.text((center - int(size*0.25), center - radius + int(size*0.06)), "B", fill=white, font=font)
    draw.text((center - int(size*0.05), center - radius + int(size*0.02)), "M", fill=white, font=font)
    draw.text((center + int(size*0.14), center - radius + int(size*0.06)), "W", fill=white, font=font)
    
    return img

def create_vw_logo(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = size // 2
    radius = size // 2 - 4
    
    blue = (0, 30, 80, 255)
    white = (245, 248, 255, 255)
    
    # Outer circle
    draw.ellipse([center - radius, center - radius, center + radius, center + radius], fill=blue, outline=white, width=8)
    
    # Draw V and W interlocking lines
    w_line = int(size * 0.065)
    # V shape
    draw.line([(center - int(size*0.24), center - int(size*0.22)), (center, center - int(size*0.02))], fill=white, width=w_line)
    draw.line([(center, center - int(size*0.02)), (center + int(size*0.24), center - int(size*0.22))], fill=white, width=w_line)
    
    # W shape
    draw.line([(center - int(size*0.30), center - int(size*0.02)), (center - int(size*0.14), center + int(size*0.28))], fill=white, width=w_line)
    draw.line([(center - int(size*0.14), center + int(size*0.28)), (center, center + int(size*0.05))], fill=white, width=w_line)
    draw.line([(center, center + int(size*0.05)), (center + int(size*0.14), center + int(size*0.28))], fill=white, width=w_line)
    draw.line([(center + int(size*0.14), center + int(size*0.28)), (center + int(size*0.30), center - int(size*0.02))], fill=white, width=w_line)
    
    # Separator horizontal line
    draw.line([(center - int(size*0.35), center - int(size*0.02)), (center + int(size*0.35), center - int(size*0.02))], fill=blue, width=int(size*0.025))

    return img

def create_hyundai_logo(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = size // 2
    rx = size // 2 - 8
    ry = int((size // 2 - 8) * 0.7)
    
    silver = (220, 225, 235, 255)
    
    # Slanted oval
    draw.ellipse([center - rx, center - ry, center + rx, center + ry], outline=silver, width=10)
    
    # Slanted H inside
    w_line = int(size * 0.08)
    draw.line([(center - int(size*0.20), center - int(ry*0.75)), (center - int(size*0.12), center + int(ry*0.75))], fill=silver, width=w_line)
    draw.line([(center + int(size*0.12), center - int(ry*0.75)), (center + int(size*0.20), center + int(ry*0.75))], fill=silver, width=w_line)
    draw.line([(center - int(size*0.16), center), (center + int(size*0.16), center)], fill=silver, width=w_line)
    
    return img

def create_toyota_logo(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = size // 2
    rx = size // 2 - 6
    ry = int((size // 2 - 6) * 0.65)
    
    silver = (230, 235, 240, 255)
    
    # Outer ellipse
    draw.ellipse([center - rx, center - ry, center + rx, center + ry], outline=silver, width=8)
    # Inner vertical ellipse (T top)
    draw.ellipse([center - int(rx*0.4), center - int(ry*0.9), center + int(rx*0.4), center + int(ry*0.9)], outline=silver, width=7)
    # Inner horizontal ellipse
    draw.ellipse([center - int(rx*0.8), center - int(ry*0.5), center + int(rx*0.8), center + int(ry*0.1)], outline=silver, width=7)

    return img

def create_audi_logo(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center_y = size // 2
    r = int(size * 0.22)
    stroke = int(size * 0.05)
    silver = (225, 230, 238, 255)
    
    # 4 Interlocking Rings
    centers_x = [int(size * 0.22), int(size * 0.40), int(size * 0.58), int(size * 0.78)]
    for cx in centers_x:
        draw.ellipse([cx - r, center_y - r, cx + r, center_y + r], outline=silver, width=stroke)
        
    return img

def create_mercedes_logo(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = size // 2
    radius = size // 2 - 6
    silver = (235, 240, 245, 255)
    
    # Outer ring
    draw.ellipse([center - radius, center - radius, center + radius, center + radius], outline=silver, width=7)
    
    # 3-pointed star
    r_star = radius - 8
    for angle in [270, 30, 150]:
        rad = math.radians(angle)
        x = center + r_star * math.cos(rad)
        y = center + r_star * math.sin(rad)
        draw.line([(center, center), (int(x), int(y))], fill=silver, width=7)
        
    return img

def create_porsche_logo(size=256):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = size // 2
    w = int(size * 0.7)
    h = int(size * 0.85)
    
    gold = (212, 175, 55, 255)
    red = (200, 30, 30, 255)
    black = (15, 18, 24, 255)
    
    # Shield shape
    box = [center - w//2, center - h//2, center + w//2, center + h//2]
    draw.rounded_rectangle(box, radius=12, fill=gold, outline=(255, 220, 100, 255), width=4)
    # Red & black stripes inside
    draw.rectangle([center - w//2 + 8, center - h//2 + 8, center, center + h//2 - 8], fill=red)
    draw.rectangle([center, center - h//2 + 8, center + w//2 - 8, center + h//2 - 8], fill=black)
    
    return img

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    
    create_hyundai_logo(256).save(os.path.join(assets_dir, "brand_hyundai.png"), "PNG")
    create_vw_logo(256).save(os.path.join(assets_dir, "brand_volkswagen.png"), "PNG")
    create_toyota_logo(256).save(os.path.join(assets_dir, "brand_toyota.png"), "PNG")
    create_bmw_logo(256).save(os.path.join(assets_dir, "brand_bmw.png"), "PNG")
    create_audi_logo(256).save(os.path.join(assets_dir, "brand_audi.png"), "PNG")
    create_mercedes_logo(256).save(os.path.join(assets_dir, "brand_mercedes.png"), "PNG")
    create_porsche_logo(256).save(os.path.join(assets_dir, "brand_porsche.png"), "PNG")
    
    print("Generated all official brand logo assets in assets/images!")
