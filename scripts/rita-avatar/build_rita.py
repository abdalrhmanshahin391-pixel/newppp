"""
Build Rita: a low-poly, glowing, rigid-part character, rigged as a node
hierarchy so the browser can pose it with plain rotations.

Usage (Blender as a Python module, no GUI needed):
    python3 -m venv .venv && .venv/bin/pip install bpy==5.2.2
    .venv/bin/python scripts/rita-avatar/build_rita.py -- src/assets/rita-avatar.glb

The web viewer (src/components/rita-live/RitaAvatar.tsx) relies on the joint
names below (Root, Hips, Chest, Neck, Head, Pony1/2, Shoulder/Elbow/Wrist L/R,
EyeL/R), the mesh names HandOpenL/R, HandFistL/R, MouthMesh, and the mouth
shape keys Open, Wide, Round, Smile.

Conventions
- Blender Z up, the character faces -Y. Her left is +X.
- Every animated part is an Empty placed at its joint (pivot). Meshes are
  children of their joint with vertices stored relative to that pivot.
- Rest pose: standing straight, arms hanging slightly away from the body.
- Material names are tags the web viewer maps onto its own materials:
  Ivory (faceted body/hair), Skin (smooth face), Eye, Mouth, Blush.
"""

import math
import random
import sys

import bpy  # noqa: I001  (bpy must load before bmesh)
import bmesh
from mathutils import Matrix, Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "src/assets/rita-avatar.glb"
RNG = random.Random(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

MATS = {}


def mat(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    MATS[name] = m
    return m


mat("Ivory", (1.0, 0.96, 0.88))
mat("Skin", (1.0, 0.97, 0.91))
mat("Eye", (0.04, 0.03, 0.03))
mat("Mouth", (0.45, 0.24, 0.2))
mat("Blush", (1.0, 0.75, 0.72))

# ---------------------------------------------------------------- hierarchy
JOINTS = {}
WORLD = {}


def joint(name, world, parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.03
    scene.collection.objects.link(e)
    world = Vector(world)
    if parent:
        e.parent = JOINTS[parent]
        e.location = world - WORLD[parent]
    else:
        e.location = world
    WORLD[name] = world
    JOINTS[name] = e
    return e


def attach(obj, joint_name):
    """Re-express a mesh object built in world space under its joint."""
    j = JOINTS[joint_name]
    pivot = WORLD[joint_name]
    obj.data.transform(Matrix.Translation(-pivot))
    obj.parent = j
    obj.location = (0, 0, 0)


def new_obj(name, bm, material, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATS[material])
    for p in me.polygons:
        p.use_smooth = smooth
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    return o


# ---------------------------------------------------------------- geometry helpers
def ring(center, rx, ry, n, phase=0.0, jitter=0.0, axes=("x", "y")):
    cx, cy, cz = center
    pts = []
    for i in range(n):
        a = phase + 2 * math.pi * i / n
        j = 1 + (RNG.uniform(-jitter, jitter) if jitter else 0)
        pts.append(Vector((cx + math.cos(a) * rx * j, cy + math.sin(a) * ry * j, cz)))
    return pts


def loft(sections, cap_start=True, cap_end=True):
    """sections: list of rings (lists of Vector, equal length). Returns bmesh."""
    bm = bmesh.new()
    rings = [[bm.verts.new(p) for p in s] for s in sections]
    n = len(sections[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap_start:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


def tube_sections(points, radii, n=6, flatten=1.0, twist=0.0, jitter=0.0, up=Vector((0, 0, 1)), first_u=None):
    """Rings perpendicular to a polyline. radii may be (rx, ry) tuples.

    With first_u the ring frame is parallel-transported along the curve, so it
    never flips where the curve passes through vertical (no twisted shells).
    """
    pts = [Vector(p) for p in points]
    tangents = []
    for i, p in enumerate(pts):
        if i == 0:
            t = pts[1] - p
        elif i == len(pts) - 1:
            t = p - pts[i - 1]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized())
    sections = []
    u_prev = None
    for i, p in enumerate(pts):
        t = tangents[i]
        if first_u is not None:
            if u_prev is None:
                u = (Vector(first_u) - t * Vector(first_u).dot(t)).normalized()
            else:
                q = tangents[i - 1].rotation_difference(t)
                u = q @ u_prev
                u = (u - t * u.dot(t)).normalized()
            u_prev = u
        else:
            ref = up if abs(t.dot(up)) < 0.95 else Vector((1, 0, 0))
            u = t.cross(ref).normalized()
        v = t.cross(u).normalized()
        r = radii[i]
        rx, ry = (r, r * flatten) if not isinstance(r, tuple) else r
        ring_pts = []
        for k in range(n):
            a = twist * i + 2 * math.pi * k / n
            j = 1 + (RNG.uniform(-jitter, jitter) if jitter else 0)
            ring_pts.append(p + (u * math.cos(a) * rx + v * math.sin(a) * ry) * j)
        sections.append(ring_pts)
    return sections


def tube_along(points, radii, n=6, flatten=1.0, twist=0.0, jitter=0.0, up=Vector((0, 0, 1)), first_u=None):
    sections = tube_sections(points, radii, n, flatten, twist, jitter, up, first_u)
    # A zero radius end collapses to a point: merge it afterwards.
    bm = loft(sections)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return bm


def jitter_verts(bm, amount):
    for v in bm.verts:
        v.co += Vector((RNG.uniform(-1, 1), RNG.uniform(-1, 1), RNG.uniform(-1, 1))) * amount


def ellipsoid(center, radii, segs=16, rings_=10, smooth=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings_, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * radii[0], v.co.y * radii[1], v.co.z * radii[2])) + Vector(center)
    if not smooth:
        bmesh.ops.triangulate(bm, faces=bm.faces)
    return bm


# ---------------------------------------------------------------- proportions (metres)
# Measured from the reference drawing: head (with hair) is wider than the
# shoulders, eyes sit a little below the middle of the face, the ponytail is
# about two head-heights long and two thirds of a head wide.
HEM_Z = 0.0
WAIST_Z = 0.99
NECK_BASE_Z = 1.288
HEAD_PIVOT_Z = 1.33
HEAD_C = Vector((0.0, 0.0, 1.45))
HEAD_R = 0.118
JAW = 0.15  # how much the jaw narrows
SHOULDER_X = 0.086
SHOULDER_Z = 1.238

# ---------------------------------------------------------------- rig
joint("Root", (0, 0, 0))
joint("Hips", (0, 0, WAIST_Z), "Root")
joint("Chest", (0, 0, WAIST_Z + 0.02), "Hips")
joint("Neck", (0, 0.004, NECK_BASE_Z), "Chest")
joint("Head", (0, 0.004, HEAD_PIVOT_Z), "Neck")
joint("Pony1", (-0.02, 0.06, 1.575), "Head")
joint("Pony2", (-0.092, 0.07, 1.66), "Pony1")
for side, s in (("L", 1), ("R", -1)):
    joint(f"Shoulder{side}", (s * SHOULDER_X, 0.0, SHOULDER_Z), "Chest")
    joint(f"Elbow{side}", (s * (SHOULDER_X + 0.04), 0.004, SHOULDER_Z - 0.235), f"Shoulder{side}")
    joint(f"Wrist{side}", (s * (SHOULDER_X + 0.062), 0.0, SHOULDER_Z - 0.45), f"Elbow{side}")


def head_scale(dz):
    """Egg profile: full cranium, cheeks stay wide, soft rounded chin."""
    if dz > -0.15:
        return 1.0, 0.96
    k = min(1.0, (-0.15 - dz) / 0.85)
    return 1.0 - JAW * k * k, 0.96 - 0.16 * k


def on_face(x, z, lift=0.0015):
    dz = (z - HEAD_C.z) / (HEAD_R * 1.06)
    sx, sy = head_scale(dz)
    dx = x / (HEAD_R * sx)
    inside = max(0.0, 1 - dx * dx - dz * dz)
    y = -math.sqrt(inside) * HEAD_R * sy
    return Vector((x, y - lift, z))


EYE_Z = HEAD_C.z - 0.014
EYE_X = 0.046
MOUTH_C = Vector((0.006, 0, HEAD_C.z - 0.052))
joint("EyeL", on_face(EYE_X, EYE_Z, 0), "Head")
joint("EyeR", on_face(-EYE_X, EYE_Z, 0), "Head")
joint("Mouth", on_face(MOUTH_C.x, MOUTH_C.z, 0), "Head")

# ---------------------------------------------------------------- dress: bodice + A-line skirt
N_DRESS = 12
skirt_sections = []
for z, rx, ry in (
    (WAIST_Z + 0.045, 0.080, 0.060),
    (WAIST_Z - 0.03, 0.090, 0.066),
    (0.86, 0.118, 0.085),
    (0.70, 0.160, 0.112),
    (0.52, 0.205, 0.140),
    (0.34, 0.250, 0.168),
    (0.16, 0.295, 0.195),
    (HEM_Z, 0.330, 0.215),
):
    skirt_sections.append(ring((0, 0.0, z), rx, ry, N_DRESS, phase=math.pi / N_DRESS, jitter=0.045))
bm = loft(skirt_sections)
attach(new_obj("Skirt", bm, "Ivory"), "Hips")

torso_sections = []
for z, rx, ry in (
    (WAIST_Z - 0.02, 0.083, 0.062),
    (WAIST_Z + 0.05, 0.082, 0.061),
    (1.10, 0.088, 0.068),
    (1.17, 0.092, 0.071),
    (1.215, 0.094, 0.062),
    (1.255, 0.072, 0.047),
    (1.276, 0.052, 0.038),
    (NECK_BASE_Z, 0.048, 0.034),
):
    torso_sections.append(ring((0, 0.004, z), rx, ry, N_DRESS, phase=math.pi / N_DRESS, jitter=0.035))
bm = loft(torso_sections)
attach(new_obj("Torso", bm, "Ivory"), "Chest")

# ---------------------------------------------------------------- neck
bm = loft([ring((0, 0.006, z), r, r * 0.92, 10) for z, r in ((NECK_BASE_Z - 0.012, 0.025), (1.30, 0.0215), (1.36, 0.0215))])
attach(new_obj("NeckMesh", bm, "Skin", smooth=True), "Neck")

# ---------------------------------------------------------------- head
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=20, radius=1.0)
for v in bm.verts:
    x, y, z = v.co
    sx, sy = head_scale(z)
    v.co = Vector((x * HEAD_R * sx, y * HEAD_R * sy, z * HEAD_R * 1.06)) + HEAD_C
bmesh.ops.triangulate(bm, faces=bm.faces)
attach(new_obj("HeadMesh", bm, "Skin", smooth=True), "Head")

for s, name in ((1, "EarL"), (-1, "EarR")):
    bm = ellipsoid((s * HEAD_R * 0.96, 0.01, HEAD_C.z - 0.02), (0.011, 0.016, 0.02), segs=6, rings_=4)
    attach(new_obj(name, bm, "Skin"), "Head")

for name in ("EyeL", "EyeR"):
    c = WORLD[name]
    bm = ellipsoid((c.x, c.y + 0.004, c.z), (0.0118, 0.0065, 0.0152), segs=16, rings_=10, smooth=True)
    attach(new_obj(name + "Mesh", bm, "Eye", smooth=True), name)

for s, name in ((1, "BlushL"), (-1, "BlushR")):
    p = on_face(s * 0.055, EYE_Z - 0.026, lift=0.0008)
    bm = ellipsoid((p.x, p.y + 0.0025, p.z), (0.013, 0.0025, 0.0075), segs=12, rings_=6, smooth=True)
    attach(new_obj(name, bm, "Blush", smooth=True), "Head")

# ---------------------------------------------------------------- mouth: a ribbon of upper/lower lip vertices + shape keys
MN = 9


def lip_points(width, smile, open_, round_):
    w = width * (1 - 0.45 * round_)
    up, lo = [], []
    for i in range(MN):
        t = i / (MN - 1) * 2 - 1
        bow = smile * t * t - smile * 0.35
        thick = 0.0011 * (1 - 0.55 * t * t)
        o = open_ * (1 - t * t) ** (0.8 - 0.4 * round_)
        up.append((t * w / 2, bow + thick + 0.28 * o))
        lo.append((t * w / 2, bow - thick - o))
    return up, lo


def mouth_verts(*args):
    up, lo = lip_points(*args)
    out = []
    for x, dz in up + lo:
        p = on_face(MOUTH_C.x + x, MOUTH_C.z + dz, lift=0.0)
        out.append(Vector((p.x, p.y - 0.0016, p.z)))
    return out


bm = bmesh.new()
vs = [bm.verts.new(p) for p in mouth_verts(0.024, 0.0045, 0.0, 0.0)]
for i in range(MN - 1):
    bm.faces.new((vs[i], vs[i + 1], vs[MN + i + 1], vs[MN + i]))
bmesh.ops.triangulate(bm, faces=bm.faces)
mouth = new_obj("MouthMesh", bm, "Mouth", smooth=True)
attach(mouth, "Mouth")
mouth.shape_key_add(name="Basis")
pivot = WORLD["Mouth"]
for key, args in (
    ("Open", (0.026, 0.0025, 0.012, 0.0)),
    ("Wide", (0.034, 0.003, 0.006, 0.0)),
    ("Round", (0.022, 0.0, 0.010, 1.0)),
    ("Smile", (0.030, 0.0068, 0.004, 0.0)),
):
    sk = mouth.shape_key_add(name=key)
    sk.value = 0.0
    for i, p in enumerate(mouth_verts(*args)):
        sk.data[i].co = p - pivot

# ---------------------------------------------------------------- hair
# Cap: low-res faceted shell over crown, back and sides; the face is cut away.
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=11, v_segments=7, radius=1.0)
for v in bm.verts:
    x, y, z = v.co
    v.co = Vector((x * HEAD_R * 1.12, y * HEAD_R * 1.09 + 0.006, z * HEAD_R * 1.14 + 0.016)) + HEAD_C
kill = []
for v in bm.verts:
    rel = v.co - HEAD_C
    if rel.y < -0.035 and rel.z < 0.06 - 2.2 * max(0.0, abs(rel.x) - 0.03) ** 1.2:
        kill.append(v)
    elif rel.z < -0.06 and rel.y < 0.03:
        kill.append(v)
bmesh.ops.delete(bm, geom=kill, context="VERTS")
bmesh.ops.triangulate(bm, faces=bm.faces)
jitter_verts(bm, 0.006)
attach(new_obj("HairCap", bm, "Ivory"), "Head")


def shard(name, pts, widths, depth=0.009, joint_name="Head"):
    bm = tube_along(pts, [(w, depth * (0.4 + 0.6 * w / max(widths))) if w > 0.001 else (0.0006, 0.0006) for w in widths], n=4, jitter=0.05)
    attach(new_obj(name, bm, "Ivory"), joint_name)


# Fringe: one broad faceted slab, parted on her right and swept to her left.
shard("Fringe0", [on_face(-0.07, 1.57, 0.014), on_face(-0.02, 1.555, 0.014), on_face(0.04, 1.53, 0.012), on_face(0.088, 1.5, 0.01), on_face(0.106, 1.46, 0.008)], [0.03, 0.036, 0.034, 0.024, 0.0], 0.014)
shard("Fringe1", [on_face(-0.035, 1.575, 0.02), on_face(0.02, 1.56, 0.018), on_face(0.075, 1.53, 0.014), on_face(0.1, 1.5, 0.01)], [0.026, 0.03, 0.022, 0.0], 0.012)
# Side locks in front of the ears, ending as points near the jaw.
shard("LockL", [Vector((0.095, -0.045, 1.52)), Vector((0.104, -0.058, 1.45)), Vector((0.094, -0.064, 1.385)), Vector((0.078, -0.064, 1.335))], [0.018, 0.017, 0.011, 0.0])
shard("LockR", [Vector((-0.095, -0.045, 1.52)), Vector((-0.104, -0.056, 1.46)), Vector((-0.096, -0.06, 1.40)), Vector((-0.084, -0.06, 1.36))], [0.016, 0.015, 0.01, 0.0])

# Ponytail: one continuous curve (crown -> up -> folds to her right -> falls beside
# the head), split into two parts at the fold so it can trail head motion.
PONY = [
    (Vector((-0.02, 0.06, 1.572)), 0.036),
    (Vector((-0.03, 0.064, 1.615)), 0.05),
    (Vector((-0.055, 0.068, 1.648)), 0.064),
    (Vector((-0.092, 0.07, 1.66)), 0.074),
    (Vector((-0.132, 0.07, 1.645)), 0.084),
    (Vector((-0.158, 0.068, 1.595)), 0.088),
    (Vector((-0.168, 0.066, 1.52)), 0.086),
    (Vector((-0.168, 0.064, 1.44)), 0.076),
    (Vector((-0.16, 0.062, 1.37)), 0.056),
    (Vector((-0.15, 0.06, 1.315)), 0.03),
    (Vector((-0.14, 0.058, 1.27)), 0.0008),
]
SPLIT = 3  # ring index shared by both parts (== Pony2 joint)
secs = tube_sections([p for p, _ in PONY], [(max(r * 0.58, 0.0008), r) for _, r in PONY], n=8, jitter=0.07, first_u=(0, 1, 0))
bm = loft(secs[: SPLIT + 1], cap_start=True, cap_end=False)
attach(new_obj("PonyMesh1", bm, "Ivory"), "Pony1")
bm = loft(secs[SPLIT:], cap_start=False, cap_end=True)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
attach(new_obj("PonyMesh2", bm, "Ivory"), "Pony2")
bm = ellipsoid((-0.02, 0.058, 1.572), (0.032, 0.03, 0.026), segs=7, rings_=5)
attach(new_obj("PonyKnot", bm, "Ivory"), "Pony1")

# ---------------------------------------------------------------- arms and hands
for side, s in (("L", 1), ("R", -1)):
    sh, el, wr = WORLD[f"Shoulder{side}"], WORLD[f"Elbow{side}"], WORLD[f"Wrist{side}"]
    bm = ellipsoid(sh + Vector((s * 0.002, 0, -0.008)), (0.031, 0.03, 0.031), segs=8, rings_=6)
    attach(new_obj(f"ShoulderCap{side}", bm, "Ivory"), f"Shoulder{side}")
    bm = tube_along([sh + Vector((0, 0, 0.004)), sh.lerp(el, 0.5), el + Vector((0, 0, -0.01))], [0.031, 0.029, 0.027], n=6, jitter=0.05)
    attach(new_obj(f"UpperArm{side}", bm, "Ivory"), f"Shoulder{side}")
    bm = ellipsoid(el, (0.027, 0.027, 0.027), segs=7, rings_=5)
    attach(new_obj(f"ElbowCap{side}", bm, "Ivory"), f"Elbow{side}")
    bm = tube_along([el + Vector((0, 0, 0.006)), el.lerp(wr, 0.5), wr + Vector((0, 0, 0.002))], [0.027, 0.028, 0.031], n=6, jitter=0.05)
    attach(new_obj(f"Forearm{side}", bm, "Ivory"), f"Elbow{side}")

    # Open hand (palm faces her body at rest; fingers point down).
    palm_top = wr + Vector((0, 0, -0.004))
    palm_bot = wr + Vector((0, 0, -0.05))
    parts = [tube_along([palm_top, palm_top.lerp(palm_bot, 0.5), palm_bot], [(0.011, 0.018), (0.009, 0.022), (0.008, 0.021)], n=6, up=Vector((0, 1, 0)))]
    for oy, length in ((-0.014, 0.034), (-0.005, 0.039), (0.005, 0.037), (0.014, 0.03)):
        b0 = palm_bot + Vector((0, oy, 0.004))
        tip = b0 + Vector((s * 0.003, oy * 0.2, -length))
        parts.append(tube_along([b0, b0.lerp(tip, 0.55), tip], [0.0046, 0.004, 0.0012], n=4))
    tb = palm_top.lerp(palm_bot, 0.3) + Vector((0, -0.017, 0))
    parts.append(tube_along([tb, tb + Vector((s * 0.004, -0.014, -0.016)), tb + Vector((s * 0.006, -0.022, -0.033))], [0.0058, 0.005, 0.0013], n=4))
    merged = bmesh.new()
    tmp = bpy.data.meshes.new("tmp")
    for p in parts:
        p.to_mesh(tmp)
        merged.from_mesh(tmp)
        p.free()
    bpy.data.meshes.remove(tmp)
    attach(new_obj(f"HandOpen{side}", merged, "Skin"), f"Wrist{side}")

    bm = ellipsoid(wr + Vector((0, -0.002, -0.029)), (0.016, 0.022, 0.027), segs=7, rings_=5)
    jitter_verts(bm, 0.0012)
    attach(new_obj(f"HandFist{side}", bm, "Skin"), f"Wrist{side}")

# ---------------------------------------------------------------- export
# A slightly larger head reads closer to the drawing; scaling the joint keeps the pivot.
JOINTS["Head"].scale = (1.09, 1.09, 1.09)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_apply=False,
    export_morph=True,
    export_morph_normal=False,
    export_extras=False,
    export_yup=True,
    export_materials="EXPORT",
)
tris = sum(len(o.data.polygons) for o in scene.objects if o.type == "MESH")
print("RITA_OK", OUT, "triangles", tris)
