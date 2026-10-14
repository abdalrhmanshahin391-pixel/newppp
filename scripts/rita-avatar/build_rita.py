"""
Prepare Rita for the web from an AI-generated T-pose mesh (Meshy GLB).

What it does
1. Imports the source GLB, drops its textures and materials.
2. (Our own eyes and mouth are placed over the sculpted eye rings and smile.)
3. Scales to 1.7 m, puts the feet on the ground, centres the body.
4. Decimates to ~18k triangles with flat shading (keeps the faceted look).
5. Builds a skeleton and skins the mesh with hand-written weights.
6. Adds two eyes (Blink shape key) and a mouth (Open/Wide/Round/Smile shape keys).
7. Exports a skinned GLB for src/components/rita-live/RitaAvatar.tsx.

Usage (Blender as a Python module, no GUI needed):
    python3 -m venv .venv && .venv/bin/pip install bpy==5.2.2
    .venv/bin/python scripts/rita-avatar/build_rita.py -- SOURCE.glb src/assets/rita-avatar.glb

The viewer relies on the bone names below and on the mesh names Body, EyeL, EyeR,
Mouth; the shape keys Blink (eyes) and Open/Wide/Round/Smile (mouth); and the
material names Ivory, Eye, Mouth.
"""

import math
import sys

import bpy  # noqa: I001  (bpy must load before bmesh)
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
SRC = args[0] if len(args) > 0 else "muse.glb"
OUT = args[1] if len(args) > 1 else "src/assets/rita-avatar.glb"
TARGET_TRIS = 18000

# ---- measurements taken from the source mesh (its own units, Z up, faces -Y) ----
SRC_FEET_Z = -0.953
SRC_CENTER_Y = -0.10
SCALE = 0.9  # 1.9 -> 1.71 m
EYE_SRC = [(0.0605, -0.241, 0.604), (-0.0605, -0.241, 0.604)]
MOUTH_SRC = (0.003, -0.254, 0.538)


def T(p):
    """Source coordinates -> final coordinates (metres)."""
    return Vector(((p[0]) * SCALE, (p[1] - SRC_CENTER_Y) * SCALE, (p[2] - SRC_FEET_Z) * SCALE))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ import and clean up
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=SRC)
body = [o for o in bpy.data.objects if o.type == "MESH"][0]
body.name = "Body"
bpy.context.view_layer.objects.active = body
body.select_set(True)
body.data.materials.clear()
for image in list(bpy.data.images):
    bpy.data.images.remove(image)
body.data.uv_layers.clear() if hasattr(body.data.uv_layers, "clear") else None

# Scale, ground and centre; then decimate with flat shading.
for v in body.data.vertices:
    v.co = T(v.co)
body.data.update()
n = len(body.data.polygons)
mod = body.modifiers.new("Decimate", "DECIMATE")
mod.decimate_type = "COLLAPSE"
mod.ratio = min(1.0, TARGET_TRIS / n)
mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier="Decimate")
bpy.ops.object.shade_flat()
V = np.array([v.co[:] for v in body.data.vertices])
print("BODY", len(body.data.polygons), "tris", len(V), "verts")

# ------------------------------------------------------------------ skeleton
JOINTS = {
    # name: (head, tail, parent) in source coordinates
    "Hips": ((0, -0.10, -0.02), (0, -0.10, 0.12), None),
    "Spine": ((0, -0.10, 0.12), (0, -0.10, 0.40), "Hips"),
    "Neck": ((0, -0.09, 0.40), (0, -0.08, 0.49), "Spine"),
    "Head": ((0, -0.08, 0.49), (0, -0.075, 0.93), "Neck"),
    "PonyA": ((0, 0.16, 0.86), (0, 0.30, 0.66), "Head"),
    "PonyB": ((0, 0.30, 0.66), (0, 0.35, 0.42), "PonyA"),
    "PonyC": ((0, 0.35, 0.42), (0, 0.37, 0.14), "PonyB"),
}
for side, s in (("L", 1), ("R", -1)):
    JOINTS[f"UpperArm{side}"] = ((s * 0.13, -0.09, 0.35), (s * 0.44, -0.09, 0.35), "Spine")
    JOINTS[f"Forearm{side}"] = ((s * 0.44, -0.09, 0.35), (s * 0.62, -0.09, 0.358), f"UpperArm{side}")
    JOINTS[f"Hand{side}"] = ((s * 0.62, -0.09, 0.358), (s * 0.81, -0.09, 0.37), f"Forearm{side}")

rig_data = bpy.data.armatures.new("Rig")
rig = bpy.data.objects.new("Rig", rig_data)
scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for name, (head, tail, parent) in JOINTS.items():
    bone = rig_data.edit_bones.new(name)
    bone.head = T(head)
    bone.tail = T(tail)
    if parent:
        bone.parent = rig_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")

# ------------------------------------------------------------------ skin weights (source coordinates)
S = V.copy()
S[:, 0] = V[:, 0] / SCALE
S[:, 1] = V[:, 1] / SCALE + SRC_CENTER_Y
S[:, 2] = V[:, 2] / SCALE + SRC_FEET_Z
x, y, z = S[:, 0], S[:, 1], S[:, 2]
ax = np.abs(x)
side_left = x >= 0

W = {name: np.zeros(len(S)) for name in JOINTS}

# Arms: only in the shoulder band, fading in from the torso.
in_band = (z > 0.24) & (z < 0.43) & (y > -0.25) & (y < 0.02)
w_arm = np.where(in_band, smoothstep(0.09, 0.19, ax), 0.0)
s1 = smoothstep(0.38, 0.50, ax)
s2 = smoothstep(0.58, 0.66, ax)
for side, mask in (("L", side_left), ("R", ~side_left)):
    W[f"UpperArm{side}"] = np.where(mask, w_arm * (1 - s1), 0.0)
    W[f"Forearm{side}"] = np.where(mask, w_arm * s1 * (1 - s2), 0.0)
    W[f"Hand{side}"] = np.where(mask, w_arm * s2, 0.0)

body_w = 1.0 - w_arm
pony = smoothstep(0.10, 0.17, y) * (z > 0.1)  # everything behind the head is ponytail
attach = smoothstep(0.80, 0.92, z) * 0.8  # the top of the tail is held by the head
a = smoothstep(0.58, 0.70, z)
c = 1 - smoothstep(0.30, 0.42, z)
b = np.clip(1 - a - c, 0, 1)
rest = body_w * (1 - pony)
head_f = smoothstep(0.43, 0.50, z)
neck_f = smoothstep(0.36, 0.42, z) * (1 - head_f)
low = 1 - head_f - neck_f
spine_f = smoothstep(0.06, 0.18, z) * low
W["Head"] = rest * head_f + body_w * pony * attach
W["Neck"] = rest * neck_f
W["Spine"] = rest * spine_f
W["Hips"] = rest * (low - spine_f)
tail = body_w * pony * (1 - attach)
W["PonyA"] = tail * a
W["PonyB"] = tail * b
W["PonyC"] = tail * c

total = sum(W.values())
assert np.all(total > 0.999), "weights do not sum to 1"
for name in JOINTS:
    group = body.vertex_groups.new(name=name)
    for i in np.nonzero(W[name] > 0.002)[0]:
        group.add([int(i)], float(W[name][i]), "REPLACE")
armature = body.modifiers.new("Armature", "ARMATURE")
armature.object = rig
body.parent = rig

# ------------------------------------------------------------------ materials
def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    return m


body.data.materials.append(material("Ivory", (1.0, 0.96, 0.88)))
eye_mat = material("Eye", (0.04, 0.03, 0.03))
mouth_mat = material("Mouth", (0.45, 0.24, 0.2))

# ------------------------------------------------------------------ face features on the real surface
body.data.update()
tree = BVHTree.FromObject(body, bpy.context.evaluated_depsgraph_get())


def surface(point):
    """Front surface point (ray along +Y) at the given x,z."""
    hit = tree.ray_cast(Vector((point[0], -2.0, point[2])), Vector((0, 1, 0)))
    return hit[0] if hit[0] is not None else Vector(point)


def new_obj(name, bm, mat, group="Head", smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    g = ob.vertex_groups.new(name=group)
    g.add(list(range(len(me.vertices))), 1.0, "REPLACE")
    mod = ob.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    ob.parent = rig
    return ob


for name, src in (("EyeL", EYE_SRC[0]), ("EyeR", EYE_SRC[1])):
    p = surface(T(src))
    rx, ry, rz = 0.0124, 0.0064, 0.0156

    def build(k):  # k = openness 1 -> 0.08
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=1.0)
        for v in bm.verts:
            v.co = Vector((v.co.x * rx, v.co.y * ry, v.co.z * rz * k)) + Vector((p.x, p.y - 0.0022, p.z))
        return bm

    ob = new_obj(name, build(1.0), eye_mat)
    ob.shape_key_add(name="Basis")
    blink = ob.shape_key_add(name="Blink")
    closed = build(0.08)
    for i, v in enumerate(closed.verts):
        blink.data[i].co = v.co.copy()
    closed.free()
    blink.value = 0.0

MN = 9
mc = T(MOUTH_SRC)


def lip(width, smile, open_, round_):
    w = width * (1 - 0.45 * round_)
    up, lo = [], []
    for i in range(MN):
        t = i / (MN - 1) * 2 - 1
        bow = smile * t * t - smile * 0.35
        thick = 0.0010 * (1 - 0.55 * t * t)
        o = open_ * (1 - t * t) ** (0.8 - 0.4 * round_)
        up.append((t * w / 2, bow + thick + 0.28 * o))
        lo.append((t * w / 2, bow - thick - o))
    pts = []
    for px, dz in up + lo:
        s_ = surface((mc.x + px, 0, mc.z + dz))
        pts.append(Vector((s_.x, s_.y - 0.0022, s_.z)))
    return pts


bm = bmesh.new()
vs = [bm.verts.new(p) for p in lip(0.036, 0.0042, 0.0, 0.0)]
for i in range(MN - 1):
    bm.faces.new((vs[i], vs[i + 1], vs[MN + i + 1], vs[MN + i]))
bmesh.ops.triangulate(bm, faces=bm.faces)
mouth = new_obj("Mouth", bm, mouth_mat)
mouth.shape_key_add(name="Basis")
for key, shape in (
    ("Open", (0.038, 0.0024, 0.0115, 0.0)),
    ("Wide", (0.050, 0.0030, 0.0058, 0.0)),
    ("Round", (0.032, 0.0, 0.0100, 1.0)),
    ("Smile", (0.046, 0.0066, 0.0040, 0.0)),
):
    sk = mouth.shape_key_add(name=key)
    sk.value = 0.0
    for i, p in enumerate(lip(*shape)):
        sk.data[i].co = p

# ------------------------------------------------------------------ export
for ob in scene.objects:
    ob.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_skins=True,
    export_morph=True,
    export_normals=False,
    export_morph_normal=False,
    export_animations=False,
    export_apply=False,
    export_yup=True,
    export_materials="EXPORT",
    export_extras=False,
)
print("RITA_OK", OUT)
