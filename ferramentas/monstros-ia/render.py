import bpy,sys,math
src,od=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src)
sc=bpy.context.scene; arm=bpy.data.objects['Esqueleto']
sc.render.engine='CYCLES'; sc.cycles.samples=6; sc.cycles.device='CPU'; sc.cycles.use_denoising=False
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.9,0.95,1,1); w.node_tree.nodes['Background'].inputs[1].default_value=1.5
sd=bpy.data.lights.new('s','SUN'); sd.energy=3; so=bpy.data.objects.new('s',sd); sc.collection.objects.link(so); so.rotation_euler=(0.6,0.3,0.8)
sc.render.resolution_x=320; sc.render.resolution_y=240; sc.render.film_transparent=False
cd=bpy.data.cameras.new('c'); cd.type='ORTHO'; cd.ortho_scale=1.25
cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
vista=sys.argv[-3]
if vista=='lado': cam.location=(1.6,0,0.3); cam.rotation_euler=(math.radians(90),0,math.radians(90))
else: cam.location=(1.2,-1.2,0.6); cam.rotation_euler=(math.radians(75),0,math.radians(45))
for tr in arm.animation_data.nla_tracks: tr.mute=True
for tr in arm.animation_data.nla_tracks:
    a=tr.strips[0].action; arm.animation_data.action=a
    f0,f1=a.frame_range
    for i in range(4):
        sc.frame_set(int(f0+(f1-f0)*i/4)); sc.render.filepath=f'{od}/{tr.name}_{i}.png'; bpy.ops.render.render(write_still=True)
