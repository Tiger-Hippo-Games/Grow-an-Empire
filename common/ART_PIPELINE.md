# ART_PIPELINE.md

# Studio AI Art & Asset Pipeline

**Studio AI Art Standard**  
**Applies to:** All games developed for the Studio Publishing Platform  
**Primary target:** Mobile Web  
**Technology baseline:** HTML5, CSS, JavaScript / TypeScript, Three.js where required

---

## 1. Purpose

This document defines the standard process for creating, processing, organizing, validating and integrating visual assets into Studio games.

The Studio is an AI-native game development organization. Assets may be created using:

- AI image-generation tools
- AI 3D-generation tools
- Traditional art tools
- Asset libraries
- Human artists
- Procedural generation
- A combination of the above

The Studio should remain **tool-agnostic**.

Specific AI tools may change over time. The pipeline should not.

The objective is to establish a consistent path:

```text
IDEA
 ↓
ASSET BRIEF
 ↓
GENERATION
 ↓
SELECTION
 ↓
CLEANUP
 ↓
OPTIMIZATION
 ↓
VALIDATION
 ↓
GAME INTEGRATION
 ↓
CDN / PUBLISHING PLATFORM
 ↓
PLAYER
```

Tools are interchangeable.

The pipeline is not.

---

## 2. Core Principle

### Optimize for game-ready assets, not merely beautiful assets.

An asset is successful only when it:

- Looks appropriate for the game.
- Fits the established art direction.
- Has the correct dimensions or geometry.
- Has appropriate topology where relevant.
- Has appropriate textures/materials.
- Is optimized for mobile.
- Has predictable naming.
- Can be loaded efficiently.
- Has clear licensing/provenance.
- Can be modified or regenerated later.
- Can be understood by developers and AI agents.

A beautiful AI-generated asset that is too large, inconsistent, poorly structured or impossible to maintain is **not a production-ready asset**.

---

## 3. Tool-Agnostic Architecture

The Studio may use any suitable generation provider.

Examples include:

```text
2D Generation
 ├── AI image generators
 ├── Illustration tools
 ├── Texture generators
 └── Traditional art tools

3D Generation
 ├── AI 3D generators
 ├── Text-to-3D tools
 ├── Image-to-3D tools
 ├── 3D modeling software
 └── Procedural generation
```

Tools such as Ludo.ai, Meshy, Tripo and future providers should be treated as **asset-generation providers**, not architectural dependencies.

Do not write game code that depends on a particular asset-generation provider.

---

## 4. Asset Lifecycle

Every production asset should follow a defined lifecycle:

```text
Concept
  ↓
Asset Brief
  ↓
Generation
  ↓
Candidate Selection
  ↓
Cleanup
  ↓
Optimization
  ↓
Metadata / Provenance
  ↓
Game Integration
  ↓
QA
  ↓
Production
```

Not every asset requires every step at the same depth.

The appropriate process depends on asset type and importance.

---

## 5. Asset Categories

The Studio should broadly classify assets into:

```text
2D
 ├── UI
 ├── Icons
 ├── Characters
 ├── Backgrounds
 ├── Props
 ├── Illustrations
 ├── Textures
 ├── VFX
 └── Marketing assets

3D
 ├── Characters
 ├── Environments
 ├── Props
 ├── Vehicles
 ├── Weapons/items where applicable
 ├── Buildings
 ├── Environment kits
 └── VFX/support assets

Audio
 ├── Music
 ├── Sound effects
 ├── UI sounds
 └── Voice
```

The same pipeline principles apply across categories, but technical requirements differ.

---

## 6. Asset Brief

Before generating an important asset, create a concise asset brief.

The brief should define:

```text
Asset name
Asset type
Purpose
Game / scene
Visual style
Camera/view
Color direction
Scale
Dimensions or target polygon budget
Required variants
Animation requirements
Background/transparency requirements
Target platform
References
```

Example:

```text
Asset: Jungle Temple Entrance

Type: 3D environment prop

Purpose:
Main entrance landmark for Level 3.

Style:
Stylized low-poly fantasy.
Clean shapes.
Readable silhouette.
Bright, family-friendly visual language.

Camera:
Mobile third-person/isometric view.

Requirements:
- Modular where practical
- No unnecessary interior geometry
- Optimized for mobile WebGL
- Texture resolution appropriate for mobile
- Pivot positioned at base center
```

The brief is more important than the generation prompt.

---

## 7. Art Direction

Each game should have an explicit art direction.

At minimum define:

- Overall visual style
- Color language
- Shape language
- Lighting style
- Character proportions
- Environment style
- Material style
- UI style
- VFX style
- Camera style

AI-generated assets must be evaluated against the game's art direction, not individually.

---

## 8. Consistency Over Individual Quality

A game with ten individually beautiful but visually incompatible assets is worse than a game with ten coherent assets.

Prioritize:

```text
Consistency
   ↓
Readability
   ↓
Gameplay usefulness
   ↓
Performance
   ↓
Individual visual detail
```

Assets should look like they belong to the same game.

---

## 9. Generation Providers

Generation providers are interchangeable.

A project may use different tools for different asset classes.

For example:

```text
Concept art
   ↓
Provider A

3D character
   ↓
Provider B

3D environment
   ↓
Provider C

Texture
   ↓
Provider D

Final cleanup
   ↓
Traditional tool
```

There is no requirement that one provider generate the entire game's art.

Select tools based on:

- Output quality
- Asset type
- Style consistency
- Speed
- Cost
- Licensing
- Export formats
- Editability
- Workflow compatibility
- Automation/API availability

---

## 10. Generation Records

Important production assets should retain enough information to reproduce or understand their origin.

Where practical, record:

```text
Asset ID
Generation provider
Generation date
Prompt / source description
Reference images
Input images where applicable
Model/version where available
Generation settings where relevant
Human modifications
Final processing tool
License/provenance information
```

This information may be stored in:

```text
/assets/metadata/
```

or a future centralized asset-management system.

---

## 11. Asset Naming

Asset names should be predictable and machine-friendly.

Prefer:

```text
hero_knight_idle
hero_knight_run
enemy_slime_blue
tree_palm_large
temple_gate_main
ui_button_primary
icon_coin_gold
```

Avoid:

```text
final.png
final2.png
newfinal.png
newfinal2_REAL.png
thing.png
```

Use:

```text
lowercase
snake_case
descriptive names
```

---

## 12. Asset IDs

Where practical, important assets should have stable identifiers independent of filenames.

Example:

```text
Asset ID:
enemy_slime_blue

File:
enemy_slime_blue_v03.glb
```

The asset ID should remain stable even when the underlying file is regenerated.

This allows the platform or game configuration to reference:

```text
enemy_slime_blue
```

rather than depending permanently on a particular generated file.

---

## 13. Versioning

Assets should be versioned when they are regenerated.

Example:

```text
enemy_slime_blue_v01.glb
enemy_slime_blue_v02.glb
enemy_slime_blue_v03.glb
```

Production references should point to the approved version.

Do not overwrite a production asset without considering caching, rollback and compatibility.

---

## 14. Source vs Production Assets

Separate source assets from game-ready assets.

Conceptually:

```text
/assets/

    /source/
        original/
        generated/

    /working/
        cleaned/
        edited/

    /production/
        textures/
        models/
        sprites/
        ui/
```

Source assets may be large.

Production assets must be optimized for delivery.

---

## 15. 3D Asset Pipeline

The standard 3D pipeline is:

```text
Generation / Modeling
        ↓
Geometry Inspection
        ↓
Topology Cleanup
        ↓
Scale / Pivot Correction
        ↓
Material Cleanup
        ↓
Texture Optimization
        ↓
LOD where appropriate
        ↓
Compression
        ↓
Export
        ↓
Game Integration
        ↓
Mobile Performance QA
```

AI-generated 3D models should not automatically be considered game-ready.

---

## 16. 3D Geometry

Evaluate:

- Polygon count
- Triangle count
- Topology
- Mesh fragmentation
- Hidden geometry
- Duplicate geometry
- Interior geometry
- Unnecessary detail
- Object hierarchy

Remove geometry that provides little visual value.

Mobile games should favor:

> **Visual readability per triangle.**

---

## 17. Polygon Budgets

Every 3D game should establish approximate polygon budgets appropriate to its visual style and target devices.

Do not apply one universal polygon limit to every asset.

Instead consider:

```text
Hero Character
   ↓
Higher budget

Common Enemy
   ↓
Medium budget

Small Prop
   ↓
Low budget

Background Decoration
   ↓
Very low budget
```

The relevant metric is the **total scene/rendering budget**, not simply the polygon count of one asset.

---

## 18. LOD

Use Level of Detail where it materially improves performance.

Potential structure:

```text
LOD 0
High detail

LOD 1
Medium detail

LOD 2
Low detail

LOD 3
Very low detail / billboard / removal
```

Do not create LODs simply because they are technically possible.

Use them where camera distance and scene complexity justify them.

---

## 19. Materials

Prefer simple, efficient materials.

Avoid unnecessarily complex shader setups.

Material complexity should be justified by visible player value.

Where possible:

```text
Fewer materials
   ↓
Fewer state changes
   ↓
Better rendering efficiency
```

---

## 20. Textures

Textures should be optimized for the actual visual contribution they make.

Consider:

- Screen size
- Camera distance
- Texture repetition
- Asset importance
- Device capability
- Memory usage

Use compressed formats where appropriate for the target browser/device environment.

Do not automatically use very high-resolution textures.

---

## 21. Texture Atlases

Use texture atlases where they materially reduce rendering overhead.

Particularly useful for:

- UI icons
- Sprite-based games
- Small props
- Repeated materials
- Character parts

Avoid excessively large atlases that create unnecessary memory usage.

---

## 22. 2D Assets

2D assets should be generated at an appropriate working resolution and exported at the resolution actually required by the game.

Avoid shipping oversized images simply because the source generator produced them at high resolution.

Typical optimization process:

```text
High-resolution source
       ↓
Crop / cleanup
       ↓
Remove unnecessary background
       ↓
Resize
       ↓
Compress
       ↓
Production export
```

---

## 23. Transparency

Use transparent assets only where necessary.

Transparency can increase rendering cost and create visual sorting issues.

Examples where transparency is appropriate:

- UI
- Icons
- VFX
- Character sprites
- Certain environmental elements

Do not use transparent PNGs for every asset by default.

---

## 24. Sprite Sheets

For sprite-based animation, use sprite sheets where practical.

A sprite sheet should have:

- Predictable dimensions
- Consistent frame sizes
- Clear frame ordering
- Metadata where required

Do not create unnecessarily huge sprite sheets.

---

## 25. Animation

Animations should be:

- Purposeful
- Readable
- Lightweight
- Consistent with the game's visual style

For characters, common states may include:

```text
idle
run
jump
attack
hit
death
celebrate
```

Not every character requires every state.

---

## 26. Animation Optimization

Avoid excessive animation complexity on mobile.

Prefer animation that communicates gameplay clearly.

For 3D:

- Reuse animations where practical.
- Avoid unnecessarily dense keyframes.
- Remove unused animation tracks.
- Compress animation data where supported.

---

## 27. UI Assets

UI assets should be designed separately from world assets.

UI must prioritize:

```text
Readability
Touchability
Hierarchy
Consistency
Performance
```

Buttons and interactive elements should be designed for touch-first interaction.

See `MOBILE_PERFORMANCE.md` for mobile-specific requirements.

---

## 28. Icons

Icons should remain readable at their actual display size.

Do not optimize icons based only on their source resolution.

A detailed icon that becomes visually ambiguous at 32px is not a successful icon.

---

## 29. VFX

VFX should prioritize gameplay readability.

Examples:

```text
Hit
Damage
Reward
Level Complete
Power-up
Explosion
Interaction
```

Avoid effects that obscure important gameplay information.

Mobile VFX should be tested on real or representative mid-range devices.

---

## 30. Asset Variants

Where possible, create variants systematically.

Example:

```text
tree_small
tree_medium
tree_large
```

rather than:

```text
tree1
tree2
tree3
```

Variants should have a clear purpose.

Avoid generating dozens of visually different assets that provide no gameplay value.

---

## 31. Asset Manifest

Each game should maintain an asset manifest where practical.

Example:

```json
{
    "enemy_slime_blue": {
        "type": "model",
        "file": "enemy_slime_blue_v03.glb",
        "loadGroup": "level_01"
    }
}
```

The manifest can eventually integrate with the Publishing Platform.

Potential future capabilities include:

- Remote asset configuration
- Asset versioning
- CDN paths
- Feature flags
- Seasonal assets
- A/B testing

---

## 32. Asset Loading Strategy

Assets should be grouped according to when they are needed.

Example:

```text
BOOT
 ├── Logo
 ├── Loading UI
 └── Core runtime

FIRST PLAYABLE
 ├── Player
 ├── First environment
 └── First enemies

LEVEL 2
 ├── Level 2 environment
 └── Level 2 enemies

OPTIONAL
 ├── Cosmetics
 ├── Bonus content
 └── Promotional assets
```

Do not load content before it is required unless caching/performance analysis justifies it.

---

## 33. CDN Delivery

Production assets should be delivered efficiently through the Studio's web infrastructure/CDN.

The game should reference logical asset paths or manifests rather than hard-coding infrastructure-specific locations throughout the codebase.

---

## 34. Asset Compression

Production assets should be compressed appropriately.

Consider:

```text
Images
 ├── WebP / AVIF where supported
 └── PNG where transparency or compatibility requires it

3D
 ├── GLB / glTF
 ├── Geometry compression where appropriate
 └── Texture compression where supported

Audio
 ├── Compressed delivery format
 └── Appropriate bitrate
```

Use the formats supported by the game's actual browser/device requirements.

Do not optimize file size at the expense of unacceptable visual quality.

---

## 35. Asset QA

Before production, validate:

### Visual

- Correct appearance
- Correct scale
- Correct orientation
- Correct materials
- Correct transparency
- Correct animation

### Technical

- Correct file format
- No broken references
- No missing textures
- No excessive geometry
- No unnecessary materials
- No unexpected memory usage

### Gameplay

- Correct collision alignment
- Correct pivot
- Correct placement
- Correct animation timing
- Correct interaction behavior

---

## 36. Mobile Asset QA

Every major asset should be evaluated in the actual game context.

Do not approve assets solely by viewing them in an asset-generation tool or desktop 3D viewer.

Check:

```text
Desktop browser
       ↓
Tablet where relevant
       ↓
Mobile browser
       ↓
Representative mid-range device
```

The game is the final test environment.

---

## 37. Collision and Gameplay Geometry

Visual geometry and gameplay collision geometry should be separated where appropriate.

A highly detailed mesh should not automatically become a collision mesh.

Prefer simplified collision geometry:

```text
Visual Mesh
     │
     └── Detailed

Collision Mesh
     │
     └── Simplified
```

This improves performance and gameplay predictability.

---

## 38. Scale and Coordinate Standards

Every 3D game should define:

- World unit convention
- Up axis
- Forward direction
- Camera convention
- Character scale
- Pivot convention

Example:

```text
1 world unit = 1 meter
Y = up
Character pivot = feet / center depending on entity type
```

The exact convention can vary by project, but it must be documented.

---

## 39. Asset Folder Standards

Recommended:

```text
/assets/

    /characters/
    /environments/
    /props/
    /ui/
    /icons/
    /textures/
    /vfx/
    /audio/
    /marketing/

    /source/
    /working/
    /production/

    /metadata/
```

Games may adapt this structure, but assets should remain easy to locate.

---

## 40. Source File Preservation

Where licensing and storage policies permit, retain important source assets and generation information.

Do not keep only the final optimized file when the source may be needed for:

- Regeneration
- Editing
- Porting
- New resolutions
- New animations
- New variants
- Legal/provenance review

---

## 41. Licensing and Provenance

Every production asset must have a known provenance category.

Examples:

```text
Human-created
AI-generated
Licensed asset
Studio-owned asset
Public-domain asset
Third-party asset
Procedurally generated
Mixed / modified
```

Do not assume that an AI-generated asset is automatically free of licensing or commercial-use considerations.

Before commercial release, verify the applicable provider terms and any source-asset restrictions.

Maintain provenance information for important assets.

---

## 42. Third-Party Assets

Third-party assets must be reviewed for:

- License
- Commercial-use rights
- Attribution requirements
- Redistribution rights
- Modification rights
- Marketplace restrictions

Do not add third-party assets to production without knowing the applicable rights.

---

## 43. AI Generation Prompts

For important assets, retain the prompt or generation description where practical.

Prompts should be specific about:

```text
Subject
Style
Camera
Composition
Materials
Lighting
Color
Proportions
Background
Output requirements
```

However, the prompt is not a substitute for the asset brief.

---

## 44. Reference Libraries

Each game should maintain a small visual reference library.

Examples:

```text
Art Direction
Character references
Environment references
UI references
Color references
Material references
VFX references
```

The purpose is to maintain consistency across generations.

AI tools should be given the appropriate references where supported.

---

## 45. Human Art Direction

AI generation does not replace art direction.

Humans should make final decisions about:

- Visual identity
- Style consistency
- Character appeal
- Gameplay readability
- Asset selection
- Final approval

AI is a production accelerator.

The Studio remains responsible for the final product.

---

## 46. AI Agent Integration

Claude, Codex and other AI coding agents should treat assets as structured project resources.

Agents should:

- Read the asset manifest where present.
- Use existing asset IDs.
- Avoid renaming production assets unnecessarily.
- Avoid replacing assets without understanding dependencies.
- Update manifests when assets change.
- Preserve asset metadata.
- Check asset paths before modifying game code.

AI agents should not invent asset paths.

---

## 47. Asset Replacement

When replacing an asset:

1. Identify the asset ID.
2. Identify all usages.
3. Confirm compatibility.
4. Replace or version the asset.
5. Update the manifest if required.
6. Test the game.
7. Check mobile performance.
8. Verify CDN/cache behavior.

Do not casually replace production assets.

---

## 48. Asset Automation

The long-term goal is to automate repetitive asset processing.

Potential future pipeline:

```text
Generation Provider
        ↓
Asset Intake
        ↓
Automated Validation
        ↓
Optimization
        ↓
Format Conversion
        ↓
Metadata
        ↓
CDN Upload
        ↓
Manifest Update
        ↓
Game Build
```

Automation should be preferred when it reduces repetitive human work without reducing quality.

---

## 49. Provider Independence

The Studio must not build critical game functionality around the continued availability of a particular generation provider.

If Provider A disappears, becomes expensive, changes its API or changes its licensing terms:

```text
Provider A
    ↓
Replace with Provider B
    ↓
Same Studio asset pipeline
```

The game should continue to function because the final game depends on the **asset**, not the generation provider.

---

## 50. Definition of Done

An asset is production-ready when:

- It matches the game's art direction.
- Its provenance is understood.
- Its license/usage rights are acceptable.
- It has a stable asset ID where appropriate.
- It has an approved production version.
- It uses an appropriate file format.
- It is optimized for its intended platform.
- It has no unnecessary geometry or data.
- It works correctly in the game.
- It has been tested at actual gameplay scale.
- It does not introduce unacceptable mobile performance problems.
- Required metadata/manifests are updated.

---

## 51. Golden Rules

1. **The pipeline is stable; generation tools are interchangeable.**
2. **Game-ready beats merely beautiful.**
3. **Consistency beats individual asset quality.**
4. **Mobile performance is part of art quality.**
5. **Never ship source-resolution assets unnecessarily.**
6. **Separate source assets from production assets.**
7. **Use stable asset IDs where practical.**
8. **Never hard-code a generation provider into game architecture.**
9. **Track provenance and licensing for important assets.**
10. **AI generates; humans direct and approve.**
11. **Reuse assets before generating new ones.**
12. **Automate repetitive processing whenever practical.**

---

## 52. Final Principle

The Studio's advantage is not that it can generate an image or 3D model faster.

The advantage is having a **repeatable system that turns AI-generated ideas into consistent, optimized, production-ready game assets at scale.**

The desired evolution is:

```text
One Game
   ↓
Reusable Asset Standards
   ↓
Reusable Processing Pipeline
   ↓
Reusable Asset Libraries
   ↓
Automated Asset Intake
   ↓
Multiple Games
   ↓
Studio-Scale Asset Production
```

The generation tool may change.

The Studio pipeline should not.
