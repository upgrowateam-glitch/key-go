import os
import xml.etree.ElementTree as ET

svg_path = r"d:\upgrowa-workspace\rental-car\assets\images\rylogo.svg"

with open(svg_path, "r", encoding="utf-8") as f:
    content = f.read()

print(f"File Size: {len(content)} bytes")
print("First 1000 characters of rylogo.svg:")
print(content[:1000])

# Parse SVG root
root = ET.fromstring(content)
print("Root tag:", root.tag)
print("Root attribs:", root.attrib)

# Find all paths or elements
paths = root.findall(".//{http://www.w3.org/2000/svg}path")
print(f"Total path elements in rylogo.svg: {len(paths)}")
for i, p in enumerate(paths[:10]):
    print(f"Path {i}: fill={p.attrib.get('fill')}, stroke={p.attrib.get('stroke')}, d snippet={p.attrib.get('d', '')[:80]}")
