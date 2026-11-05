# Rabo do lobo: os pesos por distância (rig.py) deixaram a parte de baixo do rabo presa nas canelas e jarretes;
# no galope, com a pata de trás esticada, ela era puxada até o chão (um espinho). Aqui o peso das patas de trás
# atrás do quadril passa para o osso do rabo mais perto.
# python3 rabo_pesos.py lobo.glb saida.glb
import json,struct,sys,numpy as np
src,out=sys.argv[1],sys.argv[2]
b=open(src,'rb').read(); l=struct.unpack('<I',b[12:16])[0]; J=json.loads(b[20:20+l]); o=20+l; bl=struct.unpack('<I',b[o:o+4])[0]; B=bytearray(b[o+8:o+8+bl])
def lugar(i):
    a=J['accessors'][i]; bv=J['bufferViews'][a['bufferView']]; return bv.get('byteOffset',0)+a.get('byteOffset',0), a['count']
sk=J['skins'][0]; jn=[J['nodes'][i]['name'] for i in sk['joints']]
pr=[p for m in J['meshes'] for p in m['primitives'] if 'JOINTS_0' in p['attributes']][0]; at=pr['attributes']
o1,n=lugar(at['POSITION']); P=np.frombuffer(bytes(B[o1:o1+n*12]),'<f4').reshape(n,3)
o2,_=lugar(at['JOINTS_0']); Jo=np.frombuffer(bytes(B[o2:o2+n*4]),'u1').reshape(n,4).copy()
o3,_=lugar(at['WEIGHTS_0']); W=np.frombuffer(bytes(B[o3:o3+n*16]),'<f4').reshape(n,4).copy()
perna=[jn.index(x) for x in ['coxaE','coxaD','canelaE','canelaD','jarreteE','jarreteD','pataTE','pataTD']]
cauda=[jn.index('cauda%d'%i) for i in range(1,6)]
zc=np.array([-0.38,-0.46,-0.53,-0.61,-0.69]) # cabeça de cada osso do rabo (z do glTF; o rabo fica em z negativo)
mud=0
for v in np.where(P[:,2]<-0.33)[0]:
    t=min(1.0,max(0.0,(-0.33-P[v,2])/0.07)); t=t*t*(3-2*t)
    if t<=0: continue
    alvo=cauda[int(np.argmin(abs(zc-P[v,2])))]
    for s in range(4):
        if Jo[v,s] in perna and W[v,s]>0:
            w=W[v,s]*t; W[v,s]-=w
            k=[q for q in range(4) if Jo[v,q]==alvo]
            if not k:
                k=[q for q in range(4) if W[v,q]==0] or [s if W[v,s]<1e-4 else int(np.argmin(W[v]))]
                if W[v,k[0]]>0 and k[0]!=s: continue
                Jo[v,k[0]]=alvo
            W[v,k[0]]+=w; mud+=1
W/=W.sum(1,keepdims=True)
B[o2:o2+n*4]=Jo.astype('u1').tobytes(); B[o3:o3+n*16]=W.astype('<f4').tobytes()
js=json.dumps(J,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
o=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(B))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(B),0x004E4942)+bytes(B)
open(out,'wb').write(o); print('pesos mudados',mud)
