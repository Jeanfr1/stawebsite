#!/usr/bin/env python3
"""Measure the kit once, so the scroll scene can line its layers up exactly.

Writes src/data/scene.json:
  car      every car state (reveal, hero, scan, wireframe, cutaway) registered on hero-desktop
           with SIFT + RANSAC; they all share one frame, so the scene can crossfade in place
  scan     the curved scan plane of carro-scan.png, traced row by row (icy, blue-white pixels)
  engine   the three groups registered on motor-montado (assembled pose) and on
           motor-explodido (the kit's master, used for the spacing of the separation)
  parts    alpha boxes of every cut-out, used to crop the web images and to place them

Needs Python 3 with opencv-python and numpy (SIFT ships with OpenCV >= 4.4).
Run from the repository root:  python3 scripts/register-scene.py
"""
import json
import math
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "automotives-sta-assets-animacao"
OUT = ROOT / "src" / "data" / "scene.json"
MANIFEST = json.loads((KIT / "manifesto-imagens.json").read_text())
BOX = {m["arquivo"]: m.get("caixa_alpha") for m in MANIFEST}

sift = cv2.SIFT_create(8000)
clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))


def gray(path):
    im = cv2.imread(str(KIT / path), cv2.IMREAD_UNCHANGED)
    g = cv2.cvtColor(im[:, :, :3], cv2.COLOR_BGR2GRAY)
    mask = None
    if im.shape[2] == 4:
        mask = (im[:, :, 3] > 20).astype(np.uint8) * 255
        g = (g.astype(np.float32) * (im[:, :, 3] / 255.0)).astype(np.uint8)
    return clahe.apply(g), mask


def similarity(src_path, dst_path, ratio=0.75, thresh=4.0):
    """Similarity (scale, rotation, translation) taking src pixels onto dst pixels."""
    gs, ms = gray(src_path)
    gd, md = gray(dst_path)
    ks, ds = sift.detectAndCompute(gs, ms)
    kd, dd = sift.detectAndCompute(gd, md)
    pairs = cv2.BFMatcher().knnMatch(ds, dd, k=2)
    good = [a for a, b in pairs if a.distance < ratio * b.distance]
    src = np.float32([ks[m.queryIdx].pt for m in good])
    dst = np.float32([kd[m.trainIdx].pt for m in good])
    M, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=thresh, maxIters=20000)
    s = math.hypot(M[0, 0], M[1, 0])
    r = math.degrees(math.atan2(M[1, 0], M[0, 0]))
    # CSS matrix order: a b c d e f  (x' = a x + c y + e, y' = b x + d y + f)
    css = [M[0, 0], M[1, 0], M[0, 1], M[1, 1], M[0, 2], M[1, 2]]
    return {
        "matrix": [round(float(v), 5) for v in css],
        "scale": round(s, 5),
        "rotation_deg": round(r, 3),
        "matches": len(good),
        "inliers": int(inliers.sum()),
    }


def apply(css, p):
    a, b, c, d, e, f = css
    return [a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f]


# ---------- car states ----------
HERO = "01-hero/hero-desktop.png"
car = {"width": 1672, "height": 941, "states": {}}
for key, path in [
    ("reveal", "01-hero/reveal-escuro.png"),
    ("scan", "02-animacao/carro-scan.png"),
    ("wireframe", "02-animacao/carro-wireframe.png"),
    ("cutaway", "02-animacao/carro-cutaway.png"),
    ("cutout", "01-hero/carro-transparente.png"),
]:
    reg = similarity(path, HERO, ratio=0.7, thresh=3.0)
    m = reg["matrix"]
    reg["offset_px"] = round(math.hypot(m[4], m[5]), 2)
    car["states"][key] = reg
car["note"] = "All states sit within about a pixel of hero-desktop, so the scene uses one frame for all of them."
car["box"] = BOX["01-hero/carro-transparente.png"]

# Points of interest on the car frame, read off a 50 px grid laid over the images
# (headlight, front wheel, the engine inside the cutaway).
car["focus"] = {
    "headlight": [690, 505],
    "front_wheel": [918, 640],
    "engine": {"box": [330, 425, 620, 615], "note": "engine block under the bonnet of carro-cutaway.png"},
}

# ---------- the scan plane ----------
# Right of the plane carro-scan.png is the hero itself, so the plane is where the two images stop
# differing: per row, the right-most column (near the front wheel) that still differs, glow included.
scan = cv2.imread(str(KIT / "02-animacao/carro-scan.png")).astype(np.float32)
hero = cv2.imread(str(KIT / HERO)).astype(np.float32)
diff = cv2.GaussianBlur(np.abs(scan - hero).max(axis=2), (9, 9), 0)
ys, xs = [], []
for y in range(262, 860, 6):
    hit = np.where(diff[y, 850:1080] > 40)[0]
    if len(hit):
        ys.append(y)
        xs.append(850 + int(hit.max()))
ys, xs = np.array(ys), np.array(xs)
# robust smooth fit x(y): cubic, refit without the rows where a wheel spoke or reflection differs
coef = np.polyfit(ys, xs, 3)
keep = np.abs(np.polyval(coef, ys) - xs) < 12
coef = np.polyfit(ys[keep], xs[keep], 3)
plane = [[round(float(np.polyval(coef, y)), 1), int(y)] for y in np.linspace(262, 820, 12)]
scan_out = {
    "plane": plane,
    "core_offset": -12,
    "samples": int(keep.sum()),
    "note": "outer edge of the scan plane (glow included); the bright core sits ~12 px to its left. Left of it carro-scan.png is wireframe, right of it it equals the hero.",
}

# ---------- engine ----------
MONT = "02-animacao/motor-montado-transparente.png"
MASTER = "02-animacao/motor-explodido.png"
groups = {}
for key, path in [
    ("base", "02-animacao/grupo-base-transparente.png"),
    ("heads", "02-animacao/grupo-cabecotes-transparente.png"),
    ("intake", "02-animacao/grupo-admissao-transparente.png"),
]:
    assembled = similarity(path, MONT)
    exploded = similarity(path, MASTER)
    box = BOX[path]
    centre = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2]
    groups[key] = {
        "file": path,
        "box": box,
        "assembled": assembled,
        "exploded": exploded,
        "centre_assembled": [round(v, 1) for v in apply(assembled["matrix"], centre)],
        "centre_master": [round(v, 1) for v in apply(exploded["matrix"], centre)],
    }

# Spacing of the separation, taken from the master but expressed on the assembled engine:
# the master is drawn smaller (it has to fit three stacked groups), so its offsets are scaled up
# by the mean master -> assembled ratio, and measured from the heads, which stay put.
ratio = float(np.mean([g["assembled"]["scale"] / g["exploded"]["scale"] for g in groups.values()]))
h_master = groups["heads"]["centre_master"]
h_asm = groups["heads"]["centre_assembled"]
for g in groups.values():
    target = [h_asm[0] + (g["centre_master"][0] - h_master[0]) * ratio, h_asm[1] + (g["centre_master"][1] - h_master[1]) * ratio]
    g["spread"] = [round(target[0] - g["centre_assembled"][0], 1), round(target[1] - g["centre_assembled"][1], 1)]

engine = {
    "width": 1536,
    "height": 1024,
    "box": BOX[MONT],
    "master_box": BOX[MASTER],
    "master_to_assembled_ratio": round(ratio, 4),
    "groups": groups,
    "order": ["base", "heads", "intake"],
}

parts = {
    key: {"file": path, "box": BOX[path]}
    for key, path in [
        ("brake", "03-servicos/freio-transparente.png"),
        ("filter", "03-servicos/filtro-transparente.png"),
        ("suspension", "03-servicos/suspensao-transparente.png"),
        ("logo", "05-marca/logo-sta-transparente.png"),
        ("monogram", "05-marca/monograma-sta-transparente.png"),
    ]
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"car": car, "scan": scan_out, "engine": engine, "parts": parts}, indent=2) + "\n")
print("wrote", OUT.relative_to(ROOT))
for k, v in car["states"].items():
    print(f"  car/{k:10s} offset {v['offset_px']:5.2f}px  scale {v['scale']:.4f}  inliers {v['inliers']}")
print("  scan plane", plane[0], "->", plane[-1], f"({scan_out['samples']} rows)")
for k, g in groups.items():
    print(f"  engine/{k:7s} asm s={g['assembled']['scale']:.3f} r={g['assembled']['rotation_deg']:.2f} inl={g['assembled']['inliers']:4d}  spread {g['spread']}")
