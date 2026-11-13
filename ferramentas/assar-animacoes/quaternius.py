# Passa animações do Quaternius Universal Animation Library (.glb, esqueleto da Unreal) para o formato do anims.json (Mixamo)
# pela diferença de rotação de mundo de cada osso em relação à A_TPose. Uso no LEIAME.md desta pasta.
import json,struct,sys,gzip,numpy as np
def qmul(a,b):
    x1,y1,z1,w1=a; x2,y2,z2,w2=b
    return np.array([w1*x2+x1*w2+y1*z2-z1*y2, w1*y2-x1*z2+y1*w2+z1*x2, w1*z2+x1*y2-y1*x2+z1*w2, w1*w2-x1*x2-y1*y2-z1*z2])
def qinv(q): return np.array([-q[0],-q[1],-q[2],q[3]])
def qrot(q,v): return qmul(qmul(q,np.array([*v,0.0])),qinv(q))[:3]
def slerp(a,b,t):
    d=np.dot(a,b)
    if d<0: b=-b; d=-d
    if d>0.9995: r=a+(b-a)*t; return r/np.linalg.norm(r)
    th=np.arccos(d); return (np.sin((1-t)*th)*a+np.sin(t*th)*b)/np.sin(th)
def load(p):
    f=open(p,'rb').read(); l=struct.unpack('<I',f[12:16])[0]; j=json.loads(f[20:20+l])
    bl=struct.unpack('<I',f[20+l:24+l])[0]; bin_=f[28+l:28+l+bl]
    def acc(i):
        a=j['accessors'][i]; bv=j['bufferViews'][a['bufferView']]; n={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']]
        o=bv.get('byteOffset',0)+a.get('byteOffset',0)
        return np.frombuffer(bin_,dtype='<f4',count=a['count']*n,offset=o).reshape(a['count'],n)
    return j,acc
MAP={'pelvis':'Hips','spine_01':'Spine','spine_02':'Spine1','spine_03':'Spine2','neck_01':'Neck','Head':'Head'}
for s,S in (('l','Left'),('r','Right')):
    MAP.update({f'clavicle_{s}':f'{S}Shoulder',f'upperarm_{s}':f'{S}Arm',f'lowerarm_{s}':f'{S}ForeArm',f'hand_{s}':f'{S}Hand',
      f'thigh_{s}':f'{S}UpLeg',f'calf_{s}':f'{S}Leg',f'foot_{s}':f'{S}Foot',f'ball_{s}':f'{S}ToeBase'})
    for d,D in (('thumb','Thumb'),('index','Index'),('middle','Middle'),('ring','Ring'),('pinky','Pinky')):
        for k in (1,2,3): MAP[f'{d}_0{k}_{s}']=f'{S}Hand{D}{k}'
PAI={}
def _pais():
    for s_ in ('l','r'):
        PAI.update({f'clavicle_{s_}':'spine_03',f'upperarm_{s_}':f'clavicle_{s_}',f'lowerarm_{s_}':f'upperarm_{s_}',f'hand_{s_}':f'lowerarm_{s_}',f'thigh_{s_}':'pelvis',f'calf_{s_}':f'thigh_{s_}',f'foot_{s_}':f'calf_{s_}',f'ball_{s_}':f'foot_{s_}'})
        for d in ('thumb','index','middle','ring','pinky'):
            PAI[f'{d}_01_{s_}']=f'hand_{s_}'; PAI[f'{d}_02_{s_}']=f'{d}_01_{s_}'; PAI[f'{d}_03_{s_}']=f'{d}_02_{s_}'
    PAI.update({'spine_01':'pelvis','spine_02':'spine_01','spine_03':'spine_02','neck_01':'spine_03','Head':'neck_01'})
_pais()
class Src:
    def __init__(s,p):
        s.j,s.acc=load(p); N=s.j['nodes']; s.N=N
        s.par={c:i for i,n in enumerate(N) for c in n.get('children',[])}
        s.idx={n['name']:i for i,n in enumerate(N)}
        s.anims={a['name']:a for a in s.j['animations']}
    def pose(s,anim,t):
        N=s.N; T={i:np.array(n.get('translation',[0,0,0]),float) for i,n in enumerate(N)}
        R={i:np.array(n.get('rotation',[0,0,0,1]),float) for i,n in enumerate(N)}
        if anim:
            a=s.anims[anim]
            for c in a['channels']:
                sm=a['samplers'][c['sampler']]; ti=s.acc(sm['input'])[:,0]; v=s.acc(sm['output']); p=c['target']['path']; n=c['target']['node']
                if p=='scale': continue
                k=np.searchsorted(ti,t)
                if k<=0: val=v[0]
                elif k>=len(ti): val=v[-1]
                else:
                    u=(t-ti[k-1])/(ti[k]-ti[k-1]); val=slerp(v[k-1].astype(float),v[k].astype(float),u) if p=='rotation' else v[k-1]+(v[k]-v[k-1])*u
                (R if p=='rotation' else T)[n]=np.array(val,float)
        W={};P={}
        def w(i):
            if i in W: return
            if i in s.par:
                pi=s.par[i]; w(pi); W[i]=qmul(W[pi],R[i]); P[i]=P[pi]+qrot(W[pi],T[i])
            else: W[i]=R[i]; P[i]=T[i]
        for i in range(len(N)): w(i)
        return {N[i]['name']:(W[i],P[i]) for i in W}
    def dur(s,anim):
        a=s.anims[anim]; return max(float(s.acc(sm['input'])[-1,0]) for sm in a['samplers'])
def run(src,anim,rest,alt,refanim='A_TPose',fps=30,dmax=None):
    ref=src.pose(refanim,0.0)
    hipref=ref['pelvis'][1][1]
    d=src.dur(anim) if dmax is None else min(dmax,src.dur(anim))
    n=int(round(d*fps))+1; ts=[round(i/fps,4) for i in range(n)]
    tr={}
    for t in ts:
        P=src.pose(anim,min(t,d))
        for b,B in MAP.items():
            o='mixamorig'+B
            if o not in rest: continue
            D=qmul(P[b][0],qinv(ref[b][0]))
            pb=PAI.get(b)
            if pb: D=qmul(qinv(qmul(P[pb][0],qinv(ref[pb][0]))),D)
            ri=np.array(rest[o][0:4]); pm=np.array(rest[o][4:8])
            q=qmul(qmul(qinv(pm),D),qinv(ri))
            tr.setdefault(o+'.quaternion',[]).append(q)
        pp=P['pelvis'][1]*100*alt/(hipref*100)
        tr.setdefault('mixamorigHips.position',[]).append(pp)
    out=[]
    for k,vals in tr.items():
        if k.endswith('quaternion'):
            fl=[];prev=None
            for q in vals:
                if prev is not None and np.dot(prev,q)<0: q=-q
                prev=q; fl+= [round(float(x),4) for x in q]
        else: fl=[round(float(x),2) for v in vals for x in v]
        out.append([k,ts,fl])
    return {'d':round(d,3),'t':out}
if __name__=='__main__':
    A=json.loads(gzip.open(sys.argv[1]).read()); rest=A['_rest']['ossos']; alt=A['_rest']['alturaQuadril']
    out={}
    for spec in sys.argv[3:]:
        glb,anim,nome=spec.split(':'); s=Src(glb); out[nome]=run(s,anim,rest,alt); print(nome,out[nome]['d'])
    json.dump(out,open(sys.argv[2],'w'))
