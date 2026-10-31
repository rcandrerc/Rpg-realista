import bpy,json
bpy.ops.wm.open_mainfile(filepath='lobo_rig.blend')
o=bpy.data.objects['Lobo']; me=o.data; uv=me.uv_layers.active.data
img=bpy.data.images.load('tex_clara.png'); W,H=img.size; px=img.pixels[:]
cs=[]
for p in me.polygons:
    for li in p.loop_indices:
        v=me.vertices[me.loops[li].vertex_index].co
        if v.y>0.24:
            u,w=uv[li].uv; i=(int(w%1*H)*W+int(u%1*W))*4; cs.append(px[i:i+3])
cs.sort(key=sum); n=len(cs)
q=lambda a,b:[sum(c[k] for c in cs[int(a*n):int(b*n)])/max(1,int(b*n)-int(a*n)) for k in range(3)]
json.dump({'escuro':q(0,0.25),'meio':q(0.35,0.65),'claro':q(0.8,1)},open('cor_rabo.json','w'))
