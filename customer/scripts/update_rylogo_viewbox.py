import os
import re

svg_path = r"d:\upgrowa-workspace\rental-car\assets\images\rylogo.svg"
out_ts_path = r"d:\upgrowa-workspace\rental-car\src\assets\rylogoXml.ts"

with open(svg_path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace svg root tag with viewBox
new_svg_tag = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="1570" height="1080" viewBox="-690 -20 1570 1080">'
content = re.sub(r'<svg[^>]*>', new_svg_tag, content, count=1)

ts_content = f"// Generated from assets/images/rylogo.svg\nexport const rylogoXml = `{content}`;\n"

with open(out_ts_path, "w", encoding="utf-8") as f:
    f.write(ts_content)

print(f"Successfully generated {out_ts_path} with tight viewBox (-690 -20 1570 1080)")
