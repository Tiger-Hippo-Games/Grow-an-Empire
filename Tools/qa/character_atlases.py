"""Decode the shipped walks, check 64 real cells, and export contact/animation proof."""
import hashlib, json
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path('Tools/qa/out/city-polish'); OUT.mkdir(parents=True, exist_ok=True)
ROLES = ['builder', 'farmer', 'woodcutter']
atlases = {}
results = []
for role in ROLES:
    path = Path(f'Assets/Runtime/{role}-walk64-master-v1.webp')
    atlas = Image.open(path).convert('RGBA'); atlas.load()
    assert atlas.size == (1024, 1360), (role, atlas.size)
    cells = [atlas.crop((col*128, row*170, (col+1)*128, (row+1)*170)) for row in range(8) for col in range(8)]
    bounds = [cell.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for cell in cells]
    assert all(b and b[0]>=5 and b[2]<=123 and b[1]>=5 and b[3]<=163 for b in bounds), (role, bounds)
    assert max(b[3] for b in bounds)-min(b[3] for b in bounds)<=2, (role, 'foot registration')
    for direction in range(8):
        # A second set of four duplicate frames must not masquerade as walk64.
        hashes = {hashlib.sha256(cells[row*8+direction].tobytes()).hexdigest() for row in range(8)}
        assert len(hashes)==8, (role, direction, 'duplicate poses')
    assert all(cell.getpixel((0,0))[3]==0 for cell in cells), role
    atlases[role]=cells
    results.append({'role':role,'directions':8,'poses_per_direction':8,'frames':64,'transparent_gutters':True,'registered_feet':True,'distinct_images':True})
frames=[]
for pose in range(8):
    frame=Image.new('RGBA',(1024,3*194),(93,109,65,255));draw=ImageDraw.Draw(frame)
    for row, role in enumerate(ROLES):
        draw.text((8,row*194+4),role,fill='white')
        for direction in range(8):frame.alpha_composite(atlases[role][pose*8+direction],(direction*128,row*194+24))
    frames.append(frame.convert('RGB'))
frames[0].save(OUT/'walks-contact.png')
frames[0].save(OUT/'walks-eight-poses.gif',save_all=True,append_images=frames[1:],duration=110,loop=0)
(OUT/'atlas-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2));print('ALL PASS')
