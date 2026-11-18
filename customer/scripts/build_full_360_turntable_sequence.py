import os
from PIL import Image
import numpy as np
from scipy.ndimage import label, binary_closing

brain_dir = r"C:\Users\Lenovo\.gemini\antigravity\brain\148b3a7d-a6e5-4eb8-b554-3274558a068e"
assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"

# 1. Cleanly extract supercar cutout from key raw renders
def extract_clean_car_cutout(src_filename):
  src_path = os.path.join(brain_dir, src_filename)
  if not os.path.exists(src_path):
    print(f"ERROR: {src_filename} not found!")
    return None

  img = Image.open(src_path).convert("RGBA")
  data = np.array(img, dtype=np.uint8)
  h, w = data.shape[:2]

  r = data[:, :, 0].astype(float)
  g = data[:, :, 1].astype(float)
  b = data[:, :, 2].astype(float)

  # Wipe studio ceiling lights (y < 33%) and floor mirror reflection (y > 63%)
  data[: int(h * 0.33), :, 3] = 0
  data[int(h * 0.63) :, :, 3] = 0

  # Wipe studio dark room background pixels (max_c < 24)
  max_c = np.maximum(np.maximum(r, g), b)
  data[max_c < 24, 3] = 0

  # Connected component filtering
  alpha_mask = data[:, :, 3] > 30
  closed_mask = binary_closing(alpha_mask, structure=np.ones((5, 5)))
  labeled, num_features = label(closed_mask)

  if num_features > 0:
    sizes = [np.sum(labeled == i) for i in range(1, num_features + 1)]
    max_label = np.argmax(sizes) + 1
    max_size = sizes[max_label - 1]

    for i, s in enumerate(sizes, 1):
      if s < max_size * 0.05:
        data[labeled == i, 3] = 0

  # Outer border clearance
  data[:4, :, 3] = 0
  data[-4:, :, 3] = 0
  data[:, :4, 3] = 0
  data[:, -4:, 3] = 0

  # Crop tight to car body
  nz = np.argwhere(data[:, :, 3] > 15)
  if len(nz) > 0:
    ymin, xmin = nz.min(axis=0)
    ymax, xmax = nz.max(axis=0)
    return Image.fromarray(data).crop((xmin, ymin, xmax, ymax))
  return None


# Extract 5 base camera angles
front_cutout = extract_clean_car_cutout("hero_car_front_1790311292286.png")
angle_cutout = extract_clean_car_cutout("turntable_045_1790311572594.png")
side_cutout = extract_clean_car_cutout("turntable_090_1790312287762.png")
rear_cutout = extract_clean_car_cutout("turntable_180_1790312306964.png")
side2_cutout = extract_clean_car_cutout("turntable_270_1790312328863.png")

print("Base cutouts extracted successfully.")


# Function to blend two cutouts for intermediate rotation angles
def blend_cutouts(imgA, imgB, alpha=0.5):
  w = max(imgA.width, imgB.width)
  h = max(imgA.height, imgB.height)

  canvasA = Image.new("RGBA", (w, h), (0, 0, 0, 0))
  canvasB = Image.new("RGBA", (w, h), (0, 0, 0, 0))

  canvasA.paste(imgA, ((w - imgA.width) // 2, (h - imgA.height) // 2), imgA)
  canvasB.paste(imgB, ((w - imgB.width) // 2, (h - imgB.height) // 2), imgB)

  return Image.blend(canvasA, canvasB, alpha)


# Create 12 key frame cutouts around 360 degrees:
# 0: 0° (Front)
# 1: 30° (Front-Left 30)
# 2: 60° (Front-Left 60)
# 3: 90° (Left Side)
# 4: 120° (Rear-Left 120)
# 5: 150° (Rear-Left 150)
# 6: 180° (Rear)
# 7: 210° (Rear-Right 210) - Mirrored 150°
# 8: 240° (Rear-Right 240) - Mirrored 120°
# 9: 270° (Right Side)
# 10: 300° (Front-Right 300) - Mirrored 60°
# 11: 330° (Front-Right 330) - Mirrored 30°

f0 = front_cutout
f1 = blend_cutouts(front_cutout, angle_cutout, 0.4)
f2 = blend_cutouts(angle_cutout, side_cutout, 0.5)
f3 = side_cutout
f4 = blend_cutouts(side_cutout, rear_cutout, 0.4)
f5 = blend_cutouts(side_cutout, rear_cutout, 0.7)
f6 = rear_cutout
f7 = f5.transpose(Image.FLIP_LEFT_RIGHT)
f8 = f4.transpose(Image.FLIP_LEFT_RIGHT)
f9 = side2_cutout if side2_cutout else side_cutout.transpose(Image.FLIP_LEFT_RIGHT)
f10 = f2.transpose(Image.FLIP_LEFT_RIGHT)
f11 = f1.transpose(Image.FLIP_LEFT_RIGHT)

raw_frames = [f0, f1, f2, f3, f4, f5, f6, f7, f8, f9, f10, f11]

# Save all 12 frames onto standardized 900x500 canvas
canvas_w, canvas_h = 900, 500

for i, crop in enumerate(raw_frames):
  # Trim crop tight
  crop_arr = np.array(crop)
  nz = np.argwhere(crop_arr[:, :, 3] > 15)
  if len(nz) > 0:
    ymin, xmin = nz.min(axis=0)
    ymax, xmax = nz.max(axis=0)
    tight_crop = crop.crop((xmin, ymin, xmax, ymax))
  else:
    tight_crop = crop

  canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))

  # Fit inside 86% width, 76% height for perfect consistent scale
  tight_crop.thumbnail(
      (int(canvas_w * 0.86), int(canvas_h * 0.76)), Image.Resampling.LANCZOS
  )

  px = (canvas_w - tight_crop.width) // 2
  py = (canvas_h - tight_crop.height) // 2 + 5
  canvas.paste(tight_crop, (px, py), tight_crop)

  # Clear 4-px border
  c_arr = np.array(canvas)
  c_arr[:4, :, 3] = 0
  c_arr[-4:, :, 3] = 0
  c_arr[:, :4, 3] = 0
  c_arr[:, -4:, 3] = 0

  out_img = Image.fromarray(c_arr)
  out_p = os.path.join(assets_dir, f"turntable_{i}.png")
  out_img.save(out_p, "PNG")

  if i == 0:
    fallback_p = os.path.join(assets_dir, "hero_car_fallback.png")
    out_img.save(fallback_p, "PNG")

  border_alpha = (
      c_arr[:4, :, 3].sum()
      + c_arr[-4:, :, 3].sum()
      + c_arr[:, :4, 3].sum()
      + c_arr[:, -4:, 3].sum()
  )
  print(
      f"SAVED turntable_{i}.png ({i*30:3d}° angle): crop={tight_crop.size},"
      f" border_alpha={border_alpha}, transparent_px={(c_arr[:,:,3]==0).sum()}"
  )
