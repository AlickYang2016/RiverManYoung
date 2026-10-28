"""
Rolling stock for the Osaka-Umeda miniature, modelled in Blender and exported as the one glTF binary the page instances.

    blender -b --factory-startup --python scripts/osaka/blender/rolling_stock.py -- src/osaka/assets/rolling-stock.glb [preview.png]

Every series that really calls at Osaka or Osaka-umeda and runs in the miniature's timetable, from its published dimensions
(car length, width, height, door count and spacing) and its livery as photographed (Wikimedia Commons, listed in
docs/osaka/DATA_SOURCES.md). No Shinkansen: they call at Shin-Osaka, 3.5 km north of the model.

A car body is lofted along its length from one cross-section (floor, sides, roof shoulder), with a station at every window and
door edge so the livery can be painted face by face with crisp edges; a cab end is the same section swept into the series' own
nose (a commuter's raked flat face, a limited express's gangway bonnet, the Haruka's and Super Hakuto's long streamlined noses)
and closed with a front panel built row by row at the livery's heights. Bogies, underfloor equipment, roof units and the
single-arm pantograph are simple solids. Materials are flat colours (the page reads them into vertex colours and lights the
windows at night); names say what each surface is:

    glass*     side windows (lit at night)       cab_glass  windscreens        gap  door openings, gangways
    steel*     stainless bodies (metallic)       anything else: paint

Objects are named "<stock>__<variant>": cab (a leading car; the page turns it round for the last car), mid, pan (a motor car with
a pantograph; electric stock only), door (one door leaf, 1 m wide, the page scales and slides it). An empty "<stock>__lamp" marks
the right headlamp on the cab (the page mirrors it).

Units: metres; Blender +X is the car's front, +Z up from the rail top, +Y its left. glTF export turns Z up into Y up.
"""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

# ---------------------------------------------------------------- colours (sRGB, as photographed in daylight)

GLASS = 0x1C2228
CAB_GLASS = 0x11161B
GAP = 0x141619
UNDER = 0x2D3034
BOGIE = 0x25272A
WHEEL = 0x3B3D40
ROOF = 0x8D9093
STAINLESS = 0xC3C8CC
WHITE = 0xEDEDE8
HANKYU_MAROON = 0x4A161B  # 阪急マルーン (a deep brown-red; lacquered, it reads brighter in sun)
HANKYU_IVORY = 0xE9E2CC
LOOP_ORANGE = 0xEE6B1F  # 323: Osaka Loop Line orange-vermilion
JRW_BLUE = 0x0A5CB0  # JR West corporate blue
RAPID_BROWN = 0x5B3B2E  # Kyoto–Kobe "new rapid" brown
RAPID_BEIGE = 0xD8C7A6
HANWA_BLUE = 0x4D86C6  # 225-5000/5100 pearl blue
NAVY = 0x1E2E57  # 321 face and band
SKY = 0x5FA6D9
TB_BLUE = 0x1557B0  # Thunderbird line
DARK_BAND = 0x23272B  # limited expresses' black window band
KOUNOTORI_RED = 0x7A1E2A  # 287 こうのとり: dark red
OCEAN_GREEN = 0x00897B  # 287 くろしお: ocean green
HARUKA_BLUE = 0x1F3C8F
HOT_BLUE = 0x1D4FB8  # 智頭急行 HOT7000: cobalt blue
HOT_RED = 0x9C2449
AKANE = 0xC0283F  # キハ189 はまかぜ: 茜色
SILVER = 0xD5D9DB


def lin(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


_mats: dict[str, bpy.types.Material] = {}


def mat(name: str, hexc: int, metal: float = 0.0, rough: float = 0.4) -> bpy.types.Material:
    key = f"{name}#{hexc:06x}"
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    p = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if p is None:
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None) or nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(p.outputs[0], out.inputs[0])
    rgb = [lin(((hexc >> s) & 255) / 255) for s in (16, 8, 0)]
    p.inputs["Base Color"].default_value = (*rgb, 1.0)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    m.diffuse_color = (*rgb, 1.0)
    _mats[key] = m
    return m


def paint(hexc: int) -> bpy.types.Material:
    return mat("paint", hexc, 0.0, 0.35)


def steel(hexc: int = STAINLESS) -> bpy.types.Material:
    return mat("steel", hexc, 0.6, 0.32)


# ---------------------------------------------------------------- the series


class Stock:
    """One series: dimensions (m), door and window layout, nose, livery."""

    def __init__(self, sid, *, L, W, H, floor=1.12, doors_at=(0.17, 0.5, 0.83), door_w=1.3, door_h=1.95, win=(1.95, 2.85),
                 nose="flat", nose_len=0.5, rake=0.1, electric=True, wide_windows=False, seat_windows=False, **livery):
        self.id, self.L, self.W, self.H, self.floor = sid, L, W, H, floor
        self.doors_at, self.door_w, self.door_h, self.win = doors_at, door_w, door_h, win
        self.nose, self.nose_len, self.rake, self.electric = nose, nose_len, rake, electric
        self.wide_windows, self.seat_windows = wide_windows, seat_windows
        self.body = livery.get("body", steel())
        self.roof = livery.get("roof", paint(ROOF))
        self.bands = livery.get("bands", [])  # [(z0, z1, material)] on sides and front, over the body
        self.win_band = livery.get("win_band")  # (z0, z1, material): a dark band the windows sit in
        self.face = livery.get("face", [])  # [(z0, z1, material)] extra bands on the front only
        self.end_patch = livery.get("end_patch")  # (from_end_m, width_m, z0, z1, material) near each car end (HOT7000)
        self.cap = livery.get("cap")  # (z0, material): everything above z0 on the sides (Hankyu's ivory roof cap)
        self.door_paint = livery.get("door_paint")  # door frames (323's orange)


STOCKS = [
    # Osaka Loop Line: 323 series (2016–), 8 cars
    Stock("jr323", L=19.5, W=2.95, H=3.66, nose="flat", nose_len=0.55, rake=0.12,
          bands=[(1.86, 1.95, paint(LOOP_ORANGE)), (2.88, 3.2, paint(LOOP_ORANGE))],
          face=[(1.95, 2.95, mat("cab_glass", CAB_GLASS)), (2.95, 3.4, paint(LOOP_ORANGE)), (1.2, 1.86, paint(0x2A2D31))],
          door_paint=paint(LOOP_ORANGE)),
    # JR Kyoto–Kobe line Special Rapid: 225 series 0/100 (2010–), 12 cars
    Stock("jr225", L=19.5, W=2.95, H=3.69, nose="bulge", nose_len=0.95, rake=0.14,
          bands=[(1.6, 1.68, paint(RAPID_BROWN)), (1.68, 1.76, paint(JRW_BLUE)), (1.76, 1.82, paint(RAPID_BEIGE)), (1.82, 1.86, paint(WHITE))],
          win_band=(1.9, 2.9, paint(0x3E3029)),
          face=[(1.95, 2.95, mat("cab_glass", CAB_GLASS)), (2.95, 3.3, paint(0x3A3D41))]),
    # Kansai Airport / Kishuji Rapid: 225 series 5100 (2019–), 8 cars
    Stock("jr225h", L=19.5, W=2.95, H=3.69, nose="bulge", nose_len=0.95, rake=0.14,
          bands=[(1.55, 1.82, paint(HANWA_BLUE)), (1.82, 1.88, paint(0xB9D3EC))],
          face=[(1.95, 2.95, mat("cab_glass", CAB_GLASS)), (2.95, 3.3, paint(0x3A3D41))]),
    # Yamatoji Rapid: 221 series (1989–), 8 cars, pure white with the new-rapid stripes
    Stock("jr221", L=19.67, W=2.95, H=3.65, nose="flat", nose_len=0.75, rake=0.27, body=paint(0xF1F1EC),
          bands=[(1.55, 1.63, paint(RAPID_BEIGE)), (1.63, 1.71, paint(RAPID_BROWN)), (1.71, 1.76, paint(JRW_BLUE))],
          win_band=(1.88, 2.9, paint(0x2F2A28)),
          face=[(1.85, 2.95, mat("cab_glass", CAB_GLASS))]),
    # Kyoto–Kobe line locals: 321 series (2005–), 7 cars
    Stock("jr321", L=19.5, W=2.95, H=3.66, nose="flat", nose_len=0.45, rake=0.08,
          bands=[(1.62, 1.84, paint(NAVY)), (1.84, 1.9, paint(SKY))],
          face=[(1.2, 3.3, paint(NAVY)), (1.98, 2.9, mat("cab_glass", CAB_GLASS))]),
    # Thunderbird (Osaka–Tsuruga): 683 series 4000 (2009–), 9 cars, refreshed livery (2015–): white, black window band, blue line
    Stock("jr683", L=20.9, W=2.915, H=3.5, floor=1.1, doors_at=(0.93,), door_w=1.0, door_h=1.9, win=(1.78, 2.52),
          nose="bonnet", nose_len=2.5, body=paint(WHITE), seat_windows=True,
          bands=[(1.6, 1.68, paint(TB_BLUE))], win_band=(1.7, 2.62, paint(DARK_BAND)),
          face=[(1.72, 2.72, mat("cab_glass", CAB_GLASS)), (0.9, 1.25, paint(0x6B7076))]),
    # Kounotori (Shin-Osaka/Osaka–Fukuchiyama/Kinosaki): 287 series (2011–), white, dark grey band, dark red line
    Stock("jr287", L=20.6, W=2.915, H=3.5, floor=1.1, doors_at=(0.93,), door_w=1.0, door_h=1.9, win=(1.78, 2.52),
          nose="bonnet", nose_len=2.2, body=paint(WHITE), seat_windows=True,
          bands=[(1.58, 1.68, paint(KOUNOTORI_RED))], win_band=(1.7, 2.62, paint(0x3A3E43)),
          face=[(1.72, 2.72, mat("cab_glass", CAB_GLASS)), (0.9, 1.25, paint(0x6B7076))]),
    # Kuroshio (Kyoto/Shin-Osaka–Shirahama/Shingū): 287 series, the same car with an ocean-green line
    Stock("jr287k", L=20.6, W=2.915, H=3.5, floor=1.1, doors_at=(0.93,), door_w=1.0, door_h=1.9, win=(1.78, 2.52),
          nose="bonnet", nose_len=2.2, body=paint(WHITE), seat_windows=True,
          bands=[(1.58, 1.68, paint(OCEAN_GREEN))], win_band=(1.7, 2.62, paint(0x3A3E43)),
          face=[(1.72, 2.72, mat("cab_glass", CAB_GLASS)), (0.9, 1.25, paint(0x6B7076))]),
    # Haruka (Kyoto–Kansai Airport): 281 series (1994–), white streamlined nose, black windows, indigo skirt
    Stock("jr281", L=20.6, W=2.9, H=3.5, floor=1.1, doors_at=(0.93,), door_w=1.0, door_h=1.9, win=(1.78, 2.5),
          nose="stream", nose_len=4.2, body=paint(WHITE), seat_windows=True,
          bands=[(1.2, 1.28, paint(HARUKA_BLUE))], win_band=(1.7, 2.6, paint(0x2B2F34)),
          face=[(1.95, 2.85, mat("cab_glass", CAB_GLASS)), (0.9, 1.35, paint(HARUKA_BLUE))]),
    # Super Hakuto (Kyoto–Osaka–Tottori/Kurayoshi): Chizu Express HOT7000 (1994–), diesel, cobalt blue with a white sill band
    Stock("hot7000", L=20.8, W=2.82, H=3.55, floor=1.15, doors_at=(0.93,), door_w=0.9, door_h=1.88, win=(1.75, 2.52),
          nose="stream", nose_len=3.6, electric=False, body=paint(HOT_BLUE), seat_windows=True, roof=paint(0x6F7A8C),
          bands=[(1.22, 1.62, paint(0xF2F2EE)), (1.36, 1.41, paint(HOT_BLUE)), (1.47, 1.52, paint(HOT_BLUE))],
          win_band=(1.68, 2.6, paint(0x1A1F2A)), end_patch=(1.4, 0.7, 1.68, 2.6, paint(HOT_RED)),
          face=[(1.8, 2.9, mat("cab_glass", CAB_GLASS))]),
    # Hamakaze (Osaka–Kasumi/Tottori): KiHa 189 series (2010–), diesel, silver with an akane-red line
    Stock("kiha189", L=20.8, W=2.9, H=3.6, floor=1.15, doors_at=(0.93,), door_w=1.0, door_h=1.9, win=(1.8, 2.55),
          nose="bonnet", nose_len=1.5, electric=False, body=steel(SILVER), seat_windows=True,
          bands=[(1.5, 1.68, paint(AKANE))], win_band=(1.72, 2.64, paint(0x3B3F44)),
          face=[(1.8, 2.75, mat("cab_glass", CAB_GLASS)), (2.75, 3.0, paint(AKANE))]),
    # Hankyu 1000 series (2013–), Kobe and Takarazuka lines, and 1300 series (2014–), Kyoto line: maroon with the ivory roof cap
    Stock("hankyu1000", L=18.7, W=2.75, H=3.7, nose="flat", nose_len=0.4, rake=0.06, body=paint(HANKYU_MAROON),
          cap=(3.2, paint(HANKYU_IVORY)), face=[(1.95, 2.95, mat("cab_glass", CAB_GLASS))]),
    Stock("hankyu1300", L=18.7, W=2.8, H=3.7, nose="flat", nose_len=0.4, rake=0.06, body=paint(HANKYU_MAROON),
          cap=(3.2, paint(HANKYU_IVORY)), face=[(1.95, 2.95, mat("cab_glass", CAB_GLASS))]),
    # Hankyu 9300 series (2003–), Kyoto line limited expresses: the black front band wraps the cab
    Stock("hankyu9300", L=18.7, W=2.8, H=3.7, nose="flat", nose_len=0.5, rake=0.08, body=paint(HANKYU_MAROON),
          cap=(3.2, paint(HANKYU_IVORY)), face=[(1.85, 3.0, mat("cab_glass", CAB_GLASS))], wide_windows=True),
]


# ---------------------------------------------------------------- the cross-section


def section(s: Stock) -> list[tuple[float, float]]:
    """The right half of the body's cross-section, bottom to roof centre: (y, z). Points sit at every livery height."""
    hw = s.W / 2
    shoulder = s.H - 0.42  # where the side turns into the roof
    cuts = {s.win[0], s.win[1], s.floor + 0.12 + s.door_h}
    for z0, z1, _ in s.bands + s.face:
        cuts |= {z0, z1}
    if s.win_band:
        cuts |= {s.win_band[0], s.win_band[1]}
    if s.end_patch:
        cuts |= {s.end_patch[2], s.end_patch[3]}
    if s.cap:
        cuts.add(s.cap[0])
    side = sorted(z for z in cuts if s.floor + 0.2 < z < shoulder - 0.02)
    pts = [(hw - 0.14, s.floor), (hw - 0.03, s.floor + 0.07), (hw, s.floor + 0.2)]
    pts += [(hw, z) for z in side]
    pts.append((hw, shoulder))
    for k in range(1, 5):  # the roof shoulder, a quarter round of 0.32 m
        a = k / 4 * math.pi / 2
        pts.append((hw - 0.32 + 0.32 * math.cos(a), shoulder + 0.32 * math.sin(a)))
    pts.append((hw * 0.55, s.H - 0.03))
    pts.append((0.0, s.H))
    return pts


def ring(half: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """The whole section, counter-clockwise seen from the front: bottom centre, right side up, left side down."""
    right = half
    left = [(-y, z) for (y, z) in reversed(half[:-1])]
    return [(0.0, half[0][1])] + right + left


# ---------------------------------------------------------------- noses: where a point of the section goes at u ∈ [0, 1]


def nose_point(s: Stock, u: float, y: float, z: float) -> tuple[float, float, float]:
    """Car-local (dx forward of the nose's start, y, z) of section point (y, z) swept to u along the nose."""
    hw = s.W / 2
    q = min(1.0, abs(y) / hw)
    Ln = s.nose_len
    if s.nose == "flat":  # a commuter's face: a slight bow in plan, the upper half raked back
        dx = Ln * u * (1 - 0.55 * q**2) - s.rake * max(0.0, z - 1.9) * u
        return dx, y * (1 - 0.035 * u * u), z - 0.12 * u * u * max(0.0, z - (s.H - 0.4)) / 0.4
    if s.nose == "bulge":  # 225: a crash-absorbing lower nose in front of a raked cab
        low = 1.0 if z < 1.85 else max(0.0, 1 - (z - 1.85) / 0.4)
        dx = u * (Ln * (0.5 + 0.5 * low) * (1 - 0.6 * q**2.2)) - s.rake * max(0.0, z - 2.0) * u
        return dx, y * (1 - 0.05 * u * u), z - 0.15 * u * u * max(0.0, z - (s.H - 0.45)) / 0.45
    if s.nose == "bonnet":  # 683/287/キハ189: a gangway cab on a projecting lower bonnet; the screen leans back
        prof = 1.0 if z < 1.65 else max(0.18, 1 - (z - 1.65) / 1.15 * 0.82)
        dx = u * Ln * prof * (1 - 0.72 * q**2.6)
        zz = z if z < 2.9 else z - u * u * (z - 2.9) * 0.55
        return dx, y * (1 - 0.13 * u * u), zz
    # "stream": 281/HOT7000: a long nose; the roofline falls to a low tip, the sides close in
    t = u**1.35
    top = s.H - (s.H - 1.75) * t  # the section's top at u
    zz = z if z < 1.3 else 1.3 + (z - 1.3) * (top - 1.3) / (s.H - 1.3)
    dx = u * Ln * (1 - 0.55 * q**2.4) * (1.0 if z < 1.4 else 1 - 0.1 * (z - 1.4))
    return dx, y * (1 - 0.3 * t * t), zz


# ---------------------------------------------------------------- the livery: which material a face of the body gets


def in_spans(x: float, spans) -> bool:
    return any(a <= x <= b for a, b in spans)


def layout(s: Stock, cab: bool):
    """Door spans and window spans (car-local x; the front is +L/2), and the stations the loft needs."""
    L = s.L
    front = L / 2 - (s.nose_len + 0.9 if cab else 0.7)
    doors = [(L / 2 - f * L - s.door_w / 2, L / 2 - f * L + s.door_w / 2) for f in s.doors_at]
    wins = []
    edges = sorted([-L / 2 + 0.7] + [x for d in doors for x in d] + [front])
    # free stretches between doors (and the ends), each filled with windows
    blocks = []
    lo = -L / 2 + 0.7
    for a, b in sorted(doors):
        blocks.append((lo, a - 0.55))
        lo = b + 0.55
    blocks.append((lo, front))
    for a, b in blocks:
        n = max(0, b - a)
        if n < 0.8:
            continue
        if s.seat_windows:  # one window per seat row pair, ~1.65 m apart
            k = max(1, round(n / 1.65))
            pitch = n / k
            for i in range(k):
                wins.append((a + i * pitch + 0.18, a + (i + 1) * pitch - 0.18))
        else:
            k = 1 if s.wide_windows or n < 3.2 else 2
            pitch = n / k
            for i in range(k):
                wins.append((a + i * pitch + 0.1, a + (i + 1) * pitch - 0.1))
    stations = sorted({-L / 2, L / 2 - (s.nose_len if cab else 0.0), *[x for w in wins for x in w], *[x for d in doors for x in d]}
                      | ({L / 2} if not cab else set()))
    if s.end_patch:
        e0, ew = s.end_patch[0], s.end_patch[1]
        stations = sorted(set(stations) | {L / 2 - e0 - ew, L / 2 - e0, -L / 2 + e0, -L / 2 + e0 + ew})
    stations = [x for x in stations if -L / 2 <= x <= L / 2 - (s.nose_len if cab else 0.0)]
    return doors, wins, stations


def side_material(s: Stock, x: float, z: float, doors, wins, nose_u: float | None):
    if nose_u is None and in_spans(x, doors) and s.floor + 0.1 < z < s.floor + 0.12 + s.door_h:
        return mat("gap", GAP)
    if nose_u is None and in_spans(x, wins) and s.win[0] < z < s.win[1]:
        return mat("glass", GLASS)
    if s.cap and z >= s.cap[0]:
        return s.cap[1] if z < s.H - 0.25 else s.roof
    if z > s.H - 0.36:
        return s.roof
    if s.end_patch and nose_u is None:
        e0, ew, z0, z1, m = s.end_patch
        if z0 < z < z1 and (s.L / 2 - e0 - ew < x < s.L / 2 - e0 or -s.L / 2 + e0 < x < -s.L / 2 + e0 + ew):
            return m
    if s.door_paint and nose_u is None and in_spans(x, [(a - 0.18, b + 0.18) for a, b in doors]) and s.floor < z < s.floor + 0.3 + s.door_h:
        return s.door_paint
    for z0, z1, m in reversed(s.bands):
        if z0 <= z <= z1:
            return m
    if s.win_band and s.win_band[0] <= z <= s.win_band[1]:
        return s.win_band[2]
    return s.body


def front_material(s: Stock, y: float, z: float, cab: bool):
    hw = s.W / 2
    if not cab:  # a plain end: the gangway in the middle
        if abs(y) < 0.55 and s.floor + 0.1 < z < s.floor + 2.0:
            return mat("gap", GAP)
        return side_material(s, 0.0, z, [], [], 0.0) if z < s.H - 0.36 else s.roof
    for z0, z1, m in reversed(s.face):
        if z0 <= z <= z1 and (m.name.startswith("cab_glass") is False or abs(y) < hw - 0.12):
            if m.name.startswith("cab_glass") and s.nose == "bonnet" and abs(y) < 0.42 and z < z1 - 0.05:
                return mat("gap", 0x2A2E33)  # the gangway door between the two screens
            return m
    return side_material(s, 0.0, z, [], [], 1.0)


# ---------------------------------------------------------------- building a car


class Mesh:
    def __init__(self, name: str):
        self.bm = bmesh.new()
        self.name = name
        self.mats: list[bpy.types.Material] = []

    def mi(self, m) -> int:
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def face(self, pts, m):
        vs = [self.bm.verts.new(p) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(m)
        f.smooth = True
        return f

    def box(self, c, size, m, rot_y=0.0):
        cx, cy, cz = c
        sx, sy, sz = (v / 2 for v in size)
        ca, sa = math.cos(rot_y), math.sin(rot_y)

        def P(dx, dy, dz):  # rotate about the car's y axis (a pantograph arm)
            return (cx + dx * ca + dz * sa, cy + dy, cz - dx * sa + dz * ca)

        v = [P(dx, dy, dz) for dx in (-sx, sx) for dy in (-sy, sy) for dz in (-sz, sz)]
        for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            f = self.face([v[i] for i in q], m)
            f.smooth = False

    def wheel(self, cx, cy, cz, r, w, m, n=10):
        ring_a = [(cx + r * math.cos(2 * math.pi * k / n), cy - w / 2, cz + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
        ring_b = [(x, cy + w / 2, z) for (x, _, z) in ring_a]
        for k in range(n):
            self.face([ring_a[k], ring_a[(k + 1) % n], ring_b[(k + 1) % n], ring_b[k]], m)
        self.face(list(reversed(ring_a)), m).smooth = False
        self.face(ring_b, m).smooth = False

    def finish(self, collection) -> bpy.types.Object:
        bm = self.bm
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for e in bm.edges:  # hard edges where faces meet at more than 40°
            if len(e.link_faces) == 2 and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0) > math.radians(40):
                e.smooth = False
        me = bpy.data.meshes.new(self.name)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        collection.objects.link(ob)
        return ob


def body(M: Mesh, s: Stock, cab: bool):
    half = section(s)
    R = ring(half)
    doors, wins, stations = layout(s, cab)
    x_nose = s.L / 2 - s.nose_len
    rings = [[(x, y, z) for (y, z) in R] for x in stations]
    params = [(x, None) for x in stations]
    if cab:
        steps = 7
        for k in range(1, steps + 1):
            u = k / steps
            rings.append([(x_nose + nose_point(s, u, y, z)[0], *nose_point(s, u, y, z)[1:]) for (y, z) in R])
            params.append((x_nose, u))
    n = len(R)
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        xa, ua = params[k]
        xb, ub = params[k + 1]
        for i in range(n):
            j = (i + 1) % n
            zc = (R[i][1] + R[j][1]) / 2
            if ub is None:
                m = side_material(s, (xa + xb) / 2, zc, doors, wins, None)
            else:
                m = side_material(s, x_nose, zc, doors, wins, ub)
                # the front paint wraps round onto the nose's flanks
                for z0, z1, fm in s.face:
                    if z0 <= zc <= z1 and not fm.name.startswith("cab_glass") and ub > 0.55:
                        m = fm
                if s.nose in ("bonnet", "stream") and s.win[0] < zc < s.win[1] + 0.25 and ub > 0.3:
                    m = mat("cab_glass", CAB_GLASS)
                if m is s.roof and ub > 0.25 and s.nose in ("bonnet", "stream"):
                    m = s.body  # a long nose is painted, not roofed
                if zc < s.floor + 0.05:
                    m = mat("under", UNDER)
            if R[i][1] <= s.floor + 1e-6 and R[j][1] <= s.floor + 1e-6:
                m = mat("under", UNDER)
            M.face([b[i], b[j], a[j], a[i]], m)
    # the two ends: the front panel at the nose tip (or a flat gangway end), row by row at the section's heights
    cols = [-1, -0.9, -0.6, -0.29, 0, 0.29, 0.6, 0.9, 1]
    for end in (1, -1):
        if end == 1 and cab:
            def P(y, z):
                dx, yy, zz = nose_point(s, 1.0, y, z)
                return (x_nose + dx, yy, zz)
        else:
            xe = s.L / 2 if end == 1 else -s.L / 2

            def P(y, z, xe=xe):
                return (xe, y, z)
        for i in range(len(half) - 1):
            (y0, z0), (y1, z1) = half[i], half[i + 1]
            for c in range(len(cols) - 1):
                fa, fb = cols[c], cols[c + 1]
                quad = [P(fa * y0, z0), P(fb * y0, z0), P(fb * y1, z1), P(fa * y1, z1)]
                if end == -1:
                    quad.reverse()
                m = front_material(s, (fa + fb) / 2 * (y0 + y1) / 2, (z0 + z1) / 2, cab and end == 1)
                M.face(quad, m)
    return doors, wins


def running_gear(M: Mesh, s: Stock, cab: bool, bogies: float):
    L = s.L
    M.box((0, 0, s.floor - 0.3), (L - 7.6, s.W - 0.55, 0.5), mat("under", UNDER))
    for bx in (bogies / 2, -bogies / 2):
        M.box((bx, 0, 0.62), (2.6, 2.0, 0.34), mat("bogie", BOGIE))
        M.box((bx, 0, 0.88), (1.2, 2.3, 0.16), mat("bogie", BOGIE))
        for ax in (-1.05, 1.05):
            for side in (-1, 1):
                M.wheel(bx + ax, side * 0.56, 0.43, 0.43, 0.12, mat("wheel", WHEEL))
    if cab:
        xn = L / 2 - s.nose_len * (0.3 if s.nose in ("flat", "bulge") else 0.15)
        M.box((xn, 0, s.floor - 0.3), (0.5, s.W - 0.7, 0.55), mat("skirt", 0x3A3E43))
        M.box((xn + 0.35, 0, 0.98), (0.5, 0.3, 0.25), mat("under", UNDER))


def roof_gear(M: Mesh, s: Stock, pan: bool):
    L, H = s.L, s.H
    grey = mat("roofgear", 0xA4A7AA)
    if s.id.startswith("hankyu"):
        M.box((0, 0, H + 0.12), (L - 5.5, 1.7, 0.3), grey)
    elif s.electric:
        for x in (L * 0.22, -L * 0.22):
            M.box((x, 0, H + 0.14), (3.0, 1.9, 0.36), grey)
    else:  # diesels: radiator and exhaust housings, no pantograph
        M.box((L * 0.18, 0, H + 0.1), (2.4, 1.6, 0.28), grey)
        M.box((-L * 0.25, 0, H + 0.12), (1.0, 0.7, 0.34), mat("roofgear", 0x55595D))
    if pan and s.electric:
        px, top = L * 0.36, H
        dark = mat("pantograph", 0x3C3F42)
        M.box((px, 0, top + 0.1), (1.4, 1.3, 0.16), dark)
        M.box((px - 0.45, 0, top + 0.55), (1.25, 0.08, 0.07), dark, rot_y=-0.62)
        M.box((px - 0.35, 0, top + 1.05), (1.2, 0.06, 0.06), dark, rot_y=0.55)
        M.box((px - 0.86, 0, 5.05), (0.12, 1.7, 0.05), mat("pantograph", 0x2B2D30))


def door_leaf(s: Stock, col) -> bpy.types.Object:
    """One leaf, 1 m wide (the page scales it to half the doorway), painted at the body's heights, with its window."""
    M = Mesh(f"{s.id}__door")
    z0, z1 = s.floor + 0.12, s.floor + 0.12 + s.door_h
    hs = sorted({z0, z1, *[z for b in s.bands for z in b[:2] if z0 < z < z1], *([s.win_band[0], s.win_band[1]] if s.win_band else []),
                 s.win[0] + 0.05, min(z1 - 0.12, s.win[1])})
    hs = [h for h in hs if z0 <= h <= z1]
    for a, b in zip(hs, hs[1:]):
        zc = (a + b) / 2
        m = mat("glass", GLASS) if s.win[0] + 0.05 <= zc <= min(z1 - 0.12, s.win[1]) else side_material(s, 99, zc, [], [], None)
        if s.door_paint and not m.name.startswith("glass"):
            m = s.door_paint if s.id == "jr323" else m
        M.box((0, 0, zc), (1.0, 0.03, b - a), m)
    return M.finish(col)


def build(col):
    for s in STOCKS:
        bogies = round(s.L * 0.7, 2)
        variants = ["cab", "mid"] + (["pan"] if s.electric else [])
        for v in variants:
            M = Mesh(f"{s.id}__{v}")
            body(M, s, v == "cab")
            running_gear(M, s, v == "cab", bogies)
            roof_gear(M, s, v == "pan")
            M.finish(col)
        door_leaf(s, col)
        # the right headlamp: on the nose's surface at lamp height
        y = s.W / 2 - (0.45 if s.nose in ("flat", "bulge") else 0.55)
        z = 1.45 if s.nose != "stream" else 1.5
        dx, yy, zz = nose_point(s, 1.0, y, z)
        e = bpy.data.objects.new(f"{s.id}__lamp", None)
        e.location = (s.L / 2 - s.nose_len + dx + 0.04, -yy, zz)
        col.objects.link(e)


def preview(path: str, col):
    """A line-up of every cab car seen from the front three-quarters, for checking shapes and liveries by eye."""
    sc = bpy.context.scene
    cabs = [o for o in col.objects if o.name.endswith("__cab")]
    for o in col.objects:
        o.hide_render = not o.name.endswith("__cab")
    for i, ob in enumerate(cabs):
        ob.location = (-(i % 7) * 3.0, (i % 7) * 5.0 + (i // 7) * 100.0, 0)
        ob.rotation_euler = (0, 0, 0)
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = 1600, 1000
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    for row in (0, 1):
        target = Vector((-2, 13 + row * 100.0, 1.8))
        cam.location = target + Vector((34, -26, 5))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = 42
        sc.render.filepath = path.replace(".png", f"-{row}.png")
        bpy.ops.render.render(write_still=True)
    for ob in col.objects:
        if ob.name.endswith("/cab"):
            ob.location = (0, 0, 0)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(argv[0] if argv else "src/osaka/assets/rolling-stock.glb").resolve()
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob)
    col = bpy.context.scene.collection
    build(col)
    if len(argv) > 1:
        preview(str(Path(argv[1]).resolve()), col)
    out.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB", export_yup=True, export_apply=True, export_texcoords=False,
                              export_normals=True, export_materials="EXPORT", export_animations=False, export_cameras=False,
                              export_lights=False, use_selection=False)
    print(f"[rolling stock] {len(STOCKS)} series → {out} ({out.stat().st_size / 1024:.0f} KB)")


main()
