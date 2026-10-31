# Troca alphaMode BLEND por MASK (recorte) nos materiais do GLB: o Blender 4.2 exporta pelo como BLEND
import json,struct,sys
p=sys.argv[1]; b=open(p,'rb').read()
n=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+n]); resto=b[20+n:]
for m in j['materials']:
    if m.get('alphaMode')=='BLEND': m['alphaMode']='MASK'; m['alphaCutoff']=0.5
s=json.dumps(j,separators=(',',':')).encode(); s+=b' '*((4-len(s)%4)%4)
out=b'glTF'+struct.pack('<II',2,12+8+len(s)+len(resto))+struct.pack('<I',len(s))+b'JSON'+s+resto
open(p,'wb').write(out)
