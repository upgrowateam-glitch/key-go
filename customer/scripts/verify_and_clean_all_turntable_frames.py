import os
from PIL import Image
import numpy as np

def clean_and_verify_frame(img_path):
    img = Image.open(img_path).convert("RGBA")
    data = np.array(img, dtype=np.uint8)
    
    height, width = data.shape[:2]
    
    r = data[:, :, 0].astype(float)
    g = data[:, :, 1].astype(float)
    b = data[:, :, 2].astype(float)
    a = data[:, :, 3].astype(float)
    
    max_c = np.maximum(np.maximum(r, g), b)
    
    # Threshold background noise/darkness
    # In these studio 360 renders, background is dark gray/black (< 50)
    bg_mask = max_c < 50
    
    # Clear background pixels
    data[bg_mask, 3] = 0
    
    # Clear 3-pixel outer border ring on canvas to guarantee 0 border alpha
    data[:4, :, 3] = 0
    data[-4:, :, 3] = 0
    data[:, :4, 3] = 0
    data[:, -4:, 3] = 0
    
    # Save back
    out_img = Image.fromarray(data)
    out_img.save(img_path, "PNG")
    
    # Thorough pixel-level verification of edge transparency across frame
    alpha_result = data[:, :, 3]
    top_edge = (alpha_result[0, :] > 0).sum()
    bot_edge = (alpha_result[-1, :] > 0).sum()
    left_edge = (alpha_result[:, 0] > 0).sum()
    right_edge = (alpha_result[:, -1] > 0).sum()
    
    total_edge_pixels = top_edge + bot_edge + left_edge + right_edge
    print(f"VERIFIED FRAME {os.path.basename(img_path)}: Edge Non-zero Pixels = {total_edge_pixels}, Dimensions = ({width}x{height})")
    assert total_edge_pixels == 0, f"Frame {img_path} failed edge transparency check!"

if __name__ == "__main__":
    assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"
    turntable_frames = [
        "turntable_0.png",
        "turntable_1.png",
        "turntable_2.png",
        "turntable_3.png",
        "turntable_4.png",
        "hero_car_fallback.png",
    ]
    for frame_name in turntable_frames:
        p = os.path.join(assets_dir, frame_name)
        if os.path.exists(p):
            clean_and_verify_frame(p)
