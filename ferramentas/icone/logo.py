# Logo "Age of Embers" (André 2026-11-14). Fontes Cinzel Decorative/Cinzel (SIL OFL, Google Fonts) baixadas em FD.
# uso: python3 logo.py capa-sem-titulo.png pasta_saida aoe
import math, random, sys, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
FD="/tmp/claude-0/fontes/"
S=1400  # emblem canvas
def L(w=S,h=S): return Image.new("L",(w,h),0)
def font(n,sz): return ImageFont.truetype(FD+n,int(sz))
def texto(mask, txt, f, cx, cy, track=0):
    d=ImageDraw.Draw(mask); adv=[f.getlength(c) for c in txt]; tot=sum(adv)+track*(len(txt)-1)
    x=cx-tot/2; bb=f.getbbox("A"); h=bb[3]-bb[1]
    for c,a in zip(txt,adv): d.text((x,cy-h/2-bb[1]),c,font=f,fill=255); x+=a+track
def grad(w,h,y0,y1,stops):
    g=Image.new("RGB",(w,h)); d=ImageDraw.Draw(g)
    for y in range(h):
        t=min(1,max(0,(y-y0)/max(1,y1-y0)))
        for (a,ca),(b,cb) in zip(stops,stops[1:]):
            if a<=t<=b:
                k=(t-a)/(b-a) if b>a else 0; c=tuple(int(ca[i]+(cb[i]-ca[i])*k) for i in range(3)); break
        d.line([(0,y),(w,y)],fill=c)
    return g
OURO=[(0,(255,247,214)),(0.42,(248,200,92)),(0.55,(196,122,34)),(0.8,(232,140,40)),(1,(255,96,20))]
def solid(c,w=S,h=S): return Image.new("RGB",(w,h),c)
def metal(img, m, y0, y1, contorno=9, stops=OURO):
    w,h=img.size
    sdw=m.filter(ImageFilter.MaxFilter(contorno)).filter(ImageFilter.GaussianBlur(4))
    off=L(w,h); off.paste(sdw,(5,7))
    img.paste(solid((14,5,2),w,h),(0,0),off)
    img.paste(solid((46,16,6),w,h),(0,0),m.filter(ImageFilter.MaxFilter(contorno)))
    img.paste(grad(w,h,y0,y1,stops),(0,0),m)
    inner=ImageChops.subtract(m,m.filter(ImageFilter.MinFilter(5)))
    img.paste(solid((255,250,228),w,h),(0,0),inner.point(lambda v:int(v*.55)))
def brilho(img,m,cor,r,f):
    w,h=img.size; g=m.filter(ImageFilter.GaussianBlur(r)).point(lambda v:min(255,int(v*f)))
    img.paste(solid(cor,w,h),(0,0),g)
def chama(cx,cy,w,h,w2=None):
    m=L(); d=ImageDraw.Draw(m); pts=[]
    for i in range(200):
        t=i/199*2*math.pi
        x=cx+w*math.sin(t)*(math.sin(t/2)**1.6); y=cy-h*math.cos(t)*0.5-h*0.5*0+0
        pts.append((x,y))
    d.polygon(pts,fill=255); return m
def flama(cx,base,w,h):
    # teardrop com ponta para cima: base em 'base'
    m=L(); d=ImageDraw.Draw(m); pts=[]
    for i in range(240):
        t=i/239*2*math.pi
        x=cx+w*math.sin(t)*(math.sin(t/2)**1.3)
        y=base-h*(1-math.cos(t))/2* -1  # 0..h
        pts.append((x, base - h*(1+math.cos(t))/2))
    d.polygon(pts,fill=255); return m.filter(ImageFilter.GaussianBlur(2))
def fogo(img,cx,base,w,h,seed=5):
    random.seed(seed); heat=L()
    for i in range(9):
        dx=random.uniform(-0.55,0.55)*w; hh=h*random.uniform(0.5,1.05)*(1-abs(dx)/w*0.6)
        ww=w*random.uniform(0.22,0.42)
        heat=ImageChops.lighter(heat,flama(cx+dx,base,ww,hh).point(lambda v:int(v*0.55)))
    heat=ImageChops.add(heat,flama(cx,base,w*0.7,h*0.8).point(lambda v:int(v*0.5)))
    heat=heat.filter(ImageFilter.GaussianBlur(w*0.035))
    core=flama(cx,base-h*0.03,w*0.42,h*0.5).filter(ImageFilter.GaussianBlur(w*0.12))
    heat=ImageChops.add(heat,core.point(lambda v:int(v*0.45)))
    brilho(img,heat,(255,80,10),w*0.5,1.4)
    lut=[]
    for v in range(256):
        t=v/255
        if t<0.25: c=(int(180*t/0.25),int(30*t/0.25),5)
        elif t<0.55: k=(t-.25)/.3; c=(int(180+75*k),int(30+90*k),int(5+10*k))
        elif t<0.8: k=(t-.55)/.25; c=(255,int(120+90*k),int(15+50*k))
        else: k=(t-.8)/.2; c=(255,int(210+40*k),int(65+170*k))
        lut.append(c)
    col=Image.new("RGB",(S,S)); px=heat.load(); cp=col.load()
    bx=heat.getbbox()
    for y in range(bx[1],bx[3]):
        for x in range(bx[0],bx[2]): cp[x,y]=lut[px[x,y]]
    img.paste(col,(0,0),heat.point(lambda v:min(255,v*3)))
def fogo_velho(img,cx,base,w,h):
    out=flama(cx,base,w,h); mid=flama(cx,base-h*0.02,w*0.68,h*0.74); core=flama(cx,base-h*0.03,w*0.36,h*0.45)
    brilho(img,out,(255,90,10),40,1.6)
    img.paste(grad(S,S,base-h,base,[(0,(255,120,20)),(1,(200,40,8))]),(0,0),out)
    img.paste(grad(S,S,base-h*.8,base,[(0,(255,200,60)),(1,(255,110,20))]),(0,0),mid)
    img.paste(solid((255,246,200)),(0,0),core)
def anel(cx,cy,R,e):
    m=L(); d=ImageDraw.Draw(m)
    d.ellipse([cx-R,cy-R,cx+R,cy+R],fill=255); d.ellipse([cx-R+e,cy-R+e,cx+R-e,cy+R-e],fill=0)
    return m
def anel_runico(cx,cy,R):
    m=ImageChops.lighter(anel(cx,cy,R,int(R*.07)),anel(cx,cy,R*.86,int(R*.025)))
    d=ImageDraw.Draw(m)
    for k in range(4):  # pontas de bússola como no ícone atual
        a=k*math.pi/2; r1=R*1.13; r0=R*0.93; w=R*0.06
        px,py=cx+math.cos(a)*r1,cy+math.sin(a)*r1; bx,by=cx+math.cos(a)*r0,cy+math.sin(a)*r0
        nx,ny=-math.sin(a)*w,math.cos(a)*w
        d.polygon([(px,py),(bx+nx,by+ny),(bx-nx,by-ny)],fill=255)
    for k in range(24):
        a=k*2*math.pi/24+math.pi/24; r=R*0.93
        x,y=cx+math.cos(a)*r,cy+math.sin(a)*r; s=R*0.018
        d.ellipse([x-s,y-s,x+s,y+s],fill=255)
    return m
def espada(cx,topo,fundo,lg):
    m=L(); d=ImageDraw.Draw(m); gy=fundo-(fundo-topo)*0.22
    d.polygon([(cx,topo),(cx+lg/2,topo+lg*1.4),(cx+lg/2,gy),(cx-lg/2,gy),(cx-lg/2,topo+lg*1.4)],fill=255)
    d.rounded_rectangle([cx-lg*2.3,gy,cx+lg*2.3,gy+lg*0.55],radius=lg*0.25,fill=255)
    d.rectangle([cx-lg*0.32,gy,cx+lg*0.32,fundo-lg*0.5],fill=255)
    d.ellipse([cx-lg*0.6,fundo-lg*1.1,cx+lg*0.6,fundo+lg*0.1],fill=255); return m
def cajado(cx,topo,fundo,lg):
    m=L(); d=ImageDraw.Draw(m)
    d.rectangle([cx-lg*0.28,topo+lg*1.2,cx+lg*0.28,fundo],fill=255)
    d.ellipse([cx-lg*0.9,topo-lg*0.4,cx+lg*0.9,topo+lg*1.4],fill=255); return m
def gira(m,ang,cx,cy): return m.rotate(ang,center=(cx,cy),resample=Image.BICUBIC)
def brasas(img,box,n,seed=3,tam=1.0):
    random.seed(seed); w,h=img.size
    x0,y0,x1,y1=box; pts=L(w,h); d=ImageDraw.Draw(pts)
    for i in range(n):
        x=random.uniform(x0,x1); y=random.uniform(y0,y1); s=random.choice([1,1,1.5,2,2.5,3.5])*tam
        if random.random()<0.25:  # risquinho subindo
            d.line([(x,y),(x+random.uniform(-4,4)*tam,y+random.uniform(6,14)*tam)],fill=200,width=max(1,int(s)))
        d.ellipse([x-s,y-s,x+s,y+s],fill=255)
    img.paste(solid((255,80,10),w,h),(0,0),pts.filter(ImageFilter.GaussianBlur(6*tam)).point(lambda v:min(255,v*3)))
    img.paste(solid((255,170,60),w,h),(0,0),pts.filter(ImageFilter.GaussianBlur(1.5)))
    img.paste(solid((255,240,200),w,h),(0,0),pts.filter(ImageFilter.MinFilter(3)))

def emblema(tipo):
    img=Image.new("RGB",(S,S),(0,0,0)); alpha=L()
    cx,cy=S/2,S*0.47
    if tipo=="aoe":
        F=font("cdb.ttf",S*0.42)
        m=L(); texto(m,"A",F,cx-S*0.33,cy)
        texto(m,"E",F,cx+S*0.33,cy)
        o=anel(cx,cy,S*0.17,int(S*0.05))
        brilho(img,ImageChops.lighter(m,o),(255,110,20),46,1.3)
        fogo(img,cx,cy+S*0.13,S*0.10,S*0.30)
        metal(img,o,cy-S*0.18,cy+S*0.18)
        metal(img,m,cy-S*0.2,cy+S*0.2)
        alpha=ImageChops.lighter(m,o)
    elif tipo=="anel":
        R=S*0.36
        ring=anel_runico(cx,cy,R)
        F=font("cdb.ttf",S*0.40)
        a=L(); texto(a,"A",F,cx-S*0.115,cy+S*0.01)
        e=L(); texto(e,"E",F,cx+S*0.13,cy+S*0.01)
        sw=L()
        brilho(img,ring,(255,100,15),50,1.1)
        fogo(img,cx,cy+R*0.82,R*0.55,R*1.25)
        metal(img,ring,cy-R,cy+R)
        brilho(img,ImageChops.lighter(a,e),(255,90,10),30,1.2)
        metal(img,e,cy-S*0.15,cy+S*0.15); metal(img,a,cy-S*0.15,cy+S*0.15)
        alpha=ImageChops.lighter(ring,sw)
    elif tipo=="chama":
        R=S*0.36
        ring=anel_runico(cx,cy,R)
        sw=gira(espada(cx,cy-R*1.15,cy+R*1.1,S*0.05),-38,cx,cy)
        st=gira(cajado(cx,cy-R*1.1,cy+R*1.12,S*0.045),38,cx,cy)
        brilho(img,ring,(255,100,15),50,1.1)
        metal(img,ring,cy-R,cy+R)
        metal(img,st,cy-R,cy+R,9,[(0,(150,95,50)),(1,(80,45,20))])
        metal(img,sw,cy-R,cy+R,7,[(0,(240,248,255)),(0.6,(150,180,215)),(1,(200,210,230))])
        fogo(img,cx,cy+R*0.66,R*0.5,R*1.3)
        alpha=ImageChops.lighter(ring,ImageChops.lighter(sw,st))
    # alpha: tudo que não é preto
    lum=img.convert("L").point(lambda v:min(255,v*3))
    return img, lum

def cartaz(tipo, capa, saida, icone_saida):
    em,al=emblema(tipo)
    cv=Image.open(capa).convert("RGB"); W=1920; cv=cv.resize((W,round(cv.height*W/cv.width)),Image.LANCZOS); H=cv.height
    # emblema grande à esquerda (onde ficava "AETHRA")
    E=int(H*0.50); emr=em.resize((E,E),Image.LANCZOS); alr=al.resize((E,E),Image.LANCZOS)
    cx=int(W*0.255); top=int(H*0.06)
    veu=L(W,H); veu.paste(alr.filter(ImageFilter.GaussianBlur(30)),(cx-E//2,top))
    cv.paste(solid((12,6,20),W,H),(0,0),veu.point(lambda v:int(v*0.45)))
    lay=Image.new("RGB",(W,H)); lay.paste(emr,(cx-E//2,top)); m=L(W,H); m.paste(alr,(cx-E//2,top))
    cv=Image.composite(lay,cv,m)
    # nome menor embaixo
    F=font("cd.ttf",H*0.072); tm=L(W,H); ty=top+E*0.93
    texto(tm,"Age of Embers",F,cx,ty,int(F.size*0.04))
    F2=ImageFont.truetype(FD+"cz.ttf",int(H*0.026)); F2.set_variation_by_name("Black")
    sm=L(W,H)  # sem frase embaixo (André 2026-11-14)
    both=ImageChops.lighter(tm,sm)
    cv.paste(solid((10,6,24),W,H),(0,0),both.filter(ImageFilter.GaussianBlur(26)).point(lambda v:min(255,int(v*1.0))))
    brilho(cv,tm,(255,120,30),10,0.8)
    bb=tm.getbbox(); metal(cv,tm,bb[1],bb[3],7,[(0,(255,247,214)),(0.45,(248,200,92)),(0.6,(196,122,34)),(1,(255,190,90))])
    pass
    brasas(cv,(cx-E*0.6,top+E*0.15,cx+E*0.6,ty+H*0.12),70,seed=len(tipo),tam=1.3)
    cv.save(saida,quality=92)
    # ícone 512 com fundo noite
    ic=Image.new("RGB",(S,S)); ic.paste(grad(S,S,0,S,[(0,(40,22,58)),(0.6,(22,12,34)),(1,(60,20,10))]),(0,0))
    ic=Image.composite(em,ic,al); brasas(ic,(S*0.1,S*0.1,S*0.9,S*0.9),40,seed=9,tam=2.5)
    ic=ic.resize((512,512),Image.LANCZOS)
    mk=L(512,512); ImageDraw.Draw(mk).rounded_rectangle([0,0,511,511],radius=110,fill=255)
    out=Image.new("RGBA",(512,512),(0,0,0,0)); out.paste(ic,(0,0),mk); out.save(icone_saida)
if __name__=="__main__":
    capa=sys.argv[1]; od=sys.argv[2]
    for t in sys.argv[3:]: cartaz(t,capa,f"{od}/capa-{t}.jpg",f"{od}/icone-{t}.png")
