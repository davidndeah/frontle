# ============================================================
#  Separa la CABEZA del CUERPO de Bordy (frontend/public/bordy/base.webp).
#
#  El rig por piezas (Bordy.tsx, despiece-bordy.py) ya tiene brazos, orejas,
#  antena y boca sueltos, pero cabeza y cuerpo seguían siendo una sola
#  imagen: la cabeza no podía quedarse atrás en un salto ni ladearse sola.
#  Este script las separa por el cuello.
#
#  · El cuello está donde la silueta es más angosta: en el arte de 1280x1520
#    es la fila 901 (la cabeza es negro puro y el cuerpo empieza un tono más
#    claro justo debajo). En base.webp (384x456, la misma imagen al 30 %) es
#    la fila 270.
#  · cabeza.webp = lo que está por encima del cuello.
#  · cuerpo.webp = lo de abajo, MÁS un "cuello" oscuro que sube por detrás de
#    la cabeza. Sin él, al ladear la cabeza asomaría un hueco transparente
#    entre su borde y el cuerpo. En reposo queda tapado por la cabeza.
#  · Las dos salen del mismo tamaño que base.webp y en la misma posición,
#    así que se apilan sin recalcular nada.
#
#  Uso (desde la raíz del repo):  python scripts/despiece-cabeza.py
# ============================================================

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

SRC = "frontend/public/bordy/base.webp"
OUT = "frontend/public/bordy"
NECK_Y = 270  # fila del cuello en base.webp

im = Image.open(SRC).convert("RGBA")
a = np.array(im)
H, W = a.shape[:2]

head = a.copy()
head[NECK_Y:, :, 3] = 0

body = a.copy()
body[:NECK_Y, :, 3] = 0

# Color del cuello: el tono del cuerpo justo debajo del corte, en el centro.
xs = np.where(a[NECK_Y + 3, :, 3] > 200)[0]
x0, x1 = int(xs.min()), int(xs.max())
neck_rgb = a[NECK_Y + 4, (x0 + x1) // 2, :3].tolist()

# Cuello: un rectángulo redondeado que sube ~36 px por detrás de la cabeza,
# del ancho del cuerpo en el corte, con el borde suavizado.
cap = Image.new("L", (W, H), 0)
d = ImageDraw.Draw(cap)
d.rounded_rectangle([x0 + 2, NECK_Y - 36, x1 - 2, NECK_Y + 6], radius=18, fill=255)
cap = cap.filter(ImageFilter.GaussianBlur(1.2))
cap_a = np.array(cap)
neck = np.zeros_like(a)
neck[..., 0], neck[..., 1], neck[..., 2] = neck_rgb
neck[..., 3] = cap_a

# El cuello va DEBAJO del cuerpo (el cuerpo lo tapa donde coinciden).
b_img = Image.alpha_composite(Image.fromarray(neck), Image.fromarray(body))

Image.fromarray(head).save(f"{OUT}/cabeza.webp", "WEBP", quality=90, method=6)
b_img.save(f"{OUT}/cuerpo.webp", "WEBP", quality=90, method=6)
print(f"cabeza.webp y cuerpo.webp ({W}x{H}); cuello en y={NECK_Y}, x {x0}-{x1}, color {neck_rgb}")
