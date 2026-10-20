"""Renders every .excalidraw file here to PNG with Excalidraw's own exporter (exportToSvg) in headless Chrome.
Run with the backend venv (it has Playwright): backend/.venv/Scripts/python docs/diagrams/render_png.py"""

import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PAGE = """<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}#out svg{display:block}</style></head><body><div id="out"></div>
<script type="module">
window.EXCALIDRAW_ASSET_PATH = "https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/";
const { exportToSvg } = await import("https://esm.sh/@excalidraw/excalidraw@0.18.0?bundle&deps=react@18.3.1,react-dom@18.3.1");
window.renderScene = async (scene) => {
  const svg = await exportToSvg({ elements: scene.elements, files: scene.files || {},
    appState: { ...scene.appState, exportBackground: true, exportWithDarkMode: false, exportPadding: 24 } });
  const out = document.getElementById("out");
  out.innerHTML = "";
  out.appendChild(svg);
  await document.fonts.ready;
  const r = svg.getBoundingClientRect();
  return { width: Math.ceil(r.width), height: Math.ceil(r.height) };
};
window.ready = true;
</script></body></html>"""


async def main() -> None:
    files = sorted(HERE.glob("*.excalidraw"))
    async with async_playwright() as pw:
        # software rendering: GPU rasterisation can stall on low-memory machines
        browser = await pw.chromium.launch(executable_path=CHROME, headless=True, args=["--disable-gpu", "--disable-dev-shm-usage"])
        page = await browser.new_page(device_scale_factor=1.75, viewport={"width": 1600, "height": 1200})
        await page.set_content(PAGE)
        await page.wait_for_function("window.ready === true", timeout=120_000)
        for f in files:
            size = await page.evaluate("scene => window.renderScene(scene)", json.loads(f.read_text(encoding="utf-8")))
            await page.set_viewport_size({"width": max(size["width"], 400), "height": max(size["height"], 300)})
            await page.wait_for_timeout(400)
            png = f.with_suffix(".png")
            # the viewport is the SVG's size, so a clipped page shot needs no element "stable" wait
            await page.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": size["width"], "height": size["height"]},
                                  animations="disabled", caret="initial", timeout=180_000)
            print(f"{png.name}: {size['width']}x{size['height']} (2x)")
        await browser.close()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
