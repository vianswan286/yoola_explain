"""
This script generates scaled icon PNGs from the original icon.png in the same folder.
Output files: icon16.png, icon48.png, icon128.png
Usage: python3 generate_icons.py
Requires: Pillow
"""
from PIL import Image
import os

# Define icon sizes and output filenames
ICON_SIZES = {
    16: 'icon16.png',
    48: 'icon48.png',
    128: 'icon128.png',
}

# Path to the images directory (script location)
DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(DIR, 'icon.png')

if not os.path.exists(SRC):
    raise FileNotFoundError(f'Original icon not found: {SRC}')

with Image.open(SRC) as img:
    for size, out_name in ICON_SIZES.items():
        resized = img.convert('RGBA').resize((size, size), Image.LANCZOS)
        out_path = os.path.join(DIR, out_name)
        resized.save(out_path, format='PNG')
        print(f'Wrote {out_path}')
