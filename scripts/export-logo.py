"""Export the supplied PSD composite as a transparent web asset; no redrawing.

Usage: python scripts/export-logo.py "C:/path/Sady logo.psd"
Requires Pillow only at asset preparation time, not for the web build.
"""
from pathlib import Path
import sys
from PIL import Image

source = Path(sys.argv[1])
image = Image.open(source).convert("RGBA")
pixels = []
for red, green, blue, _ in image.getdata():
    if red == green == blue:
        # The PSD composite has a white matte and a black antialiased outline.
        # Recover outline coverage instead of leaving a white fringe on dark UI.
        pixels.append((0, 0, 0, 255 - red))
    else:
        pixels.append((red, green, blue, 255))
image.putdata(pixels)
bounds = image.getbbox()
if not bounds:
    raise ValueError("PSD composite is empty")
image = image.crop(bounds)
target = Path(__file__).resolve().parents[1] / "src" / "assets"
target.mkdir(parents=True, exist_ok=True)
for height, name in [(512, "moje-sady-logo.png"), (96, "moje-sady-icon.png")]:
    scaled = image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)
    padded = Image.new("RGBA", (scaled.width + 16, scaled.height + 16))
    padded.alpha_composite(scaled, (8, 8))
    padded.save(target / name, optimize=True)
print(f"Exported {source.name}: original bounds {bounds}, proportions {image.size}")
