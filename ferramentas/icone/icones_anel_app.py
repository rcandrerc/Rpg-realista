import sys; sys.path.insert(0,'/tmp/claude-0/logo')
from icone_anel import *
od=sys.argv[1]
img,_=compor(0.62)
img.resize((192,192),Image.LANCZOS).save(f"{od}/principal_192.png")
# frente adaptativa: anel+símbolo sem fundo, dentro da zona segura (66% do meio)
fr,al=compor(0.62,com_fundo=False)
al=al.point(lambda v:255 if v>8 else 0).filter(ImageFilter.GaussianBlur(1))
lum=fr.convert("L").point(lambda v:min(255,v*3)); a=ImageChops.lighter(al,lum)
k=0.66/0.86; n=int(432*k)
fr2=fr.resize((n,n),Image.LANCZOS).convert("RGBA"); fr2.putalpha(a.resize((n,n),Image.LANCZOS))
out=Image.new("RGBA",(432,432),(0,0,0,0)); out.paste(fr2,((432-n)//2,(432-n)//2),fr2); out.save(f"{od}/frente_432.png")
fundo().resize((432,432),Image.LANCZOS).save(f"{od}/fundo_432.png")
mono=Image.new("RGBA",(432,432),(255,255,255,0)); ma=Image.new("L",(432,432),0); ma.paste(fr.convert("L").resize((n,n),Image.LANCZOS).point(lambda v:255 if v>110 else 0),((432-n)//2,(432-n)//2)); mono.putalpha(ma); mono.save(f"{od}/monocromatico_432.png")
