# Woodcutter Transport Generation Notes

## 2026-09-21 — directional pickup completion

Mode: built-in image generation and editing.

Reference/edit target: `woodcutter-male-01-pickup-log-southeast-master-v1.png`.

Generated masters:

- `woodcutter-male-01-pickup-log-southwest-master-v1.png`
- `woodcutter-male-01-pickup-log-northeast-master-v1.png`
- `woodcutter-male-01-pickup-log-northwest-master-v1.png`

The northeast v1 result arrived as flattened RGB. A targeted background-extraction edit produced the runtime source `woodcutter-male-01-pickup-log-northeast-master-v2.png`; v1 remains preserved for provenance.

## Final directional prompt set

Use case: identity-preserve  
Asset type: game character animation master sheet  
Input image: southeast pickup master as the edit target and exact character, style, and timing reference  
Primary request: create the matching eight-frame pickup-log animation facing `<DIRECTION>` instead of southeast. The worker starts upright beside one portable log, bends and reaches, grips it with both hands, lifts through the same believable weight progression, and finishes standing with the log carried horizontally across his torso.  
Subject: exactly the same adult male woodcutter, face, brown hair, short beard, cream rolled-sleeve shirt, rust-brown leather vest, belt pouch, blue trousers, brown gloves, boots, and portable bark-covered log.  
Style: charming hand-painted 2D strategy-game sprite concept with subtly dimensional forms and crisp silhouettes.  
Composition: strict fixed orthographic isometric view; one four-by-two grid of exactly eight complete full-body frames, ordered left-to-right across each row; equal spacing; consistent ground contact and character scale.  
Lighting: warm upper-left key light with soft short lower-right contact shadows.  
Constraints: change only gameplay direction; preserve identity, costume, proportions, scale, log dimensions, timing, camera, rendering style, palette, and lighting; exactly one character and one log per frame; no duplicated or missing limbs, merged hands, tools, axe, labels, text, borders, or watermark.

Direction substitutions:

- Southwest: faces down-left with front/left side readable.
- Northeast: faces up-right with mostly back/right side readable.
- Northwest: faces up-left with mostly back/left side readable.

## Northeast background-extraction prompt

Use case: background-extraction  
Primary request: remove only the dark warm-brown sheet background and ambient glow, producing genuine transparent RGBA around every sprite.  
Constraints: preserve all eight frames, character, poses, proportions, clothing, log, outlines, colors, lighting, contact shadows, layout, canvas, and spacing; do not redraw, restyle, reposition, crop, scale, add, or remove sprite content; retain fine edges; no halo, matte fringe, text, borders, or watermark.

## 2026-09-21 — directional chop completion

Mode: built-in image generation/editing. Reference/edit target: `../Animations/woodcutter-male-01-chop-southeast-master-v1.png`.

Generated masters:

- `../Animations/woodcutter-male-01-chop-southwest-master-v1.png`
- `../Animations/woodcutter-male-01-chop-northeast-master-v1.png`
- `../Animations/woodcutter-male-01-chop-northwest-master-v1.png`

Final prompt set: preserve the exact WoodcutterMale01 identity, clothing, single wood-handled steel axe, fixed isometric camera, upper-left light, palette, and eight action beats from the southeast master; change only the gameplay direction to southwest, northeast, or northwest; maintain a natural two-handed grip and complete axe silhouette in every frame; use a four-by-two sheet with exactly eight full-body poses; no tree, log, text, borders, extra limbs, detached axe, or watermark; produce genuine transparent RGBA.

Runtime exports use uniform source scale `0.45`, a 256 x 256 canvas, and y = 236 foot anchoring. This preserves the established southeast character-to-tree scale instead of fitting every pose independently.

## 2026-09-22 — unloaded directional walk completion

Mode: built-in image generation/editing. Each direction used two references: the WoodcutterMale01 turnaround for identity, clothing, gloves, pouch, tool loop, palette, and proportions; and the corresponding SettlerMale01 walk master for direction-specific eight-frame gait timing.

Generated masters:

- `../Animations/woodcutter-male-01-walk-southeast-master-v1.png`
- `../Animations/woodcutter-male-01-walk-southwest-master-v1.png`
- `../Animations/woodcutter-male-01-walk-northeast-master-v1.png`
- `../Animations/woodcutter-male-01-walk-northwest-master-v1.png`

Final prompt set: transfer the reference walk's natural eight-beat leg and arm cadence onto the exact WoodcutterMale01 occupational design; preserve face, hair, beard, cream shirt, rust-brown vest, belt, pouch, tool loop, blue trousers, brown gloves, and boots in every frame; empty hands with natural alternating arm swing; fixed orthographic isometric camera, four-by-two sheet, consistent scale and ground contact, upper-left lighting, genuine transparent RGBA; no axe, log, held tools, extra limbs, text, borders, or watermark.
