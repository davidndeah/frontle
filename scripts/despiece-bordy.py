from PIL import Image
import numpy as np
from scipy import ndimage
import json

SRC = "frontend/public/bordy-m2.webp"; OUT = "frontend/public/bordy"
im = Image.open(SRC).convert("RGBA"); a = np.array(im); H, W = a.shape[:2]
al = a[:,:,3]; op = al > 12          # opacidad laxa: incluye bordes suaves
rgb = a[:,:,:3].astype(int); r,g,b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]

# --- BRAZOS: componentes conectados por OPACIDAD (están despegados) ---
lab, n = ndimage.label(op)
print("componentes opacos:", n)
for i in range(1, n+1):
    cnt = int((lab==i).sum())
    if cnt > 3000:
        ys, xs = np.where(lab==i)
        print(f"  comp {i}: {cnt}px caja=({xs.min()},{ys.min()})-({xs.max()},{ys.max()})")

masks = {}
masks["brazo-izq"] = lab == lab[1029, 293]
masks["brazo-der"] = lab == lab[1055, 1067]

# --- ANTENA: todo lo opaco por encima del domo ---
ant = np.zeros_like(op); ant[0:212, 600:760] = True
masks["antena"] = op & ant

# --- OREJAS: todo lo opaco dentro de su caja (incluye sombra) ---
ear = np.zeros_like(op); ear[440:660, 168:233] = True
masks["oreja-izq"] = op & ear
ear2 = np.zeros_like(op); ear2[440:668, 1099:1220] = True
masks["oreja-der"] = op & ear2

# --- BOCA: morado + su sombra, dilatado para no dejar fantasma ---
purple = op & (b > 70) & (b > g + 20) & (r > g)
lp, _ = ndimage.label(purple)
boca = lp == lp[764, 581]
boca = ndimage.binary_dilation(boca, iterations=9)
masks["boca"] = boca

for nom, m in masks.items(): print(f"{nom}: {int(m.sum())} px")

meta = {}
for nom, m in masks.items():
    ys, xs = np.where(m)
    x0,y0,x1,y1 = xs.min(), ys.min(), xs.max()+1, ys.max()+1
    rec = a[y0:y1, x0:x1].copy(); rec[~m[y0:y1, x0:x1]] = 0
    Image.fromarray(rec).save(f"{OUT}/{nom}.png")
    meta[nom] = {"x":int(x0),"y":int(y0),"w":int(x1-x0),"h":int(y1-y0)}
    print(f"  -> {nom}.png ({x0},{y0}) {x1-x0}x{y1-y0}")

# --- BASE ---
base = a.copy()
for nom, m in masks.items(): base[m] = 0
# rellenar huecos que estaban SOBRE la cabeza (boca y orejas) con el negro de la cabeza
cabeza = a[820, 640][:3]      # negro plano de la mejilla
for nom in ["boca"]:
    m = masks[nom]
    base[m,0],base[m,1],base[m,2],base[m,3] = cabeza[0],cabeza[1],cabeza[2],255
# orejas: solo rellenar la parte que solapaba la cabeza (no el aire)
cabeza_op = op.copy()
for nom in ["brazo-izq","brazo-der","antena","oreja-izq","oreja-der"]: cabeza_op &= ~masks[nom]
for nom in ["oreja-izq","oreja-der"]:
    m = masks[nom]
    borde = ndimage.binary_dilation(m, iterations=4) & cabeza_op
    if borde.sum() > 0:
        col = a[borde][:, :3].mean(axis=0).astype(int)
        solapa = m & ndimage.binary_dilation(cabeza_op, iterations=6)
        base[solapa,0],base[solapa,1],base[solapa,2],base[solapa,3] = col[0],col[1],col[2],255
Image.fromarray(base).save(f"{OUT}/base.png")
meta["base"]={"x":0,"y":0,"w":W,"h":H}; meta["_src"]={"w":W,"h":H}

# --- verificacion de reensamblaje ---
recon = Image.fromarray(base).convert("RGBA")
for nom in ["oreja-izq","oreja-der","antena","brazo-izq","brazo-der","boca"]:
    recon.alpha_composite(Image.open(f"{OUT}/{nom}.png").convert("RGBA"), (meta[nom]["x"], meta[nom]["y"]))
recon.save(f"{OUT}/_verificacion.png")
ra=np.array(recon).astype(int); oa=a.astype(int)
vis=(ra[:,:,3]>20)|(oa[:,:,3]>20); dif=np.abs(ra[:,:,:3]-oa[:,:,:3]).max(axis=2)[vis]
print(f"\n=== VERIF === px={int(vis.sum())} dif>24: {int((dif>24).sum())} media={dif.mean():.2f} max={dif.max()}")
json.dump(meta, open(f"{OUT}/piezas.json","w"), indent=2)


# ===== ojos: recorte + inpaint del degradado del visor =====
OUT = "frontend/public/bordy"
base = np.array(Image.open(f"{OUT}/base.png").convert("RGBA"))
meta = json.load(open(f"{OUT}/piezas.json"))
rgb = base[:,:,:3].astype(int); al = base[:,:,3]

# region del visor
VX0,VX1,VY0,VY1 = 230, 975, 395, 690
zona = np.zeros(al.shape, bool); zona[VY0:VY1, VX0:VX1] = True
oscuro = zona & (al>128) & (rgb.sum(axis=2) < 170)
lab, n = ndimage.label(oscuro)
ojos = []
for i in range(1, n+1):
    ys, xs = np.where(lab==i)
    w_,h_ = xs.max()-xs.min(), ys.max()-ys.min()
    if len(ys) < 1500: continue
    if not (60 <= w_ <= 130 and 60 <= h_ <= 130): continue
    if not (0.7 <= w_/max(1,h_) <= 1.4): continue
    ojos.append((xs.min(), ys.min(), xs.max(), ys.max(), len(ys)))
ojos.sort()
print("ojos detectados:", len(ojos))
for x0,y0,x1,y1,px in ojos:
    print(f"  caja=({x0},{y0})-({x1},{y1}) centro=({(x0+x1)//2},{(y0+y1)//2}) r~{(x1-x0)//2} px={px}")

# inpaint: por cada fila, interpolar entre el pixel sano de la izquierda y el de la derecha
m = oscuro.copy()
m = ndimage.binary_dilation(m, iterations=3)   # comerse el antialias del borde
sano = zona & (al>128) & ~m
for y in range(VY0, VY1):
    fila = np.where(m[y])[0]
    if len(fila)==0: continue
    # agrupar en tramos contiguos
    cortes = np.where(np.diff(fila) > 1)[0]
    tramos = np.split(fila, cortes+1)
    for t in tramos:
        xa, xb = t[0]-1, t[-1]+1
        while xa > VX0 and not sano[y, xa]: xa -= 1
        while xb < VX1-1 and not sano[y, xb]: xb += 1
        if not (sano[y,xa] and sano[y,xb]): continue
        ca, cb = base[y,xa,:3].astype(float), base[y,xb,:3].astype(float)
        for x in t:
            f = (x - xa) / max(1, (xb - xa))
            base[y,x,:3] = (ca*(1-f) + cb*f).astype(int)
            base[y,x,3] = 255

Image.fromarray(base).save(f"{OUT}/base.png")
meta["_ojos"] = [{"cx":int((o[0]+o[2])//2), "cy":int((o[1]+o[3])//2),
                  "rx":int((o[2]-o[0])//2), "ry":int((o[3]-o[1])//2)} for o in ojos]
json.dump(meta, open(f"{OUT}/piezas.json","w"), indent=2)
print("\nojos en meta:", meta["_ojos"])
