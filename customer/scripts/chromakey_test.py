import os
from PIL import Image
import numpy as np

src_path = r"C:\Users\Lenovo\.gemini\antigravity\brain\148b3a7d-a6e5-4eb8-b554-3274558a068e\car_novara_cross_isolated_1790315480988.png"
dst_path = r"d:\upgrowa-workspace\rental-car\assets\images\car_novara_cross.png"

img = Image.open(src_path).convert("RGBA")
data = np.array(img)

r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]

# Green screen chromakey condition: Green is significantly higher than Red and Blue
# Or G > 100 and G > R * 1.2 and G > B * 1.2
is_green = (g > 80) & (g > r * 1.1) & (g > b * 1.1)

# Set alpha to 0 for green background
data[is_green, 3] = 0

# Also check outer borders to ensure 0 edge pixels
alpha = data[:, :, 3]
top_a, bot_a, left_a, right_a = alpha[0, :], alpha[-1, :], alpha[:, 0], alpha[:, -1]
non_zero_edge = (top_a > 0).sum() + (bot_a > 0).sum() + (left_a > 0).sum() + (right_a > 0).sum()

result = Image.fromarray(data)
result.save(dst_path, "PNG")

print(f"Processed Green Screen Chromakey:")
print(f"Non-zero edge pixels: {non_zero_edge}")
print(f"Total transparent pixels: {(data[:, :, 3] == 0).sum()} / {data.shape[0] * data.shape[1]}")
