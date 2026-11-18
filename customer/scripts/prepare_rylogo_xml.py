import os

svg_path = r"d:\upgrowa-workspace\rental-car\assets\images\rylogo.svg"
out_ts_path = r"d:\upgrowa-workspace\rental-car\src\assets\rylogoXml.ts"

os.makedirs(os.path.dirname(out_ts_path), exist_ok=True)

with open(svg_path, "r", encoding="utf-8") as f:
    xml_content = f.read()

# Clean XML content for SvgXml parser:
# Ensure viewBox is present
if 'viewBox' not in xml_content:
    xml_content = xml_content.replace('<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="1254" height="1254">', '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="1254" height="1254" viewBox="0 0 1254 1254">')

# Export as typescript string
ts_code = f"""// Generated from assets/images/rylogo.svg
export const rylogoXml = `{xml_content}`;
"""

with open(out_ts_path, "w", encoding="utf-8") as f:
    f.write(ts_code)

print(f"Successfully generated {out_ts_path} ({len(ts_code)} bytes)")
