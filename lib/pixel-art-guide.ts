import {
  MAX_ASSET_SIDE,
  MAX_ASSETS,
  MAX_DRAW_PIXELS,
} from "./types";

export const PIXEL_ART_GUIDE_TOPICS = [
  "workflow",
  "shading",
  "composition",
  "storybook-rpg",
  "tools",
  "full",
] as const;

export type PixelArtGuideTopic = (typeof PIXEL_ART_GUIDE_TOPICS)[number];

/**
 * The playbook is written for AGENTS drawing via WebMCP, not humans clicking a
 * UI. It optimizes for the failure mode seen in traces: agents produce a flat,
 * sparse "decorated wall" (4–5 big flat objects) instead of a dense, layered,
 * multi-tone scene like a Pokémon-Center reference. The fixes: fill the frame,
 * decompose into many small assets, give every material base+shadow+highlight,
 * and verify with the inline PNG after each pass.
 */

const QUALITY_BAR = {
  title: "The quality bar (reference-matching)",
  reads: [
    "A rich scene FILLS the frame — little empty canvas. Sparse pages read as unfinished.",
    "It is built from MANY small assets (12–30+): floor/wall tiles, furniture, props, characters — not 4 big flat shapes.",
    "Every material needs a planned ramp: outline, base, shadow, reflected light, highlight, and optional specular. Reuse related ramps so the scene feels cohesive instead of collecting unrelated colors.",
    "One consistent light direction across the whole scene (usually above and slightly left).",
    "Depth via five layers and overlap — not separate icons with equal gaps. A quiet central route keeps dense scenes readable.",
    "Tiling: repeated small tiles build floors/walls cheaply and cohesively; vary selected tile interiors so the grid is not identical everywhere.",
  ],
  antiExample:
    "A single wall with one window, one couch, one plant, and one tiny character on a flat 2-tone background is a DECORATED WALL, not a scene. Add floor perspective, more furniture, more characters, and shading tiers.",
};

const COMPOSITION_GRAMMAR = {
  title: "Composition grammar",
  depthLayers: [
    "1. Floor tiles — repeating small stamps that fill the ground plane.",
    "2. Emblem, rugs, and contact shadows on top of the floor (under furniture).",
    "3. Furniture, counters, machines, seating, and architectural modules.",
    "4. Plants, props, and characters (repeat stamps: plants ×4, not unique copies).",
  ],
  overlap:
    "Use overlap to prove depth. Furniture partly hides floor lines; characters overlap rugs or counters; foreground objects may crop against the frame. Avoid arranging assets as separate icons with equal gaps.",
  centralRoute:
    "Keep one quiet navigable shape through the middle. Surround it with dense clusters — not uniform detail everywhere.",
  clusters: [
    "Service cluster near a counter.",
    "Waiting cluster near seating.",
    "Equipment cluster near a wall.",
    "Social character cluster.",
    "Foreground plant or prop cluster.",
  ],
  balance:
    "Broadly balanced, not mirrored. Similar visual weights on both sides, but the objects differ. Repeated architecture establishes rhythm; unique characters and props break repetition.",
};

const STORYBOOK_RPG = {
  title: "Cozy storybook RPG camera",
  camera:
    "Use an elevated three-quarter top-down view like a polished 16-bit handheld adventure: show the back wall plus a broad floor plane, and show the top and front faces of beds, tables, rugs, fences, and props. Avoid a flat side-on decorated wall.",
  depth: [
    "Reserve roughly the upper third for wall, sky, or distant scenery; the lower two-thirds carry the navigable floor or meadow plane.",
    "Place distant objects higher and slightly smaller. Lower objects overlap their floor footprints and cast short down-right contact shadows.",
    "Furniture needs a lit top plane, a mid-tone front plane, a dark side or underside, and a contact shadow.",
    "Characters need irregular chibi silhouettes and separate ramps for hair, skin, clothing, and accessories.",
  ],
  palette:
    "Use controlled material ramps rather than chasing a color count: usually 4–7 related tones per important material, with shared shadow hues tying the scene together. Reserve the brightest cream, cyan, gold, or pink for focal highlights.",
  imageGeneration:
    "When ImageGen is available, generate a clean scene or transparent sprite as a visual reference first. Import individual assets, inspect the quantized result, then use cleanup passes for hard edges, readable clusters, consistent outlines, and animation edits. Never accept a generated bitmap without visual cleanup.",
};

const PALETTE_GUIDE = {
  title: "Palette taste",
  sidebarVsDraw:
    "set_palette creates, updates, or selects reusable named color profiles. Create multiple named profiles for material or asset families; profiles are not bound to assets, so most bespoke assets may use a dedicated profile while related assets reuse one. Default is never overwritten and there is no swatch-count cap.",
  themeFirst:
    "Before drawing, plan several named profiles such as Bedroom wood, Milo skin and pajamas, Sheep wool, Moonlight, and Meadow. Call set_palette for each, then select or reuse the relevant profile while building or importing an asset. Extra colors can still be used inline. get_storybook lists every profile plus activePaletteId.",
  materialRamps:
    "Build color ramps by material, not one universal ramp: deep occlusion, cast shadow, base, reflected light, direct light, highlight, and specular where appropriate. Use as many colors as visible structure requires.",
  colorFamilies: {
    inkAndShadow: ["#09090a", "#111111", "#2b1919", "#313545"],
    coolStructure: ["#404751", "#465d69", "#6c769e", "#8d97b3", "#b49fbb", "#c7dbd0", "#dee1dd"],
    pinkFloor: ["#d9728f", "#e994aa", "#eb9fb8", "#e8b1bc", "#e9c3c0", "#f6e3dc"],
    coralFurniture: ["#8f2d25", "#bf4d34", "#d95a3d", "#f14a25", "#ff765f"],
    screenLight: ["#245aa8", "#388fd6", "#20b7f5", "#8ee8ff", "#e8fbff"],
    foliage: ["#315c2c", "#4f8b35", "#76bd2f", "#a4e44f", "#d7ff86"],
    accents: "Warm gold, electric violet, mint, white, saturated red — reserve for screens, creatures, controls, and focal props.",
  },
  saturation:
    "Do not use every bright color at equal strength. Let cool gray-blue and pink occupy most of the image; reserve saturated cyan, coral, lime, violet, and gold for focal areas.",
  perSprite:
    "Use roughly 4–7 related tones for an important material. Characters and detailed props combine several ramps, but every color must encode form, shadow, reflected light, or material difference.",
};

const PIXEL_SHAPE_LANGUAGE = {
  title: "Pixel shape language",
  outlines: [
    "Dark navy-brown or near-black outlines, usually 1–2 px thick. Pure black is strongest at contact shadows, deep cavities, faces, and foreground edges.",
    "Do not outline every object with the same black. Shift outer edges toward navy, violet, brown, or gray per local material.",
  ],
  curves:
    "Construct curves as intentional stair steps: 1-1-2 or 1-2-2 pixel progressions. Avoid smooth vector-looking rectangles with rounded corners implied only by color.",
  clusters:
    "Cluster pixels into readable planes. A highlight should be a short line, corner cluster, or small patch — not isolated noise sprinkled everywhere.",
  edges:
    "Break long edges with trim, bolts, seams, reflections, handles, vents, leaves, or small silhouette changes.",
  silhouettes:
    "Give major assets an irregular silhouette — feet, handles, cables, foliage, ears, tails, cushions, trays, or side panels.",
  internalOutlines:
    "Use internal outlines sparingly to separate limbs, cushions, doors, panels, and overlapping forms.",
  edgeTransitions:
    "Place intermediate edge colors between the darkest contour and lit plane on metal, glass, hair, and creature forms. One-pixel transition bands create polished softness without abandoning pixel clusters.",
  assetSizes: [
    "8–16 px: tiny props, controls, balls, dishes, flowers.",
    "18–32 px: characters, creatures, plants, bins, stools.",
    "32–64 px: machines, sofas, shelves, windows.",
    "64–96 px: counters and architectural modules.",
  ],
  smallNotSimple:
    "Even an 18×24 character needs a silhouette, face, clothing separation, one shadow plane, and one highlight cluster.",
};

const OUTLINE_SHADING = {
  title: "Outline, fill, shade, highlight",
  lightDirection:
    "Assume light from above and slightly left unless the scene establishes another direction.",
  passes: [
    "Pass 1 — Outline: 1px silhouette with lines/rects (dark hue, usually #000000). Keep it single-pixel-wide; trim corner blobs.",
    "Pass 2 — Fill: flat base colors. Outline an enclosed region, then use a flood fill (fills op) or a rect to lay the base in one call.",
    "Pass 3 — Shade: a darker same-hue tone on the shadow side. Bands of shadow along one edge, not every edge.",
    "Pass 4 — Highlight: a lighter same-hue accent on the lit side and top edges — sparingly.",
  ],
  materialValues: [
    "1. outline or occlusion shadow",
    "2. deep shadow",
    "3. base color",
    "4. lit plane",
    "5. optional specular accent",
  ],
  placement:
    "Light on upper and left-facing edges. Shadow on lower edges, right sides, undersides, recesses, and contact points. A single darker strip along the bottom is insufficient — use stepped side shadows, recessed panels, cast shadows, and selective highlights.",
  hueShifts: [
    "Cool metal shadows → navy or violet.",
    "Coral shadows → burgundy or brown.",
    "Pink floor shadows → muted mauve.",
    "Green foliage shadows → blue-green.",
    "Cream highlights → warm white.",
  ],
  materialTiers:
    "Plan each material ramp up front: occlusion, cast shadow, base, reflected light, lit plane, highlight, and optional specular. Complex assets combine multiple ramps, so the finished scene may naturally exceed 100 colors.",
  avoid: [
    "Pillow shading — darkening every edge regardless of light source.",
    "Mixing black outlines and colored outlines on the same sprite without intent.",
    "One flat tone per object (coloring-book look). Always add at least a shadow tier.",
    "Perfect circles or ruler-straight diagonals at tiny sizes — hand-place the anti-alias step pixels.",
  ],
};

const MATERIAL_RECIPES = {
  title: "Material recipes (condensed)",
  metal:
    "Dark outline, cool mid-tone body, lighter upper lip, dark lower/right recess, one near-white reflection. Nested contour bands on columns: dark cavity, gray-blue wall, cyan-lit edge, lavender transition, dark base. Inset seams and alternating trim bands.",
  glass:
    "Dark bezel with stepped gray or lavender casing. Inside: dark blue, saturated cyan, pale cyan, tiny white reflections. Center brighter than bezel; asymmetrical glints. Small interface clusters, not one blue rectangle. Screens illuminate nearby trim with a cool highlight.",
  floorTiles:
    "Pale pink tile faces, cream or mint grout, coral boundary bands, occasional alternate highlight/shadow tiles. Each tile: lighter top/left inset, muted lower/right inset. Vary selected interiors with reflections or pale mint patches. Interrupt the grid with emblem, rug, counter footprint, or equipment cluster.",
  counters:
    "At least five horizontal layers: dark underside, shadowed base, mid-tone front, saturated top face, bright front lip. Stepped corner pixels. Small dishes, controls, seams, or emblems on top.",
  fabric:
    "Broad base color, darker folds at joins, lighter top plane, thin bright piping or edge. Separate cushions with dark seams and offset highlights.",
  foliage:
    "Dark irregular canopy first. Layer medium green clumps, bright top-left leaf clusters, pale yellow-green tips. Gaps and notches in silhouette. Shade the pot separately with earthy colors and a hard contact shadow.",
  characters:
    "Chibi proportions: large readable head, compact torso, short limbs, strong accessory or silhouette cue. Faces use few high-contrast pixels. Shade hair, skin, clothing, and accessories as separate materials. Dark contact cluster beneath feet.",
};

const CHARACTER_CONSTRUCTION = {
  title: "Character construction patterns",
  note:
    "Reusable proportion blueprints — not finished characters to copy. Leave 1–2 transparent pixels around the silhouette for clean stamping.",
  patterns: [
    "A — Front-facing attendant (20×30): head ~45% height; wide hair/cap mass with asymmetric protrusion; face narrowed by hair; tapered torso; offset arms; legs separated by dark gap; 2 dark eye pixels; one identity cluster (emblem, badge, ribbon).",
    "B — Cap-wearing trainer 3/4 (18×28): head shifted toward facing direction; brim projects 2–3 px; split jacket into lit near / dark far plane; backpack on one side; one foot forward; one full eye, far eye reduced; identity via brim+backpack, headphones+stripe, etc.",
    "C — Seated visitor (18×22): stamp partly behind chair/terminal; compress legs, widen knees; overlap lower torso with furniture; bright screen reflection on face or sleeve.",
    "D — Small companion creature (24×24): unequal ear/crest protrusions; head wider than torso; stepped cheek corners; tail as primary identity cue (zigzag, curl, flame); two eyes 4–6 px apart; one accent ramp on ears/belly/tail tip — not random.",
    "E — Bulky mascot (30×30–36×34): pear/shell/barrel silhouette 60–70% width; head overlaps body; arms/ears extend 2–5 px; broad merged contact shadow; internal volume bands — not a colored rectangle inside a black rectangle.",
  ],
  silhouetteShorthand:
    "Plan with H=hair/hat, F=face, B=body, A=accent, S=shadow, +=highlight, #=outline/contact, .=transparent. Make left and right contours differ; replace generic accents with identity details before drawing.",
};

const CHARACTER_VARIATION = {
  title: "Character variation rules",
  rule:
    "When a scene has several people or creatures, vary at least three of these for every adjacent pair:",
  vary: [
    "Head width or height.",
    "Hair, hat, ear, horn, or crest silhouette.",
    "Facing direction.",
    "Shoulder width and body shape.",
    "Pose or held prop.",
    "Value grouping: light head/dark body vs dark head/light body.",
    "Dominant hue.",
    "Footprint and contact shadow.",
    "Height by 2–6 pixels.",
  ],
  never: "Do not recolor one base sprite repeatedly. Neighboring figures need distinct silhouettes, poses, and value patterns.",
};

const CHARACTER_QUALITY = {
  title: "Character quality check",
  inspectAt: "Check each sprite at 1× and 8× before stamping.",
  checklist: [
    "At 1×, can the role or creature type be guessed from silhouette alone?",
    "Does the head have a clear front, side, and lower plane?",
    "Are hair, skin, clothing, and accessories shaded as different materials?",
    "Is one side visibly darker according to scene light?",
    "Are both arms and legs intentionally posed rather than mirrored?",
    "One strong identity cluster and fewer than three competing accents?",
    "Dark contact cluster anchors the feet?",
    "Readable over the floor without a rectangular background?",
  ],
  fixOrder:
    "If any answer is no, fix silhouette and value grouping before adding more facial pixels.",
};

const PRIMITIVES = {
  title: "Primitives — prefer bulk ops over per-pixel",
  note:
    "paint_asset and paint_page each accept rects, lines, fills, and pixels in ONE call. This is the advantage over one-pixel-at-a-time tools: a single rect fills any block server-side (no per-pixel cap). Reserve the pixels array for fine detail.",
  ops: [
    "rects: [{x,y,width,height,color}] — solid blocks. Floors, walls, furniture bodies, shading bands. color \"\" erases the block.",
    "lines: [{x0,y0,x1,y1,color}] — straight edges. Silhouettes, seams, table/counter edges.",
    "fills: [{x,y,color}] — flood bucket from x,y. Outline a region first, then flood the enclosed area.",
    "pixels: [{x,y,color}] — fine detail, applied LAST so it wins. Eyes, highlights, single-pixel anti-aliasing. Cap " +
      `${MAX_DRAW_PIXELS}/call.`,
  ],
  order: "Within one call ops apply rects → lines → fills → pixels.",
  erase: "There is no undo. To erase, paint a rects (or pixels) op with color \"\". To fix a region, erase then repaint; the response PNG shows the result.",
  tiling: "Use offsetX/offsetY to stamp a motif repeatedly (e.g. a tile drawn once, offset per column/row).",
};

const FEEDBACK_LOOP = {
  title: "Draw → look → fix (mandatory vision loop)",
  rule:
    "Every paint_asset and add_asset (with pixels) returns an inline PNG plus passHint and nextRequired. Compare it to your reference BEFORE the next pass. Never draw blind.",
  steps: [
    "After each mutation, read passHint and nextRequired in the JSON.",
    "Inspect the attached PNG (get_asset_image scale 4–8 to pixel-peep).",
    "Fix mistakes with another paint_asset call (color \"\" erases) — each returns a fresh PNG.",
    "Only stamp_assets once the sprite PNG matches your intent. Stamps are movable overlays (not baked into page.pixels); transparent pixels do not punch holes. Repeat the same asset (plants ×4).",
    "After stamping, call get_page_image for the full scene and important region crops. Treat colorCount and placementCount as evidence only; judge silhouettes, empty space, overlap, material ramps, and lighting in the PNG itself.",
  ],
};

const ASSET_DRAWING_LOOP = {
  title: "Asset drawing loop",
  steps: [
    "add_asset with empty transparent canvas sized for the object.",
    "Draw the dark silhouette and major cutouts.",
    "Inspect with get_asset_image at 6–8×. Fix silhouette before adding detail.",
    "Add base material regions.",
    "Add deep shadow and occlusion clusters.",
    "Add lit planes and small specular accents.",
    "Add identity details: face, controls, seams, leaves, handles, symbols, trim.",
    "Inspect again at native scale and enlarged — must read at both.",
  ],
  compare:
    "Match the number of meaningful planes and edge treatments in equivalent quality categories (machine to machine, character to character), not exact colors or shape.",
};

const SCENE_ASSEMBLY = {
  title: "Scene assembly loop",
  steps: [
    "1. Stamp repeating floor tiles across the ground plane.",
    "2. Add emblem/rug/shadow overlays on the floor (under furniture).",
    "3. Add large furniture and equipment, back to front.",
    "4. Add 3–6 character or creature sprites with different silhouettes and poses.",
    "5. Add 8–15 small props and 3–6 environmental details.",
    "6. Repeat a few assets (plants ×4) rather than unique copies; vary overlap and neighbors.",
    "7. Check the full page with get_page_image (scale 3) after every few stamps.",
    "8. Fill dead areas with purposeful clusters, not random pixels.",
  ],
  density:
    "Aim for roughly 18–30 distinct visual elements in a dense scene. The number is a diagnostic, not a quota.",
};

const QUALITY_LOOP = {
  title: "QUALITY_LOOP — reference to finished scene",
  steps: [
    "1. get_pixel_art_guide (this) at session start.",
    "2. Study the reference: list distinct objects. Aim for 12–30+ small assets.",
    "3. Create multiple named palettes for material/asset families. They are reusable working profiles, not hard-bound to assets; prefer cohesive ramps over raw color count.",
    "4. When image generation is available, use it for complex organic characters or props and import each clean PNG with the visible Import image control; use WebMCP primitives for tiles, corrections, and deliberate pixel cleanup.",
    "5. add_page with a width that fits scene density (160–224 for rich rooms).",
    "6. Per hand-drawn asset: add_asset template \"empty\" → paint_asset passes (outline → fill → shade → reflected light → highlight), comparing the PNG each pass.",
    "7. Build floor tiles first, then emblem/shadows, furniture, plants, and characters.",
    "8. stamp_assets back-to-front as movable overlays (floor tiles → emblem/shadows → furniture → plants/characters). Repeat stamps (plants ×4). Transparent pixels do not punch holes.",
    "9. get_page_image (full, then region crops) — compare to reference, read sceneHint, iterate until the frame is full and layered.",
    "10. paint_page only for flat sky/floor fills and tiny page touch-ups — never to paint a whole scene.",
  ],
};

const DECOMPOSITION = {
  title: "Decomposition sizes",
  sizes: [
    "8×8 — floor/wall tiles (stamp/tile many), tiny props",
    "16×16 — icons, small items, plants",
    "24×24 — small characters, chairs",
    "32×32 — characters (default), furniture units",
    "48×48 — larger props / machines",
    "64×64 — hero/foreground sprites; 96×96 max, work in quadrants",
  ],
  budget: `A dense room needs 12–30+ small assets. Library holds ${MAX_ASSETS}; each side ≤${MAX_ASSET_SIDE}px. Never one-shot a whole scene as one giant asset or a page-wide pixel array.`,
  composition:
    "Compose depth with overlay stamps: floor tiles → emblem/shadows → furniture → plants/characters. Repeat stamps (plants ×4). Distant items smaller and higher; overlap so they read as one space. Transparent pixels do not punch holes.",
};

const QUALITY_CHECK = {
  title: "Quality check before finishing",
  verify: [
    "The scene is original — no copied reference asset pixels.",
    "The frame reads as one place, not a catalog of sprites.",
    "Large, medium, and tiny shapes all appear.",
    "At least three depth layers overlap visibly.",
    "Major materials have distinct ramps for shadow, reflected light, base, and highlight, while related assets reuse shadow and light families.",
    "Highlights follow one lighting direction.",
    "Characters have contact shadows and readable silhouettes.",
    "Large surfaces contain structural detail without becoming noisy.",
    "Bright accents guide the eye toward 2–3 focal areas.",
    "The scene remains legible at native 256×144 scale.",
    "Close crops have layered edges, material-specific ramps, internal detail — no large undecorated blocks.",
  ],
  ifCrude:
    "Do not add more flat objects. Improve silhouettes, material ramps, overlap, edge variation, and clustered micro-detail of existing assets first.",
};

const TOOL_WORKFLOW = {
  title: "Tool cheat sheet (14 agent tools)",
  startHere: "Call get_pixel_art_guide at session start (topic: full or workflow).",
  afterRefresh:
    "Leaving the editor or refreshing unregisters its document.modelContext tools. Re-fetch live tools after returning; call get_storybook and wait until webmcp.ready before mutating. Storybook data persists in localStorage — get_storybook recovers asset ids.",
  read: [
    { name: "get_pixel_art_guide", when: "Session start — art taste + workflow" },
    { name: "get_storybook", when: "Pages + overlay placements, palettes + activePaletteId, asset ids, editor state, webmcp.ready" },
    { name: "get_asset_image", when: "Asset PNG + stats + rows for vision/text compare" },
    { name: "get_page_image", when: "Full page or region PNG + sceneHint after stamping (composites overlays)" },
  ],
  write: [
    { name: "set_palette", when: "Create/select multiple reusable material or asset-family profiles" },
    { name: "add_page", when: "New page + optional width for pixel density" },
    { name: "select_page", when: "Switch active page by index" },
    { name: "add_asset", when: "Create sprite — direct indexed bitmap, template empty, hex rows, fill, or page copy" },
    { name: "paint_asset", when: "Declared outline/fill/shadow/highlight/cleanup pass; returns a new revision PNG" },
    { name: "review_asset", when: "Record revise/approved vision observations for the inspected asset revision" },
    { name: "paint_page", when: "Page backgrounds/touch-ups: rects/lines/fills/pixels" },
    { name: "stamp_assets", when: "Add movable overlay placements (array order = z-index; not baked into pixels)" },
    { name: "place_text", when: "Rasterize story words onto the page" },
    { name: "review_page", when: "Record revise/approved vision observations for the inspected full page" },
  ],
  notes:
    "Choose the shortest asset path: ImageGen reference → visible Import image control → cleanup, exact small bitmap → add_asset bitmapPalette+indexedRows, or add_asset empty → declared paint_asset passes. Inspect with get_asset_image and approve with review_asset before stamping. Erase with color \"\" and repaint.",
};

const ANTI_PATTERNS = {
  title: "Anti-patterns (from real agent runs)",
  never: [
    "Shipping a sparse 'decorated wall' — a few big flat objects on empty canvas. Fill the frame with many assets.",
    "One flat tone per object. Always add a shadow tier; add highlights where lit.",
    "One-shotting a complex sprite or whole scene without inspecting and correcting the returned PNG.",
    "Painting entire pages with paint_page (or a giant pixels array) instead of overlay stamp_assets.",
    "One huge asset covering the page instead of many small overlay stamps.",
    "Adding colors without a lighting or material purpose. Rich named profiles are valid; random near-duplicates and one unique color per pixel are not shading.",
    "Skipping the inline PNG compare between passes (drawing blind).",
    "Losing asset ids after a refresh — call get_storybook to recover them; wait for webmcp.ready before mutating.",
    "More than one light-source direction within a sprite.",
    "Too few assets: 4 objects can't equal a 20-object reference.",
    "Recoloring one base character sprite for every figure in a crowd.",
    "Building the entire page as one raster or copied tiles instead of reusable original assets.",
  ],
};

function topicIncludes(
  topic: PixelArtGuideTopic,
  section: Exclude<PixelArtGuideTopic, "full">,
): boolean {
  return topic === "full" || topic === section;
}

export function normalizeGuideTopic(value: unknown): PixelArtGuideTopic {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if ((PIXEL_ART_GUIDE_TOPICS as readonly string[]).includes(key)) {
      return key as PixelArtGuideTopic;
    }
  }
  return "full";
}

export function buildPixelArtGuide(topic: PixelArtGuideTopic = "full") {
  const guide: Record<string, unknown> = {
    topic,
    qualityBar: QUALITY_BAR,
    feedbackLoop: FEEDBACK_LOOP,
    hint: "Call early each session. Inspect the attached quality target, then use topic storybook-rpg | workflow | shading | composition | tools | full.",
  };

  if (topicIncludes(topic, "composition")) {
    guide.composition = COMPOSITION_GRAMMAR;
    guide.sceneAssembly = SCENE_ASSEMBLY;
    guide.qualityCheck = QUALITY_CHECK;
  }

  if (topic === "storybook-rpg" || topic === "full") {
    guide.storybookRpg = STORYBOOK_RPG;
  }

  if (topicIncludes(topic, "shading")) {
    guide.shading = OUTLINE_SHADING;
    guide.palette = PALETTE_GUIDE;
    guide.pixelShape = PIXEL_SHAPE_LANGUAGE;
    guide.materials = MATERIAL_RECIPES;
  }

  if (topicIncludes(topic, "workflow")) {
    guide.qualityLoop = QUALITY_LOOP;
    guide.decomposition = DECOMPOSITION;
    guide.primitives = PRIMITIVES;
    guide.antiPatterns = ANTI_PATTERNS;
    guide.assetDrawingLoop = ASSET_DRAWING_LOOP;
    guide.sceneAssembly = SCENE_ASSEMBLY;
    guide.characters = {
      construction: CHARACTER_CONSTRUCTION,
      variation: CHARACTER_VARIATION,
      qualityCheck: CHARACTER_QUALITY,
    };
  }

  if (topicIncludes(topic, "tools")) {
    guide.tools = TOOL_WORKFLOW;
    guide.primitives = PRIMITIVES;
  }

  if (topic === "full") {
    guide.examplePrompt =
      "set_palette several reusable material/asset profiles → add_page width 192 → generate/import complex clean PNG assets when available, or add_asset empty → paint_asset outline → fill → shade → reflected light → highlight, comparing each PNG → add animation frames with frameIndex and timing with frameDuration → stamp_assets back-to-front → get_page_image full and region comparisons until the frame is full and layered.";
  }

  return guide;
}
