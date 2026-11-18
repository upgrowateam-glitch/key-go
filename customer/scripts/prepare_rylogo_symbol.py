import os
import re

svg_path = r"d:\upgrowa-workspace\rental-car\assets\images\rylogo.svg"
out_ts_path = r"d:\upgrowa-workspace\rental-car\src\assets\rylogoSymbolXml.ts"

with open(svg_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace svg root tag with tight viewBox focusing exclusively on the road "R" symbol
symbol_svg_tag = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="465" height="430" viewBox="-245 -20 465 430">'
content = re.sub(r'<svg[^>]*>', symbol_svg_tag, content, count=1)

ts_content = f"// Symbol-only SVG generated from assets/images/rylogo.svg\nexport const rylogoSymbolXml = `{content}`;\n"

with open(out_ts_path, "w", encoding="utf-8") as f:
    f.write(ts_content)

print(f"Successfully generated {out_ts_path} with symbol viewBox (-245 -20 465 430)")
