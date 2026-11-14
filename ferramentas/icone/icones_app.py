import sys; sys.path.insert(0,'/tmp/claude-0/logo')
from logo import *
od=sys.argv[1]
em,al=emblema("aoe")  # 1400x1400; símbolo ocupa a faixa do meio
bb=al.point(lambda v:255 if v>40 else 0).getbbox(); print("bbox",bb)
def fundo(n):
    g=grad(S,S,0,S,[(0,(40,22,58)),(0.6,(22,12,34)),(1,(70,24,10))])
    brasas(g,(S*0.05,S*0.05,S*0.95,S*0.95),45,seed=9,tam=2.5)
    return g.resize((n,n),Image.LANCZOS)
def recorte(larg_frac,n):
    # símbolo centrado ocupando larg_frac da largura
    w=bb[2]-bb[0]; h=bb[3]-bb[1]; cx=(bb[0]+bb[2])/2; cy=(bb[1]+bb[3])/2
    lado=w/larg_frac; box=(int(cx-lado/2),int(cy-lado/2),int(cx+lado/2),int(cy+lado/2))
    pad=Image.new("RGB",(S*2,S*2)); pad.paste(em,(S//2,S//2)); pa=L(S*2,S*2); pa.paste(al,(S//2,S//2))
    b=tuple(v+S//2 for v in box)
    return pad.crop(b).resize((n,n),Image.LANCZOS), pa.crop(b).resize((n,n),Image.LANCZOS)
# frente adaptativa: zona segura = 66% do meio -> símbolo com ~60% da largura
c,a=recorte(0.60,432); fr=c.convert("RGBA"); fr.putalpha(a); fr.save(f"{od}/frente_432.png")
fundo(432).save(f"{od}/fundo_432.png")
mono=Image.new("RGBA",(432,432),(255,255,255,0)); mono.putalpha(a.point(lambda v:255 if v>90 else int(v*2.5))); mono.save(f"{od}/monocromatico_432.png")
# 192 cheio (ícone antigo e loja): símbolo com 82% da largura
c,a=recorte(0.84,768); f=fundo(768); f.paste(c,(0,0),a); f.resize((192,192),Image.LANCZOS).save(f"{od}/principal_192.png")
f.save(f"{od}/loja_768.png")
