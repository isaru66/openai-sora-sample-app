export interface ImagePromptTemplate {
  id: string;
  label: string;
  category: string;
  description: string;
  preferredAspectRatio: "16:9" | "9:16" | "3:4" | "1:1";
  prompt: string;
}

export const IMAGE_PROMPT_TEMPLATES = [
  {
    id: "cinematic-portrait",
    label: "Cinematic portrait",
    category: "Photography",
    description: "Minimal film-still portrait with dramatic lighting.",
    preferredAspectRatio: "16:9",
    prompt: `Cinematic film still. A [subject] standing in [environment]. Strong [lighting setup], [shadow or reflection notes]. Symmetrical composition, minimal set design, no background clutter. The mood is [mood adjectives], like a still from a [reference director] film. High resolution, aspect ratio 16:9, no watermark, no border.`,
  },
  {
    id: "city-poster",
    label: "City poster",
    category: "Design",
    description: "Premium city illustration with sharp headline text.",
    preferredAspectRatio: "9:16",
    prompt: `A striking [season/year] [theme] poster for [city] with [tone descriptor]. Clean [background] with generous negative space. [Foreground anchor element] in [position]. [Dynamic curve element] sweeping into [main composition]. Inside the composition: [8-12 landmarks or elements]. [Atmospheric lighting], subtle accents in [color 1] and [color 2]. Elegant typography in the [position] reads '[HEADLINE]' with a [orientation] slogan '[SLOGAN]'. Text must be sharp and beautifully composed. Premium graphic design, aspect ratio 9:16.`,
  },
  {
    id: "character-reference",
    label: "Character reference sheet",
    category: "Concept art",
    description: "Multi-view character sheet for consistent design.",
    preferredAspectRatio: "16:9",
    prompt: `Create a professional character reference sheet for [character archetype]: [detailed appearance description]. Include on a clean white background: a three-view turnaround showing front, side, and back; facial expression variations showing neutral, smiling, angry, and surprised; detailed breakdowns of costume and equipment pieces; a color palette swatch row; and brief world-building notes in clean typography. Organized grid layout, concept art style, high resolution. Aspect ratio 16:9.`,
  },
  {
    id: "ui-social-mockup",
    label: "UI / social mockup",
    category: "UI",
    description: "Pixel-accurate mobile app screenshot with mixed text.",
    preferredAspectRatio: "9:16",
    prompt: `A hyper-realistic [device] screenshot of a fictional [app] [screen type] for [persona], as if they were [modern role/context]. [Profile/avatar description]. Bio reads: '[bio text]'. The grid/feed shows [N] posts: [list each post idea]. [Counter or metric]: [value]. [Highlights or tabs] labeled [labels]. Complete [OS] status bar with [details, including a deliberate accuracy check]. [Theme] UI throughout. Photorealistic screenshot quality, aspect ratio 9:16.`,
  },
  {
    id: "experimental-art",
    label: "Experimental art / humor",
    category: "Illustration",
    description: "Narrative visual gag with small readable text.",
    preferredAspectRatio: "16:9",
    prompt: `[Setting or scene with narrative twist]. [Main visual gag described literally]. [Secondary visual element extending the joke]. [Sign, placard, or book reads]: '[exact small-text content]'. [Style descriptor], [lighting], [tone adjectives]. Text must be sharp and beautifully composed. Aspect ratio 16:9.`,
  },
  {
    id: "lifestyle-food",
    label: "Lifestyle / food photo",
    category: "Photography",
    description: "Real-camera stack for cafe, food, and lifestyle scenes.",
    preferredAspectRatio: "1:1",
    prompt: `[POV phrase], [subject and action], [photography style], [lighting], shot on [camera body], [lens], [aperture], [texture details]. Aspect ratio [ratio].`,
  },
  {
    id: "travel-poster-collage",
    label: "Travel poster collage",
    category: "2hows",
    description: "Paper-collage travel poster using a named person or photo.",
    preferredAspectRatio: "3:4",
    prompt: `Travel poster of [LOCATION], featuring [YOUR NAME] as a modern-dressed traveler, collage scene with paper, stickers, hand-cut letters, iconic landmarks and cultural elements, dynamic editorial layout, premium magazine style. Headline text 'LOST IN [LOCATION]' in bold typography. Aspect ratio 3:4.`,
  },
  {
    id: "museum-map",
    label: "Museum map + 3D landscape",
    category: "2hows",
    description: "Tourism-board style map and isometric landscape.",
    preferredAspectRatio: "3:4",
    prompt: `Museum-style 2D map + 3D landscape model of [LOCATION], isometric view, clean infographic, terrain + roads + water + labels, premium colors, bright, highly detailed, paper texture. Aspect ratio 3:4.`,
  },
  {
    id: "product-collection",
    label: "Lifestyle product collection",
    category: "2hows",
    description: "Character or portrait on a loose merch flat-lay.",
    preferredAspectRatio: "16:9",
    prompt: `A horizontal lifestyle product collection featuring [CHARACTER NAME]: mugs, t-shirts, tote bags, caps, stickers, and phone cases, each printed with the character in different cheerful, playful, or cheeky poses. Loose, airy flat-lay arrangement on a clean neutral background. Premium product photography, soft daylight, aspect ratio 16:9.`,
  },
  {
    id: "editorial-infographic",
    label: "Editorial infographic poster",
    category: "2hows",
    description: "Scientific magazine-style poster for a landmark or object.",
    preferredAspectRatio: "3:4",
    prompt: `Editorial infographic poster of [LANDMARK OR OBJECT], documentary scientific magazine-style illustration with callout labels, arrows, sectional details, premium magazine layout, clean typography, paper texture, and high-resolution detail. Aspect ratio 3:4.`,
  },
  {
    id: "hybrid-lookbook",
    label: "Hybrid real-face lookbook",
    category: "2hows",
    description: "Use uploaded real face with 3D wardrobe mockups.",
    preferredAspectRatio: "16:9",
    prompt: `Use the real face from the original uploaded photo; do not stylise the face into a 3D mascot. Keep all wardrobe, footwear, and accessory items rendered as clean 3D product mockups in a lookbook layout. Maintain swatch row, label typography, and grid alignment. Studio softbox lighting, clean premium background, aspect ratio 16:9.`,
  },
  {
    id: "thai-marketing-banner",
    label: "Thai marketing banner",
    category: "Marketing",
    description: "Commercial banner with accurate Thai text.",
    preferredAspectRatio: "16:9",
    prompt: `[Layout] banner, [background scene], [photography style], Thai text '[exact text]' clearly visible [position], [typography style]. Text must be sharp and beautifully composed. [Lighting], shot on [camera], [lens]. Aspect ratio 16:9.`,
  },
] as const satisfies readonly ImagePromptTemplate[];

export type ImagePromptTemplateId = (typeof IMAGE_PROMPT_TEMPLATES)[number]["id"];

export const getImagePromptTemplate = (
  id: string | null | undefined,
): ImagePromptTemplate =>
  IMAGE_PROMPT_TEMPLATES.find((template) => template.id === id)
  ?? IMAGE_PROMPT_TEMPLATES[0];

