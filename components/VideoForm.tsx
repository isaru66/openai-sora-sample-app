import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { ImageIcon, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "../ui";
import {
  SECONDS_OPTIONS,
  type SizeOptionGroups,
  type SoraModel,
  type SoraSeconds,
} from "../utils/video";
import type { ImagePreviewMeta } from "../hooks/useVideoForm";
import type { GeneratedImageSuggestion } from "@/types/generated";

type AsyncMaybe = void | Promise<unknown>;

const VERSION_OPTIONS = [1, 2, 3, 4];

const VIDEO_PROMPT_TEMPLATES = [
  {
    id: "genai-2025",
    label: "GenAI 2025 cinematic",
    seconds: "8" as SoraSeconds,
    prompt: `cinematic video showcasing the advanced phase of Generative AI. Use realistic, high-tech visuals with fast transitions and glowing neon accents. Tone: fast, exciting.

Timing & Scenes:
0-2 sec:
- Visual: Realistic video editing interface with AI assembling clips automatically.
- Text: "Video (2025)" (bottom center).
- Audio: Ambient tech sound only (no voice yet).

2-5 sec:
- Visual: Brain-like holographic structure with glowing memory nodes and contextual data streams.
- Text: "Memory & Contextual Awareness (2025)" (bottom center).
- Voice: "Video creation in 2025... with memory and contextual awareness..."

5-7 sec:
- Visual: Realistic futuristic city with autonomous AI agents (robots and avatars) interacting with humans.
- Text: "Autonomous Agents (2025)" (bottom center).
- Voice: "...and autonomous agents shaping the future..."

7-8 sec:
- Visual: Bold tagline glowing: "GenAI: The Next Frontier" (center, large, metallic neon effect).
- Audio: Music crescendo, no voice.

Voiceover:
- Tone: Fast, exciting, realistic.
- Script: "Video creation in 2025... with memory and contextual awareness... and autonomous agents shaping the future..."

Background Music:
- Futuristic electronic soundtrack with fast tempo, ending in a crescendo at second 8.`,
  },
  {
    id: "thai-market-reference",
    label: "Thai market reference animation",
    seconds: "8" as SoraSeconds,
    prompt: `HD quality, 3D video animation, cartoon network style. Scene set in Thailand fresh market.
Use the uploaded image for character reference in the video.
Reference image:
- ปีศาจหนี้ ตัวละครขวาสุด เสียงทุ้มต่ำ
- ป้าแสง ตัวละครซ้าย แม่ค้าขายผลไม้ เสียงแก่ แหบนิดๆ
- พิม (ตำรวจการเงิน SCB หญิง) ตัวละครที่สาม เสียงสดใส
- ต้น (ตำรวจการเงิน SCB ชาย) ตัวละครขวาสุด เสียงนุ่มนวล

Use the scene for reference and create characters regarding the reference image. Create the 3D video animation.

First scene: scene set in the fresh market. Debt demon flashy quickly appear on the shoulder of ป้าแสง and says "เงินไม่พอ ก็กู้เลยซิ".

Second scene: ในแผงขายผลไม้ ภาพตัดไปบนมือถือบนมือป้าแสง บนมือถือมีภาพ online shopping app มือป้าแสง เอื้อมไปกดปุ่ม "เงินกู้ด่วน".`,
  },
] as const;

type OrientationId = "portrait" | "landscape";
type FormTab = "video" | "image";

const formatSizeKey = (orientation: OrientationId, sizeValue: string) =>
  `${orientation}|${sizeValue}`;

const parseSizeKey = (
  key: string
): { orientation: OrientationId; size: string } => {
  const [rawOrientation, rawSize] = key.split("|", 2);
  const orientation: OrientationId =
    rawOrientation === "portrait" ? "portrait" : "landscape";
  return { orientation, size: rawSize ?? key };
};

const deriveSizeKey = (
  sizeValue: string,
  groups: SizeOptionGroups,
  preferredOrientation?: OrientationId
) => {
  const matches = (orientation: OrientationId) => {
    const options = groups[orientation] ?? [];
    return options.includes(sizeValue)
      ? formatSizeKey(orientation, sizeValue)
      : null;
  };

  if (preferredOrientation) {
    const preferred = matches(preferredOrientation);
    if (preferred) return preferred;
  }

  return (
    matches("portrait") ||
    matches("landscape") ||
    formatSizeKey("landscape", sizeValue)
  );
};

const CONTROL_TRIGGER_CLASS =
  "flex h-9 items-center gap-2 rounded-full border border-border/60 bg-card px-3 text-sm text-foreground/90 shadow-none transition-colors focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 data-[state=open]:bg-card/90";

const CONTROL_TRIGGER_CONTENT_CLASS = "flex w-full items-center gap-3";

const CONTROL_TRIGGER_LABEL_CLASS =
  "mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground";

const CONTROL_TRIGGER_VALUE_CLASS = "flex-1 truncate text-foreground";

const CONTROL_CONTENT_CLASS =
  "rounded-xl border border-border/60 bg-card/95 p-0 shadow-none";

export interface BatchProgressState {
  total: number;
  current: number;
}

export interface VideoFormProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  model: SoraModel;
  onModelChange: (value: SoraModel) => void;
  modelOptions: readonly SoraModel[];
  imageModel: string;
  onImageModelChange: (value: string) => void;
  imageModelOptions: readonly string[];
  imageSize: string;
  onImageSizeChange: (value: string) => void;
  imageSizeOptions: readonly string[];
  size: string;
  onSizeChange: (value: string) => void;
  sizeOptionGroups: SizeOptionGroups;
  seconds: SoraSeconds;
  onSecondsChange: (value: SoraSeconds) => void;
  versionsCount: number;
  onVersionsCountChange: (value: number) => void;
  remixId: string;
  onRemixIdChange: (value: string) => void;
  onImageSelect: (event: ChangeEvent<HTMLInputElement>) => AsyncMaybe;
  imagePreviewUrl: string | null;
  imagePreviewMeta: ImagePreviewMeta | null;
  onGenerateImages: () => AsyncMaybe;
  generatingImages: boolean;
  generatedImages: GeneratedImageSuggestion[];
  generatedImageError: string;
  onSubmit: () => AsyncMaybe;
  onClear: () => void;
  onGeneratePrompt?: () => AsyncMaybe;
  generatingPrompt?: boolean;
  submitting: boolean;
  canSubmit: boolean;
  generatingTitle: boolean;
  currentTitle: string;
  batchProgress: BatchProgressState | null;
  remixDisabled: boolean;
}

const VideoForm = ({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  modelOptions,
  imageModel,
  onImageModelChange,
  imageModelOptions,
  imageSize,
  onImageSizeChange,
  imageSizeOptions,
  size,
  onSizeChange,
  sizeOptionGroups,
  seconds,
  onSecondsChange,
  versionsCount,
  onVersionsCountChange,
  remixId,
  onRemixIdChange,
  onImageSelect,
  imagePreviewUrl,
  imagePreviewMeta,
  onGenerateImages,
  generatingImages,
  generatedImages = [],
  generatedImageError,
  onSubmit,
  onClear,
  onGeneratePrompt,
  generatingPrompt = false,
  submitting,
  canSubmit,
  generatingTitle,
  currentTitle,
  batchProgress,
  remixDisabled,
}: VideoFormProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<FormTab>("video");
  const [promptTemplateId, setPromptTemplateId] = useState<string>(
    VIDEO_PROMPT_TEMPLATES[0].id
  );
  const versionValue = useMemo(() => {
    const parsed = Number(versionsCount) || 1;
    const normalized = Math.min(4, Math.max(1, parsed));
    return String(normalized);
  }, [versionsCount]);

  const sizeSections = useMemo(
    () =>
      (
        [
          {
            id: "portrait" as OrientationId,
            label: "Portrait",
            options: sizeOptionGroups.portrait,
          },
          {
            id: "landscape" as OrientationId,
            label: "Landscape",
            options: sizeOptionGroups.landscape,
          },
        ] as const
      ).filter((section) => section.options.length > 0),
    [sizeOptionGroups]
  );

  const [sizeSelectionKey, setSizeSelectionKey] = useState(() =>
    deriveSizeKey(size, sizeOptionGroups)
  );

  useEffect(() => {
    setSizeSelectionKey((previous) => {
      const { orientation } = parseSizeKey(previous);
      const next = deriveSizeKey(size, sizeOptionGroups, orientation);
      return previous === next ? previous : next;
    });
  }, [size, sizeOptionGroups]);

  const hasPrompt = prompt.trim().length > 0;
  const promptTooltip = hasPrompt
    ? "Enhances your current prompt for video generation."
    : "Creates a video prompt from the selected Sora settings.";
  const imagePromptTooltip = hasPrompt
    ? "Generates reference images with GPT-image-2, Azure MAI."
    : "Add a prompt to enable GPT-image-2 image generation.";

  const modelCapability = imageModel === "MAI-Image-2"
    ? "MAI-Image-2 creates one PNG per request for photorealistic product, marketing, and brand visuals. Width and height stay within the 1024x1024 pixel budget."
    : "GPT-image-2 supports high-resolution natural-language image generation with flexible aspect ratios and strong instruction following.";

  const handleGeneratePromptClick = () => {
    if (!onGeneratePrompt) return;
    void onGeneratePrompt();
  };

  const selectedPromptTemplate =
    VIDEO_PROMPT_TEMPLATES.find((template) => template.id === promptTemplateId)
    ?? VIDEO_PROMPT_TEMPLATES[0];

  const applyPromptTemplate = () => {
    onPromptChange(selectedPromptTemplate.prompt);
    onSecondsChange(selectedPromptTemplate.seconds);
  };

  const handleVersionChange = (value: string) => {
    const parsed = Number(value);
    onVersionsCountChange(Number.isFinite(parsed) ? parsed : 1);
  };

  const handleSizeSelect = (value: string) => {
    const { orientation, size: nextSize } = parseSizeKey(value);
    setSizeSelectionKey(formatSizeKey(orientation, nextSize));
    onSizeChange(nextSize);
  };

  const triggerFileDialog = () => {
    if (remixDisabled) return;
    fileInputRef.current?.click();
  };

  const promptHasImage = Boolean(imagePreviewUrl);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-none  shadow-none">
      <CardContent className="flex flex-1 min-h-0 flex-col overflow-y-auto space-y-6 px-0">
        <section className="rounded-xl border border-border/60 bg-card/80 p-5 shadow-none backdrop-blur-sm">
          <div className="flex flex-col gap-5">
            <div className="inline-flex w-fit rounded-full border border-border/60 bg-muted/50 p-1 text-sm">
              {([
                ["video", "Video creation"],
                ["image", "Image creation"],
              ] as const).map(([tab, label]) => (
                <Button
                  key={tab}
                  type="button"
                  variant={activeTab === tab ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab)}
                  className="rounded-full px-4"
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <label
                htmlFor="remix-id"
                className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                Remix from video ID
              </label>
              <Input
                id="remix-id"
                value={remixId}
                onChange={(event) => onRemixIdChange(event.target.value)}
                placeholder="video_..."
                className="h-9 w-full max-w-xs rounded-none border-0 border-b border-border/70 bg-transparent px-0 text-sm text-foreground shadow-none transition focus-visible:border-border focus-visible:outline-none focus-visible:ring-0"
              />
            </div>

            <div className="relative">
              <InputGroup
                className={cn(
                  "flex gap-0 rounded-xl bg-muted/40 focus-within:ring-0 focus-within:ring-offset-0",
                  remixDisabled ? "opacity-80" : ""
                )}
              >
                <div className="relative w-full">
                  {promptHasImage ? (
                    <div className="absolute left-5 top-5 flex gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-border/50 bg-card/40">
                        {imagePreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imagePreviewUrl}
                            alt="Prompt reference"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <InputGroupTextarea
                    value={prompt}
                    onChange={(event) => onPromptChange(event.target.value)}
                    placeholder="Describe the scene you want Sora to create..."
                    className={cn(
                      "min-h-[220px] w-full resize-none border-0 bg-transparent px-6 pb-16 pt-6 text-base leading-relaxed text-foreground",
                      promptHasImage ? "pl-[7.5rem]" : ""
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClear}
                    className="absolute right-5 top-5 h-8 w-8 rounded-full border border-border/60 bg-card/85 text-muted-foreground hover:text-foreground"
                    aria-label="Clear form"
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  {imagePreviewMeta ? (
                    <p className="text-xs text-muted-foreground pb-2 pl-2">
                      {imagePreviewMeta.name} • {imagePreviewMeta.width}x
                      {imagePreviewMeta.height}
                    </p>
                  ) : null}
                </div>

                <InputGroupAddon
                  align="block-end"
                  className="flex w-full flex-col gap-2 px-4 pb-4 pt-3 text-sm bg-transparent rounded-xl text-muted-foreground"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={remixDisabled}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      void onImageSelect(event);
                    }}
                  />
                  <div className="flex w-full items-center gap-3 overflow-x-auto pb-1">
                    <InputGroupButton
                      size="sm"
                      variant="ghost"
                      onClick={triggerFileDialog}
                      disabled={remixDisabled}
                      className="whitespace-nowrap bg-card rounded-full py-1 border border-dashed border-border/70 px-3 text-sm text-muted-foreground hover:border-border hover:bg-muted/60"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Add image
                    </InputGroupButton>

                    {activeTab === "video" ? (
                    <div className="flex min-w-max items-center gap-2">
                      <Select
                        value={model}
                        onValueChange={(value) =>
                          onModelChange(value as SoraModel)
                        }
                        disabled={remixDisabled}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Model
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Model" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Model
                          </div>
                          {modelOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={sizeSelectionKey}
                        onValueChange={handleSizeSelect}
                        disabled={remixDisabled}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Size
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Size" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          {sizeSections.map((section) => (
                            <Fragment key={section.label}>
                              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {section.label}
                              </div>
                              {section.options.map((option) => (
                                <SelectItem
                                  key={`${section.id}-${option}`}
                                  value={formatSizeKey(section.id, option)}
                                >
                                  {option}
                                </SelectItem>
                              ))}
                            </Fragment>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={seconds}
                        onValueChange={(value) =>
                          onSecondsChange(value as SoraSeconds)
                        }
                        disabled={remixDisabled}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Seconds
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Seconds" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Duration
                          </div>
                          {SECONDS_OPTIONS.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={versionValue}
                        onValueChange={handleVersionChange}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Versions
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Versions" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Versions
                          </div>
                          {VERSION_OPTIONS.map((option) => {
                            const value = String(option);
                            return (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    ) : (
                    <div className="flex min-w-max items-center gap-2">
                      <Select
                        value={imageModel}
                        onValueChange={onImageModelChange}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Image model
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Image model" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Image model
                          </div>
                          {imageModelOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={imageSize} onValueChange={onImageSizeChange}>
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Image size
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Image size" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Image size
                          </div>
                          {imageSizeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={versionValue}
                        onValueChange={handleVersionChange}
                      >
                        <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                          <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                            <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                              Images
                            </span>
                            <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                              <SelectValue placeholder="Images" />
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent className={CONTROL_CONTENT_CLASS}>
                          <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                            Images
                          </div>
                          {VERSION_OPTIONS.map((option) => {
                            const value = String(option);
                            return (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                  </div>
                  {activeTab === "image" ? (
                    <p className="w-full text-xs text-muted-foreground">
                      {modelCapability}
                    </p>
                  ) : null}
                </InputGroupAddon>
              </InputGroup>
            </div>

            {activeTab === "video" ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/35 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Automated prompt
                  </p>
                  <p className="text-sm text-foreground">
                    Start from a proven Sora prompt structure, then edit the
                    text before generating.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={promptTemplateId}
                    onValueChange={setPromptTemplateId}
                  >
                    <SelectTrigger className={CONTROL_TRIGGER_CLASS}>
                      <div className={CONTROL_TRIGGER_CONTENT_CLASS}>
                        <span className={CONTROL_TRIGGER_LABEL_CLASS}>
                          Template
                        </span>
                        <div className={CONTROL_TRIGGER_VALUE_CLASS}>
                          <SelectValue placeholder="Template" />
                        </div>
                      </div>
                    </SelectTrigger>
                    <SelectContent className={CONTROL_CONTENT_CLASS}>
                      {VIDEO_PROMPT_TEMPLATES.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={applyPromptTemplate}
                    className="rounded-full whitespace-nowrap"
                  >
                    <Sparkles className="h-4 w-4" />
                    Use template
                  </Button>
                </div>
              </div>
            ) : null}

            <TooltipProvider delayDuration={150}>
              <div className="flex flex-col md:flex-row md:items-center justify-end gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        onClick={handleGeneratePromptClick}
                        disabled={
                          generatingPrompt || !onGeneratePrompt
                        }
                        className="w-full rounded-full bg-muted/60 px-5 text-xs text-foreground hover:bg-muted/70 disabled:opacity-50 md:w-auto md:text-sm"
                      >
                        {generatingPrompt ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Generate prompt
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-none">
                    {promptTooltip}
                  </TooltipContent>
                </Tooltip>

                {activeTab === "image" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <Button
                        type="button"
                        variant="ghost"
                        size="lg"
                        disabled={
                          !hasPrompt || remixDisabled || generatingImages
                        }
                        onClick={() => {
                          if (!hasPrompt) return;
                          void onGenerateImages();
                        }}
                        className="w-full rounded-full bg-muted/60 px-5 text-xs text-foreground hover:bg-muted/70 disabled:opacity-50 md:w-auto md:text-sm"
                      >
                        {generatingImages ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="h-4 w-4" />
                        )}
                        Generate image (GPT-image-2, Azure MAI)
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-md border border-border bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-none">
                    {imagePromptTooltip}
                  </TooltipContent>
                </Tooltip>
                ) : null}

                {activeTab === "video" ? (
                <Button
                  onClick={() => {
                    void onSubmit();
                  }}
                  disabled={submitting || !canSubmit}
                  size="lg"
                  className="rounded-full px-6 text-xs font-semibold md:text-sm"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Generate video
                </Button>
                ) : null}
              </div>
            </TooltipProvider>
          </div>
        </section>

        <div className="space-y-4">
          {generatingTitle ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating title...</span>
            </div>
          ) : null}

          {!generatingTitle && currentTitle ? (
            <div className="rounded-lg border border-border bg-card/80 px-4 py-6 text-sm text-foreground">
              <span className="font-medium">Generated title:</span>{" "}
              {currentTitle}
            </div>
          ) : null}

          {generatedImageError ? (
            <p className="text-xs text-destructive">{generatedImageError}</p>
          ) : null}

          {generatedImages.length > 0 ? (
            <p className="rounded-lg border border-border/60 bg-card/80 px-4 py-3 text-xs text-muted-foreground">
              Generated images are available in the library panel for preview,
              download, and use as video reference images.
            </p>
          ) : null}

          {batchProgress && batchProgress.total > 1 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Generating version {batchProgress.current} of{" "}
                {batchProgress.total}...
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoForm;

export type { GeneratedImageSuggestion } from "@/types/generated";
