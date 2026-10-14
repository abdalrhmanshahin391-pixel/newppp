"""Draws the sample lesson pictures: a cartoon character on a violet circle.

Run: python3 scripts/curriculum-samples/make_lesson_art.py
Writes public/curriculum/<key>.svg. Real lessons get AI pictures in the same style.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / "public" / "curriculum"
OUTLINE = "#2B1B3D"

SKINS = ["#FFD3AE", "#F1B98C", "#C98B5E", "#8D5A3B"]
HAIRS = ["#4A2A1A", "#1E1E2A", "#D9822B", "#7A4B2A"]
SHIRTS = ["#FF8FB8", "#3BA7FF", "#FFC83D", "#48C774", "#FF7A59"]


def person(cx, cy, scale=1.0, skin=0, hair=0, shirt=0, pose="idle", long_hair=False, flip=False):
    s = scale
    sk, hr, sh = SKINS[skin], HAIRS[hair], SHIRTS[shirt]
    t = f'translate({cx} {cy}) scale({-s if flip else s} {s})'
    hair_back = (
        f'<path d="M-30 -48c-4 22 0 44 6 56h48c6-12 10-34 6-56z" fill="{hr}" stroke="{OUTLINE}" stroke-width="3"/>'
        if long_hair else ""
    )
    arms = {
        "idle": '<path d="M-30 30c-10 12-14 28-12 44" /><path d="M30 30c10 12 14 28 12 44" />',
        "wave": '<path d="M-30 30c-10 12-14 28-12 44" /><path d="M30 28c14-6 24-20 26-40" />',
        "point": '<path d="M-30 30c-10 12-14 28-12 44" /><path d="M30 30c4 14-6 22-20 22" />',
        "think": '<path d="M-30 30c-10 12-14 28-12 44" /><path d="M28 30c10 10 4 -2-6 -22" />',
        "cheer": '<path d="M-30 28c-14-6-24-20-26-40" /><path d="M30 28c14-6 24-20 26-40" />',
        "offer": '<path d="M-30 30c-6 12-2 20 14 22" /><path d="M30 30c6 12 2 20-14 22" />',
    }[pose]
    hands = {
        "idle": [(-42, 74), (42, 74)],
        "wave": [(-42, 74), (56, -12)],
        "point": [(-42, 74), (10, 52)],
        "think": [(-42, 74), (22, 8)],
        "cheer": [(-56, -12), (56, -12)],
        "offer": [(-16, 52), (16, 52)],
    }[pose]
    hand_svg = "".join(
        f'<circle cx="{x}" cy="{y}" r="8" fill="{sk}" stroke="{OUTLINE}" stroke-width="3"/>' for x, y in hands
    )
    return f'''<g transform="{t}">
  {hair_back}
  <path d="M-38 100c0-48 14-72 38-72s38 24 38 72z" fill="{sh}" stroke="{OUTLINE}" stroke-width="3.5"/>
  <g fill="none" stroke="{sk}" stroke-width="13" stroke-linecap="round">{arms}</g>
  <g fill="none" stroke="{OUTLINE}" stroke-width="3" stroke-linecap="round" opacity=".0">{arms}</g>
  {hand_svg}
  <rect x="-8" y="6" width="16" height="16" rx="5" fill="{sk}"/>
  <circle cx="0" cy="-20" r="30" fill="{sk}" stroke="{OUTLINE}" stroke-width="3.5"/>
  <path d="M-31 -24c-2-22 12-36 31-36s33 14 31 36c-8-12-20-18-31-18s-23 6-31 18z" fill="{hr}" stroke="{OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
  <ellipse cx="-11" cy="-16" rx="3.6" ry="4.6" fill="{OUTLINE}"/>
  <ellipse cx="11" cy="-16" rx="3.6" ry="4.6" fill="{OUTLINE}"/>
  <circle cx="-9.8" cy="-17.6" r="1.3" fill="#fff"/><circle cx="12.2" cy="-17.6" r="1.3" fill="#fff"/>
  <ellipse cx="-19" cy="-5" rx="5" ry="3" fill="#FF8FA3" opacity=".55"/>
  <ellipse cx="19" cy="-5" rx="5" ry="3" fill="#FF8FA3" opacity=".55"/>
  <path d="M-9 -4c5 7 13 7 18 0" fill="none" stroke="{OUTLINE}" stroke-width="3" stroke-linecap="round"/>
</g>'''


def bubble(x, y, inner, w=58, h=40):
    tail = f"M{-w/2+12} {h/2-2}l-8 14 18-12"
    return f'''<g transform="translate({x} {y})">
  <path d="{tail}" fill="#fff" stroke="{OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
  <rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="12" fill="#fff" stroke="{OUTLINE}" stroke-width="3"/>
  <path d="M{-w/2+10} {h/2-1.5}h14" stroke="#fff" stroke-width="3.2"/>
  {inner}
</g>'''


STAR = '<path d="M0-14l4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L0 7.1l-8.2 4.3 1.6-9.2-6.7-6.5 9.2-1.3z" fill="#FFC83D" stroke="#2B1B3D" stroke-width="2.5" stroke-linejoin="round"/>'
HEART = '<path d="M0 12S-16 2-16-8c0-5 4-9 8.5-9 3.5 0 6 2 7.5 4.5C1.5-15 4-17 7.5-17 12-17 16-13 16-8 16 2 0 12 0 12z" fill="#FF6FA8" stroke="#2B1B3D" stroke-width="2.5"/>'


def icon(name, x, y, s=1.0):
    g = {
        "star": STAR,
        "heart": HEART,
        "bulb": '<path d="M0-22a15 15 0 0 1 9 27c-2 2-2 4-2 6H-7c0-2 0-4-2-6A15 15 0 0 1 0-22z" fill="#FFE066" stroke="#2B1B3D" stroke-width="3"/><rect x="-7" y="12" width="14" height="7" rx="2" fill="#8A8FA3" stroke="#2B1B3D" stroke-width="2.5"/><path d="M-22-24l-6-6M22-24l6-6M0-30v-8" stroke="#FFE066" stroke-width="4" stroke-linecap="round"/>',
        "clock": '<circle r="18" fill="#fff" stroke="#2B1B3D" stroke-width="3.5"/><path d="M0-10V0l7 5" stroke="#2B1B3D" stroke-width="3.5" fill="none" stroke-linecap="round"/>',
        "apple": '<path d="M0-6c-6-5-18-3-18 10 0 12 9 21 18 18 9 3 18-6 18-18 0-13-12-15-18-10z" fill="#FF5A5F" stroke="#2B1B3D" stroke-width="3"/><path d="M0-6c0-6 3-9 8-10" stroke="#7A4B2A" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M2-11c5-5 11-5 13-2-5 3-9 3-13 2z" fill="#48C774" stroke="#2B1B3D" stroke-width="2"/>',
        "house": '<path d="M-18 2L0-14 18 2v18h-36z" fill="#fff" stroke="#2B1B3D" stroke-width="3" stroke-linejoin="round"/><path d="M-23 4L0-18 23 4" fill="none" stroke="#FF7A59" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><rect x="-5" y="7" width="10" height="13" rx="2" fill="#9B5CF6"/>',
        "cup": '<path d="M-13-8h24v12a12 12 0 0 1-24 0z" fill="#fff" stroke="#2B1B3D" stroke-width="3"/><path d="M11-4c8 0 8 10 0 10" fill="none" stroke="#2B1B3D" stroke-width="3"/><path d="M-6-16c-3-3 3-5 0-8M2-16c-3-3 3-5 0-8" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>',
        "check": '<circle r="15" fill="#48C774" stroke="#2B1B3D" stroke-width="3"/><path d="M-7 0l5 5 9-10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
        "cross": '<circle r="15" fill="#FF5A5F" stroke="#2B1B3D" stroke-width="3"/><path d="M-6-6l12 12M6-6l-12 12" stroke="#fff" stroke-width="4" stroke-linecap="round"/>',
        "moon": '<path d="M6-16a17 17 0 1 0 10 28A14 14 0 1 1 6-16z" fill="#FFE066" stroke="#2B1B3D" stroke-width="3"/>',
        "gift": '<rect x="-15" y="-6" width="30" height="22" rx="3" fill="#FF6FA8" stroke="#2B1B3D" stroke-width="3"/><rect x="-17" y="-12" width="34" height="8" rx="2" fill="#FF8FB8" stroke="#2B1B3D" stroke-width="3"/><path d="M0-12v28" stroke="#FFC83D" stroke-width="5"/><path d="M0-12c-6-8-14-6-10 0M0-12c6-8 14-6 10 0" fill="none" stroke="#FFC83D" stroke-width="3.5"/>',
    }[name]
    return f'<g transform="translate({x} {y}) scale({s})">{g}</g>'


def word(text, size=15):
    return f'<text x="0" y="{size/3}" text-anchor="middle" font-family="Nunito, Arial, sans-serif" font-weight="900" font-size="{size}" fill="#6D35D8">{text}</text>'


def frame(body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400">
<defs><clipPath id="c"><circle cx="100" cy="100" r="96"/></clipPath></defs>
<circle cx="100" cy="100" r="100" fill="#7B3FE4"/>
<circle cx="100" cy="100" r="96" fill="#9B5CF6"/>
<g clip-path="url(#c)">
<circle cx="64" cy="52" r="60" fill="#A874FA" opacity=".55"/>
{body}
</g>
</svg>
'''


ART = {
    # words book
    "hello": person(96, 108, 1.05, skin=0, hair=0, shirt=0, pose="wave", long_hair=True) + bubble(150, 46, word("Hi!", 18), 46, 34),
    "me-and-you": person(66, 116, 0.86, skin=1, hair=1, shirt=1, pose="point") + person(136, 116, 0.86, skin=0, hair=2, shirt=0, pose="wave", long_hair=True, flip=True) + icon("heart", 100, 40, 0.9),
    "thank-you": person(100, 114, 1.0, skin=2, hair=1, shirt=3, pose="offer") + icon("gift", 100, 158, 1.0) + bubble(150, 44, icon("heart", 0, 2, 0.8), 40, 34),
    "great-idea": person(100, 116, 1.0, skin=0, hair=3, shirt=2, pose="cheer") + icon("bulb", 100, 36, 1.0),
    "busy": person(92, 116, 1.0, skin=3, hair=1, shirt=4, pose="think") + icon("clock", 152, 54, 1.05) + icon("cup", 44, 150, 0.9),
    # grammar book
    "to-be": person(100, 114, 1.05, skin=1, hair=0, shirt=0, pose="point", long_hair=True) + bubble(146, 44, word("I am", 15), 56, 34) + icon("star", 42, 50, 0.9),
    "pronouns": person(58, 124, 0.72, skin=0, hair=2, shirt=2, pose="wave") + person(100, 112, 0.8, skin=2, hair=1, shirt=1, pose="idle", long_hair=True) + person(142, 124, 0.72, skin=3, hair=0, shirt=3, pose="wave", flip=True),
    "articles": person(84, 116, 1.0, skin=0, hair=1, shirt=3, pose="offer") + icon("apple", 84, 156, 1.1) + bubble(146, 46, word("an", 18), 44, 34),
    "possessives": person(80, 118, 0.95, skin=1, hair=3, shirt=4, pose="point", long_hair=True) + icon("house", 150, 132, 1.25) + icon("heart", 150, 50, 0.9),
    "present-simple": person(90, 116, 1.0, skin=2, hair=0, shirt=1, pose="wave") + icon("moon", 152, 50, 0.9) + icon("cup", 150, 150, 1.0),
}

OUT.mkdir(parents=True, exist_ok=True)
for key, body in ART.items():
    (OUT / f"{key}.svg").write_text(frame(body), encoding="utf-8")
print("wrote", len(ART), "pictures to", OUT)
