import bpy,sys
src,base,emis,out=sys.argv[-4:]
bpy.ops.wm.open_mainfile(filepath=src)
o=bpy.data.objects['Lobo']; m=o.data.materials[0]; m.name='lobo'
nt=m.node_tree; bsdf=[n for n in nt.nodes if n.type=='BSDF_PRINCIPLED'][0]
tex=[n for n in nt.nodes if n.type=='TEX_IMAGE'][0]
tex.image=bpy.data.images.load(base); tex.image.name='lobo_cor'
e=nt.nodes.new('ShaderNodeTexImage'); e.image=bpy.data.images.load(emis); e.image.name='lobo_brilho'
nt.links.new(e.outputs['Color'],bsdf.inputs['Emission Color']); bsdf.inputs['Emission Strength'].default_value=2.0
bsdf.inputs['Roughness'].default_value=0.9; bsdf.inputs['Metallic'].default_value=0.0
for tr in bpy.data.objects['Esqueleto'].animation_data.nla_tracks: tr.mute=False
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',export_animations=True,export_animation_mode='ACTIONS',
  export_image_format='AUTO',export_skins=True,export_all_influences=False,export_yup=True,export_apply=False)
