import os
import glob
from PIL import Image, ImageFilter
import numpy as np

def make_transparent_floodfill(img_path, output_path, tolerance=35):
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img)
    
    # Get corner colors as background reference
    r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
    
    # Calculate luminance / darkness or distance from dark background
    # Most studio backgrounds here are near dark gray/black (< 45 in RGB)
    # We can perform floodfill or color thresholding from edges.
    
    # Let's inspect brightness:
    brightness = np.maximum(np.maximum(r, g), b)
    
    # Create mask where brightness is low or background floor gradient
    # We want to keep the vibrant car colors.
    # Cars have vivid colors (yellow, cyan, lime, metallic red, silver with highlights)
    # The studio background is dark gray/black (< 40).
    
    bg_mask = (r < tolerance) & (g < tolerance) & (b < tolerance)
    
    # Also do floodfill from all 4 corners to only remove connected background
    # to avoid removing dark tires inside the car
    from scipy.ndimage import binary_fill_holes, label
    
    # Simple BFS flood fill from border pixels that are dark
    height, width = data.shape[:2]
    visited = np.zeros((height, width), dtype=bool)
    
    # Seed queue with border pixels that meet dark criteria
    queue = []
    for y in range(height):
        for x in [0, width-1]:
            if bg_mask[y, x]:
                queue.append((y, x))
                visited[y, x] = True
    for x in range(width):
        for y in [0, height-1]:
            if not visited[y, x] and bg_mask[y, x]:
                queue.append((y, x))
                visited[y, x] = True
                
    # 4-connectivity BFS
    idx = 0
    while idx < len(queue):
        cy, cx = queue[idx]
        idx += 1
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < height and 0 <= nx < width and not visited[ny, nx]:
                # If dark or close to neighbor background color
                if bg_mask[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((ny, nx))
                elif brightness[ny, nx] < tolerance + 15:
                    # gradual fade at edges
                    diff = np.abs(data[ny, nx, :3].astype(int) - data[cy, cx, :3].astype(int)).max()
                    if diff < 25:
                        visited[ny, nx] = True
                        queue.append((ny, nx))

    # Apply alpha transparency
    data[visited, 3] = 0
    
    # Feather / anti-alias the transparent edge slightly
    result = Image.fromarray(data)
    result.save(output_path, "PNG")
    print(f"Saved transparent image to: {output_path}")

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    for filename in os.listdir(assets_dir):
        if filename.endswith(".png"):
            path = os.path.join(assets_dir, filename)
            make_transparent_floodfill(path, path, tolerance=40)
