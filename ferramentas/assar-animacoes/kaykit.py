# Passa animações do KayKit Character Animations (CC0, Rig_Medium: hips/spine/chest/head, sem clavícula, pescoço nem dedos)
# para o formato do anims.json (Mixamo), do mesmo jeito do quaternius.py: diferença de rotação de mundo de cada osso em
# relação à T-Pose do pacote. Ossos que o KayKit não tem (clavícula, Spine1, pescoço, dedos) ficam na pose de descanso.
# Uso: python3 ferramentas/assar-animacoes/kaykit.py <anims.json.gz atual> <saída.json> <glb:Animação:nome> ...
import json,sys,gzip,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import quaternius as Q
Q.MAP.clear(); Q.PAI.clear()
Q.MAP.update({'hips':'Hips','spine':'Spine','chest':'Spine2','head':'Head'})
Q.PAI.update({'spine':'hips','chest':'spine','head':'chest'})
for s,S in (('l','Left'),('r','Right')):
    Q.MAP.update({f'upperarm.{s}':f'{S}Arm',f'lowerarm.{s}':f'{S}ForeArm',f'hand.{s}':f'{S}Hand',
        f'upperleg.{s}':f'{S}UpLeg',f'lowerleg.{s}':f'{S}Leg',f'foot.{s}':f'{S}Foot',f'toes.{s}':f'{S}ToeBase'})
    Q.PAI.update({f'upperarm.{s}':'chest',f'lowerarm.{s}':f'upperarm.{s}',f'hand.{s}':f'lowerarm.{s}',
        f'upperleg.{s}':'hips',f'lowerleg.{s}':f'upperleg.{s}',f'foot.{s}':f'lowerleg.{s}',f'toes.{s}':f'foot.{s}'})
_run=Q.run
def run(src,anim,rest,alt):
    # o quaternius.py mede o quadril pelo osso 'pelvis'; aqui é 'hips'
    ref=src.pose('T-Pose',0.0); hipref=ref['hips'][1][1]
    import numpy as np
    d=src.dur(anim); n=int(round(d*30))+1; ts=[round(i/30,4) for i in range(n)]
    tr={}
    for t in ts:
        P=src.pose(anim,min(t,d))
        for b,B in Q.MAP.items():
            o='mixamorig'+B
            if o not in rest: continue
            D=Q.qmul(P[b][0],Q.qinv(ref[b][0]))
            pb=Q.PAI.get(b)
            if pb: D=Q.qmul(Q.qinv(Q.qmul(P[pb][0],Q.qinv(ref[pb][0]))),D)
            ri=np.array(rest[o][0:4]); pm=np.array(rest[o][4:8])
            tr.setdefault(o+'.quaternion',[]).append(Q.qmul(Q.qmul(Q.qinv(pm),D),Q.qinv(ri)))
        tr.setdefault('mixamorigHips.position',[]).append(P['hips'][1]*alt/hipref)
    out=[]
    for k,vals in tr.items():
        if k.endswith('quaternion'):
            fl=[];prev=None
            for q in vals:
                if prev is not None and np.dot(prev,q)<0: q=-q
                prev=q; fl+=[round(float(x),4) for x in q]
        else: fl=[round(float(x),2) for v in vals for x in v]
        out.append([k,ts,fl])
    return {'d':round(d,3),'t':out}
if __name__=='__main__':
    A=json.loads(gzip.open(sys.argv[1]).read()); rest=A['_rest']['ossos']; alt=A['_rest']['alturaQuadril']
    out={}
    for spec in sys.argv[3:]:
        glb,anim,nome=spec.rsplit(':',2); s=Q.Src(glb); out[nome]=run(s,anim,rest,alt); print(nome,out[nome]['d'])
    json.dump(out,open(sys.argv[2],'w'))
