# Textura das mechas do rabo: fios afinando até a ponta, com alfa (cartões de pelo)
import json,random,sys,math
from PIL import Image,ImageDraw,ImageFilter
cor=json.load(open(sys.argv[1])); out=sys.argv[2]
random.seed(7); N=256; SS=4; W=N*SS
im=Image.new('RGBA',(W,W),(0,0,0,0)); d=ImageDraw.Draw(im)
def c(nome,var):
    r,g,b=cor[nome]; k=1+random.uniform(-var,var)
    return tuple(min(255,int(255*x*k)) for x in (r,g,b))+(255,)
# base cheia na raiz (some dentro do rabo)
for i in range(130):
    x=random.uniform(0.02,0.98)*W; base=W; L=random.uniform(0.55,0.98)*W*(1-abs(x/W-0.5)*0.5)
    larg=random.uniform(0.035,0.07)*W; curva=random.uniform(-0.08,0.08)*W
    nome='escuro' if i<40 else ("meio" if i<95 else 'claro')
    pts_l=[];pts_r=[]
    for s in range(13):
        t=s/12; y=base-L*t; cx=x+curva*t*t; w=larg*(1-t)**0.8/2
        pts_l.append((cx-w,y)); pts_r.append((cx+w,y))
    d.polygon(pts_l+pts_r[::-1],fill=c(nome,0.12))
im=im.resize((N,N),Image.LANCZOS)
# raiz mais escura (sombra entre as mechas)
px=im.load()
for y in range(N):
    k=0.7+0.3*min(1,(N-1-y)/(N*0.35)) if y>N*0.6 else 1
    for x in range(N):
        r,g,b,a=px[x,y]; px[x,y]=(int(r*k),int(g*k),int(b*k),a)
im.save(out)
