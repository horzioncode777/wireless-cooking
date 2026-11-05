"""Export browser icons from the existing Wireless Cooking logo."""
import base64
from io import BytesIO
from pathlib import Path

from PIL import Image

public = Path(__file__).resolve().parents[1] / 'frontend/public'
with Image.open(public / 'logo.png') as logo:
    # Keep the original pot, utensils and Wi-Fi emblem; omit the wordmark
    # because it cannot be read at the size of a browser tab.
    emblem = logo.convert('RGBA').crop((0, 0, 174, 211))
    square = Image.new('RGBA', (224, 224))
    square.alpha_composite(emblem, (25, 6))

icon = square.resize((64, 64), Image.Resampling.LANCZOS)
icon.save(public / 'wireless-cooking-icon.png', optimize=True)
square.save(public / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

# Also replace the old template icon for bookmarks using its original URL.
png = BytesIO()
icon.save(png, format='PNG', optimize=True)
encoded = base64.b64encode(png.getvalue()).decode('ascii')
(public / 'favicon.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    '<title>Wireless Cooking</title>'
    f'<image width="64" height="64" href="data:image/png;base64,{encoded}"/>'
    '</svg>\n', encoding='utf-8')
print('Browser icons exported from frontend/public/logo.png.')
