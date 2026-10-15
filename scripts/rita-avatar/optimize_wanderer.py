"""Shrinks the Meshy "Little Light Wanderer" GLB for the web.

Run with Blender's python:  python optimize_wanderer.py <in.glb> <out.glb> [ratio] [texture_px]
Keeps the four textures (colour, metal/rough, normal, emissive) and the UVs.

Ratio matters: at 0.2 the eye rims, lips and chin turn ragged and the face looks distorted;
0.5 keeps the features. A per-region (vertex group) decimate was tried and tears the body.
"""
import sys

import bpy

src, dst = sys.argv[1], sys.argv[2]
ratio = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
tex_px = int(sys.argv[4]) if len(sys.argv) > 4 else 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
assert len(meshes) == 1, f"expected one mesh, found {len(meshes)}"
obj = meshes[0]
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
before = len(obj.data.polygons)

# Weld the seams the importer split, then collapse-decimate while keeping UV borders.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.00005)
bpy.ops.object.mode_set(mode="OBJECT")
mod = obj.modifiers.new("decimate", "DECIMATE")
mod.decimate_type = "COLLAPSE"
mod.ratio = ratio
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=mod.name)
after = len(obj.data.polygons)

for image in bpy.data.images:
    if image.size[0] > tex_px:
        image.scale(tex_px, tex_px)
print(f"faces {before} -> {after}; images", [(i.name, tuple(i.size)) for i in bpy.data.images])

bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_image_format="JPEG",
    export_jpeg_quality=82,
    export_yup=True,
    export_apply=True,
)
