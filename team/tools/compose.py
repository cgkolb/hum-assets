#!/usr/bin/env python3
"""Crop a headshot to a square with a flat background and a consistent head size.

Swift/Vision supplies the face box and the subject matte; the compositing is
done here in plain 8-bit sRGB so the background colour lands exactly as asked.
"""
import json, subprocess, sys, os
from PIL import Image, ImageOps, ImageFilter

SP = os.path.dirname(os.path.abspath(__file__))
DETECT = os.path.join(SP, "detect")


def build(src, dst, size=800, face_frac=0.30, face_cy=0.44, bg="#1A1A1A",
          feather=1.5, erode=0):
    mask_png = os.path.join(SP, "_mask.png")
    meta = json.loads(subprocess.run(
        [DETECT, src, mask_png], capture_output=True, text=True, check=True).stdout)

    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    if im.size != (int(meta["w"]), int(meta["h"])):
        raise SystemExit(f"orientation mismatch: PIL {im.size} vs Vision "
                         f"{int(meta['w'])}x{int(meta['h'])}")

    rgba = im.convert("RGBA")
    if meta["mask"]:
        m = Image.open(mask_png).convert("L").resize(im.size, Image.LANCZOS)
        # Pull the matte in before feathering. A bright original backdrop
        # leaves a light rim around hair and shoulders otherwise.
        for _ in range(int(erode)):
            m = m.filter(ImageFilter.MinFilter(3))
        # Soften the edge a touch so hair doesn't look cut out.
        m = m.filter(ImageFilter.GaussianBlur(feather))
        rgba.putalpha(m)

    # Composite onto the flat background, then crop. Pad generously first so a
    # crop may run past the original edges and simply pick up more backdrop.
    S = meta["fh"] / face_frac
    fcx = meta["fx"] + meta["fw"] / 2.0
    fcy = meta["fy"] + meta["fh"] / 2.0
    left = fcx - S / 2.0
    top = fcy - (1.0 - face_cy) * S

    pad = int(max(0, -left, -top,
                  (left + S) - im.size[0], (top + S) - im.size[1]) + 4)
    canvas = Image.new("RGB", (im.size[0] + 2 * pad, im.size[1] + 2 * pad), bg)
    canvas.paste(rgba, (pad, pad), rgba)

    box = (round(left) + pad, round(top) + pad,
           round(left + S) + pad, round(top + S) + pad)
    out = canvas.crop(box).resize((size, size), Image.LANCZOS)
    out.save(dst, "JPEG", quality=88, optimize=True, progressive=True)
    return dict(meta, crop=round(S), upscale=round(size / S, 2))


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    kw = {}
    for a in sys.argv[3:]:
        k, v = a.split("=")
        kw[k] = v if k == "bg" else float(v)
    if "size" in kw:
        kw["size"] = int(kw["size"])
    print(json.dumps(build(src, dst, **kw)))
