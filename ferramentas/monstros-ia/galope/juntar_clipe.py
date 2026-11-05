# Põe o clipe exportado dentro do lobo.glb original sem mexer no resto (malha, mechas, brilho dos olhos, clipes antigos)
# python3 juntar_clipe.py lobo.glb galope_tmp.glb lobo_novo.glb galope=correr_cavalo
import json,struct,sys,numpy as np
def rd(p):
    b=open(p,'rb').read(); l=struct.unpack('<I',b[12:16])[0]; j=json.loads(b[20:20+l])
    o=20+l; bl=struct.unpack('<I',b[o:o+4])[0]; return j,bytearray(b[o+8:o+8+bl])
def acc(j,bin,i):
    a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
    off=bv.get('byteOffset',0)+a.get('byteOffset',0)
    return np.frombuffer(bytes(bin[off:off+a['count']*n*4]),dtype='<f4').reshape(a['count'],n)
dst,src=sys.argv[1],sys.argv[2]; out=sys.argv[3]; ren=dict(x.split('=') for x in sys.argv[4:])
J,B=rd(dst); S,SB=rd(src)
name2node={n['name']:i for i,n in enumerate(J['nodes'])}
# rest check
for i,n in enumerate(S['nodes']):
    if n.get('name') in name2node:
        m=J['nodes'][name2node[n['name']]]
        for k,dv in (('rotation',[0,0,0,1]),('translation',[0,0,0])):
            a=np.array(n.get(k,dv));b=np.array(m.get(k,dv))
            if np.abs(a-b).max()>1e-3 and np.abs(a+b).max()>1e-3: print('REST DIFF',n['name'],k,a,b)
def add(arr,typ,mm=False):
    global B
    while len(B)%4: B.append(0)
    off=len(B); B+=arr.astype('<f4').tobytes()
    J['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':arr.nbytes})
    a={'bufferView':len(J['bufferViews'])-1,'componentType':5126,'count':len(arr),'type':typ}
    if mm: a['min']=[float(arr.min())]; a['max']=[float(arr.max())]
    J['accessors'].append(a); return len(J['accessors'])-1
for an in S['animations']:
    if an['name'] not in ren: continue
    new={'name':ren[an['name']],'channels':[],'samplers':[]}
    for c in an['channels']:
        s=an['samplers'][c['sampler']]; nn=S['nodes'][c['target']['node']].get('name')
        if nn not in name2node: continue
        t=acc(S,SB,s['input']); v=acc(S,SB,s['output'])
        ti=add(t.reshape(-1),'SCALAR',True); vi=add(v,{1:'SCALAR',3:'VEC3',4:'VEC4'}[v.shape[1]])
        new['samplers'].append({'input':ti,'output':vi,'interpolation':s.get('interpolation','LINEAR')})
        new['channels'].append({'sampler':len(new['samplers'])-1,'target':{'node':name2node[nn],'path':c['target']['path']}})
    J['animations']=[a for a in J['animations'] if a['name']!=new['name']]+[new]
J['buffers'][0]['byteLength']=len(B)
js=json.dumps(J,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
while len(B)%4: B.append(0)
o=struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(B))+struct.pack('<II',len(js),0x4E4F534A)+js+struct.pack('<II',len(B),0x004E4942)+bytes(B)
open(out,'wb').write(o); print('ok',len(o))
