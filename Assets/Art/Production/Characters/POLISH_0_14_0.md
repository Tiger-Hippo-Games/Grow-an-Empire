# Character walk polish — v0.14.0

24 October 2026. Created with the built-in imagegen tool using the existing role atlases as identity/style references. Tool-managed originals were generated on C:; selected PNG masters, runtime WebPs, drafts and QA outputs are retained in this project on D:.

The shipped upgrades are builder, farmer and woodcutter: eight directions × eight authored pose images (192 total). Other roles keep their previous art. Merchant replacements were rejected because their row count was wrong. Initial seven-row drafts are preserved under `Assets/Art/Archives/CharacterPolish-0.14.0/`, never shipped.

Selected PNGs live in `DirectionalWalk/<role>-walk64-master-v1.png`. Export uses a shared scale, transparent gutters and a consistent foot baseline; it excludes clipped neighboring-cell fragments. It does not synthesize or duplicate intermediate poses. Previous walk32 masters remain on disk; the exporter ships only the selected walk64 for upgraded roles. Pixel distinctness, grid dimensions and registration are checked by `Tools/qa/character_atlases.py`; visual review remains necessary for motion quality.

Prompts below are generation inputs, not instructions for development.

## builder

Initial prompt:

```text
Use case: stylized-concept. Asset type: production transparent directional walk sprite atlas for the painted isometric Bharatvarsha strategy game Grow an Empire. The provided existing atlas is identity/style reference ONLY. Create a NEW 8 COLUMN by 8 ROW uniform sprite grid: exactly 64 individual full-body images. Columns left-to-right always NORTH (back), NORTHEAST (back-right), EAST (strict right profile), SOUTHEAST (front-right), SOUTH (front), SOUTHWEST (front-left), WEST (strict left profile), NORTHWEST (back-left). Each row advances the same eight-pose walk cycle by 1/8: left foot contact, down, passing, up, right foot contact, down, passing, up. Every column contains 8 DISTINCT intermediate leg/arm poses, not four duplicate poses. Subject: male founder/builder, red and ivory turban, dark beard, ivory dhoti and red sash, small mallet and tool belt. Preserve recognizable outfit, prop and role from reference. Warm painted game art, bold readable silhouette, consistent soft upper-left light. Orthographic slightly elevated isometric viewing angle, no perspective floor. Strict grid: each cell same size and character scale, consistent foot baseline at 92% cell height, character center at 50% cell width, 10% clear margin every side. Separate all cells with transparent gutters, no clipping. Transparent background throughout: no floor, vignette, colored backing, shadows, checkerboard, text, labels, numbers, grid lines or frames. All figures similar scale; centered within their own cells. Output portrait atlas approximately 1024 wide by 1360 high (cell aspect 128:170). No UI.
```

Grid correction:

```text
Edit target: this transparent sprite atlas. It currently has SEVEN rows; this is a production grid error. Rebuild as EXACTLY EIGHT columns and EXACTLY EIGHT rows: 64 full-body sprites. Make figures a little smaller to fit EIGHT rows with generous transparent separation. Count rows carefully: row 1 contact left, row 2 recoil left, row 3 passing left, row 4 high point left, row 5 contact right, row 6 recoil right, row 7 passing right, row 8 high point right. All eight rows must be visible within image. No missing final row. Every column is a direction N, NE, E, SE, S, SW, W, NW respectively. Preserve this builder character identity, existing costume, props, warm painted style. Distinct eight walking leg poses per direction. True transparent background and transparent gutters. Each of the 64 cells equal size. Feet aligned to a common baseline in each cell. Do not include text, numbers, background or floor. North strictly back, east and west strictly profiles. Critical: EIGHT ROWS, not seven. Image portrait around 1024 x1360, but prioritize exact 8x8 grid and 64 sprites.
```

Final count correction (the tool returned eight complete rows; the extra requested neutral row was not returned):

```text
Production sprite sheet correction for this builder reference. Create NINE complete horizontal rows of EIGHT individual sprites per row: 72 full-body sprites in an 8-column by 9-row regular grid. Make characters smaller so all NINE rows fit. Transparent portrait image. No labels or text. Each column always the same facing direction: NORTH strictly back, NE back/right, EAST right profile, SE front/right, SOUTH front, SW front/left, WEST left profile, NW back/left. The first EIGHT rows are eight consecutive walking animation poses (contact left, down left, passing left, high left, contact right, down right, passing right, high right). Ninth row is an extra neutral standing pose. All rows same cell dimensions and figure scale. Strongly vary legs and arms through the walk, with opposite feet crossing halfway through. Maintain exactly this character costume/props/painted Bharatvarsha style. Consistent centered figure and foot baseline per cell, clear transparent space between every sprite. Do not crop bottom row. Please count NINE horizontal rows.
```

## farmer

Initial prompt:

```text
Use case: stylized-concept. Asset type: production transparent directional walk sprite atlas for the painted isometric Bharatvarsha strategy game Grow an Empire. The provided existing atlas is identity/style reference ONLY. Create a NEW 8 COLUMN by 8 ROW uniform sprite grid: exactly 64 individual full-body images. Columns left-to-right always NORTH (back), NORTHEAST (back-right), EAST (strict right profile), SOUTHEAST (front-right), SOUTH (front), SOUTHWEST (front-left), WEST (strict left profile), NORTHWEST (back-left). Each row advances the same eight-pose walk cycle by 1/8: left foot contact, down, passing, up, right foot contact, down, passing, up. Every column contains 8 DISTINCT intermediate leg/arm poses, not four duplicate poses. Subject: male farmer, red turban and sash, ivory kurta and dhoti, dark beard, small basket of grain and sickle. Preserve recognizable outfit, prop and role from reference. Warm painted game art, bold readable silhouette, consistent soft upper-left light. Orthographic slightly elevated isometric viewing angle, no perspective floor. Strict grid: each cell same size and character scale, consistent foot baseline at 92% cell height, character center at 50% cell width, 10% clear margin every side. Separate all cells with transparent gutters, no clipping. Transparent background throughout: no floor, vignette, colored backing, shadows, checkerboard, text, labels, numbers, grid lines or frames. All figures similar scale; centered within their own cells. Output portrait atlas approximately 1024 wide by 1360 high (cell aspect 128:170). No UI.
```

Grid correction:

```text
Edit target: this transparent sprite atlas. It currently has SEVEN rows; this is a production grid error. Rebuild as EXACTLY EIGHT columns and EXACTLY EIGHT rows: 64 full-body sprites. Make figures a little smaller to fit EIGHT rows with generous transparent separation. Count rows carefully: row 1 contact left, row 2 recoil left, row 3 passing left, row 4 high point left, row 5 contact right, row 6 recoil right, row 7 passing right, row 8 high point right. All eight rows must be visible within image. No missing final row. Every column is a direction N, NE, E, SE, S, SW, W, NW respectively. Preserve this farmer character identity, existing costume, props, warm painted style. Distinct eight walking leg poses per direction. True transparent background and transparent gutters. Each of the 64 cells equal size. Feet aligned to a common baseline in each cell. Do not include text, numbers, background or floor. North strictly back, east and west strictly profiles. Critical: EIGHT ROWS, not seven. Image portrait around 1024 x1360, but prioritize exact 8x8 grid and 64 sprites.
```

Final count correction (the tool returned eight complete rows; the extra requested neutral row was not returned):

```text
Production sprite sheet correction for this farmer reference. Create NINE complete horizontal rows of EIGHT individual sprites per row: 72 full-body sprites in an 8-column by 9-row regular grid. Make characters smaller so all NINE rows fit. Transparent portrait image. No labels or text. Each column always the same facing direction: NORTH strictly back, NE back/right, EAST right profile, SE front/right, SOUTH front, SW front/left, WEST left profile, NW back/left. The first EIGHT rows are eight consecutive walking animation poses (contact left, down left, passing left, high left, contact right, down right, passing right, high right). Ninth row is an extra neutral standing pose. All rows same cell dimensions and figure scale. Strongly vary legs and arms through the walk, with opposite feet crossing halfway through. Maintain exactly this character costume/props/painted Bharatvarsha style. Consistent centered figure and foot baseline per cell, clear transparent space between every sprite. Do not crop bottom row. Please count NINE horizontal rows.
```

## woodcutter

Initial prompt:

```text
Use case: stylized-concept. Asset type: production transparent directional walk sprite atlas for the painted isometric Bharatvarsha strategy game Grow an Empire. The provided existing atlas is identity/style reference ONLY. Create a NEW 8 COLUMN by 8 ROW uniform sprite grid: exactly 64 individual full-body images. Columns left-to-right always NORTH (back), NORTHEAST (back-right), EAST (strict right profile), SOUTHEAST (front-right), SOUTH (front), SOUTHWEST (front-left), WEST (strict left profile), NORTHWEST (back-left). Each row advances the same eight-pose walk cycle by 1/8: left foot contact, down, passing, up, right foot contact, down, passing, up. Every column contains 8 DISTINCT intermediate leg/arm poses, not four duplicate poses. Subject: female woodcutter, dark hair bun with red ribbon, ivory sari and red sash, axe held low and tied log pack. Preserve recognizable outfit, prop and role from reference. Warm painted game art, bold readable silhouette, consistent soft upper-left light. Orthographic slightly elevated isometric viewing angle, no perspective floor. Strict grid: each cell same size and character scale, consistent foot baseline at 92% cell height, character center at 50% cell width, 10% clear margin every side. Separate all cells with transparent gutters, no clipping. Transparent background throughout: no floor, vignette, colored backing, shadows, checkerboard, text, labels, numbers, grid lines or frames. All figures similar scale; centered within their own cells. Output portrait atlas approximately 1024 wide by 1360 high (cell aspect 128:170). No UI.
```

Grid correction:

```text
Edit target: this transparent sprite atlas. It currently has SEVEN rows; this is a production grid error. Rebuild as EXACTLY EIGHT columns and EXACTLY EIGHT rows: 64 full-body sprites. Make figures a little smaller to fit EIGHT rows with generous transparent separation. Count rows carefully: row 1 contact left, row 2 recoil left, row 3 passing left, row 4 high point left, row 5 contact right, row 6 recoil right, row 7 passing right, row 8 high point right. All eight rows must be visible within image. No missing final row. Every column is a direction N, NE, E, SE, S, SW, W, NW respectively. Preserve this woodcutter character identity, existing costume, props, warm painted style. Distinct eight walking leg poses per direction. True transparent background and transparent gutters. Each of the 64 cells equal size. Feet aligned to a common baseline in each cell. Do not include text, numbers, background or floor. North strictly back, east and west strictly profiles. Critical: EIGHT ROWS, not seven. Image portrait around 1024 x1360, but prioritize exact 8x8 grid and 64 sprites.
```

Final count correction (the tool returned eight complete rows; the extra requested neutral row was not returned):

```text
Production sprite sheet correction for this woodcutter reference. Create NINE complete horizontal rows of EIGHT individual sprites per row: 72 full-body sprites in an 8-column by 9-row regular grid. Make characters smaller so all NINE rows fit. Transparent portrait image. No labels or text. Each column always the same facing direction: NORTH strictly back, NE back/right, EAST right profile, SE front/right, SOUTH front, SW front/left, WEST left profile, NW back/left. The first EIGHT rows are eight consecutive walking animation poses (contact left, down left, passing left, high left, contact right, down right, passing right, high right). Ninth row is an extra neutral standing pose. All rows same cell dimensions and figure scale. Strongly vary legs and arms through the walk, with opposite feet crossing halfway through. Maintain exactly this character costume/props/painted Bharatvarsha style. Consistent centered figure and foot baseline per cell, clear transparent space between every sprite. Do not crop bottom row. Please count NINE horizontal rows.
```

