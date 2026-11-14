import sys; sys.path.insert(0,'/tmp/claude-0/logo')
from logo import *
od=sys.argv[1]; LARG=float(sys.argv[2]) if len(sys.argv)>2 else 0.64
em,al=emblema("aoe")
bb=al.point(lambda v:255 if v>40 else 0).getbbox()
def anel_simples(cx,cy,R):
    m=anel(cx,cy,R,int(R*0.055)); d=ImageDraw.Draw(m)
    for k in range(4):
        a=k*math.pi/2+math.pi/2*0  # cima, direita, baixo, esquerda
        r1=R*1.16; r0=R*0.9; w=R*0.075
        px,py=cx+math.cos(a)*r1,cy+math.sin(a)*r1; bx,by=cx+math.cos(a)*r0,cy+math.sin(a)*r0
        mx,my=cx+math.cos(a)*R,cy+math.sin(a)*R
        nx,ny=-math.sin(a)*w,math.cos(a)*w
        d.polygon([(px,py),(mx+nx,my+ny),(bx,by),(mx-nx,my-ny)],fill=255)
    return m
def fundo():
    g=grad(S,S,0,S,[(0,(40,22,58)),(0.6,(22,12,34)),(1,(70,24,10))])
    brasas(g,(S*0.05,S*0.05,S*0.95,S*0.95),45,seed=9,tam=2.5); return g
def simbolo(larg):
    w=bb[2]-bb[0]; cx=(bb[0]+bb[2])/2; cy=(bb[1]+bb[3])/2; lado=w/larg
    box=(int(cx-lado/2),int(cy-lado/2),int(cx+lado/2),int(cy+lado/2))
    pad=Image.new("RGB",(S*3,S*3)); pad.paste(em,(S,S)); pa=L(S*3,S*3); pa.paste(al,(S,S))
    b=tuple(v+S for v in box)
    return pad.crop(b).resize((S,S),Image.LANCZOS), pa.crop(b).resize((S,S),Image.LANCZOS)
def compor(larg, com_fundo=True):
    img=fundo() if com_fundo else Image.new("RGB",(S,S))
    R=S*0.37; ring=anel_simples(S/2,S/2,R)
    # fundo dentro do anel um pouco mais claro (como o Aethra)
    if com_fundo:
        dentro=L(); ImageDraw.Draw(dentro).ellipse([S/2-R,S/2-R,S/2+R,S/2+R],fill=255)
        img.paste(solid((70,40,90)),(0,0),dentro.filter(ImageFilter.GaussianBlur(R*0.5)).point(lambda v:int(v*0.45)))
    brilho(img,ring,(255,120,30),30,0.9)
    metal(img,ring,S/2-R*1.16,S/2+R*1.16,9,[(0,(255,247,214)),(0.45,(248,200,92)),(0.55,(196,122,34)),(1,(255,214,120))])
    c,a=simbolo(larg); img=Image.composite(c,img,a)
    return img, ImageChops.lighter(ring,a)
if __name__=="__main__":
    img,_=compor(LARG); img.save(f"{od}/icone-anel-cheio.png")
    sq=img.resize((512,512),Image.LANCZOS); mk=L(512,512); ImageDraw.Draw(mk).rounded_rectangle([0,0,511,511],radius=110,fill=255)
    out=Image.new("RGBA",(512,512),(0,0,0,0)); out.paste(sq,(0,0),mk); out.save(f"{od}/icone-anel.png")
