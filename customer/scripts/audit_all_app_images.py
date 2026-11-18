import os
from PIL import Image
import numpy as np

assets_dir = r"d:\upgrowa-workspace\rental-car\assets\images"

print("=== AUDITING ALL PNG ASSETS IN ASSETS/IMAGES ===")

for fname in sorted(os.listdir(assets_dir)):
  if not fname.endswith(".png"):
    continue

  p = os.path.join(assets_dir, fname)
  img = Image.open(p)
  mode = img.mode

  if mode != "RGBA":
    print(f"[NO_ALPHA] {fname:30s}: MODE IS {mode}")
    continue

  arr = np.array(img)
  alpha = arr[:, :, 3]

  top_a = alpha[0, :].max()
  bot_a = alpha[-1, :].max()
  left_a = alpha[:, 0].max()
  right_a = alpha[:, -1].max()
  border_max = max(top_a, bot_a, left_a, right_a)

  total_px = alpha.size
  nz_px = (alpha > 10).sum()
  trans_px = (alpha == 0).sum()
  trans_pct = (trans_px / total_px) * 100.0

  nz_coords = np.argwhere(alpha > 10)
  if len(nz_coords) > 0:
    ymin, xmin = nz_coords.min(axis=0)
    ymax, xmax = nz_coords.max(axis=0)
    w = xmax - xmin
    h = ymax - ymin
    bbox_str = f"({xmin},{ymin}) to ({xmax},{ymax}), w={w}, h={h}"
  else:
    bbox_str = "EMPTY"

  status = (
      "[OK]"
      if (border_max == 0 and trans_pct > 20)
      else f"[BORDER_ALPHA_WARN: {border_max}]"
  )
  print(
      f"{fname:30s}: {status:22s} | size={img.size} | trans={trans_pct:.1f}% |"
      f" bbox={bbox_str}"
  )
