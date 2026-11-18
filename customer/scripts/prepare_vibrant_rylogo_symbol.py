import os
import re

out_ts_path = r"d:\upgrowa-workspace\rental-car\src\assets\rylogoSymbolXml.ts"

# Clean, vibrant, high-contrast vector representation of the Rydluma Road "R" Symbol
# Left Teal Curve + Right Crisp White Road Body + Lime & Slate Road Centerline Markers
vibrant_symbol_svg = """<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <!-- Glowing Teal Left Road Curve -->
  <path d="M 32 84 L 46 84 C 46 56 46 48 56 36 L 55 24 L 24 24 C 30 32 32 46 32 84 Z" fill="#14b8a6" />
  
  <!-- Crisp Warm White Main Road Body -->
  <path d="M 26 24 L 68 24 C 82 24 84 40 74 52 C 64 60 50 60 38 62 L 58 84 L 42 84 L 26 62 C 34 54 34 38 26 24 Z" fill="#f8fafc" />
  
  <!-- Lime Accent Edge Highlights -->
  <path d="M 68 24 C 82 24 84 40 74 52 L 70 48 C 76 38 74 28 64 28 Z" fill="#c6f432" />
  
  <!-- Road Dashed Centerline Markers -->
  <path d="M 34 32 C 54 32 64 38 62 46 C 58 54 50 54 56 65 L 64 78" stroke="#94a3b8" stroke-width="2.5" stroke-dasharray="5 3" stroke-linecap="round" fill="none" />
</svg>"""

ts_content = f"// High-contrast vibrant Rydluma symbol SVG\nexport const rylogoSymbolXml = `{vibrant_symbol_svg}`;\n"

with open(out_ts_path, "w", encoding="utf-8") as f:
  f.write(ts_content)

print(f"Successfully updated {out_ts_path} with vibrant high-contrast symbol SVG.")
