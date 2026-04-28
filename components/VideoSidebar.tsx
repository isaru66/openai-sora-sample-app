import { useMemo } from "react";
import { Download, ImageIcon, Loader2, PlayCircle, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import VideoCard from "./VideoCard";
import { isCompletedStatus, type VideoItem } from "../utils/video";
import type { GeneratedImageSuggestion } from "@/types/generated";

type AsyncMaybe = void | Promise<unknown>;

export type SidebarPreviewState = {
  previewingId: string | null;
  previewLoading: boolean;
};

export interface VideoSidebarProps {
  items: VideoItem[];
  generatedImages: GeneratedImageSuggestion[];
  selectedGeneratedImageId: string | null;
  thumbnails: Record<string, string>;
  onDownloadAll: () => void;
  downloadingAll: boolean;
  onDownloadImage: (image: GeneratedImageSuggestion) => AsyncMaybe;
  onPreviewImage: (image: GeneratedImageSuggestion) => AsyncMaybe;
  onUseImageAsReference: (image: GeneratedImageSuggestion) => AsyncMaybe;
  onDownload: (item: VideoItem) => AsyncMaybe;
  onPlayPreview: (item: VideoItem) => AsyncMaybe;
  onRemix: (item: VideoItem) => AsyncMaybe;
  onRetry: (item: VideoItem) => AsyncMaybe;
  onRefresh: (item: VideoItem) => AsyncMaybe;
  onRemove: (item: VideoItem) => AsyncMaybe;
  refreshingMap: Record<string, boolean>;
  previewState: SidebarPreviewState;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

const VideoSidebar = ({
  items,
  generatedImages,
  selectedGeneratedImageId,
  thumbnails,
  onDownloadAll,
  downloadingAll,
  onDownloadImage,
  onPreviewImage,
  onUseImageAsReference,
  onDownload,
  onPlayPreview,
  onRemix,
  onRetry,
  onRefresh,
  onRemove,
  refreshingMap,
  previewState,
  isMobileOpen,
  onMobileClose,
}: VideoSidebarProps) => {
  const hasDownloadable = useMemo(
    () =>
      items.some(
        (item) => item?.id && isCompletedStatus(item.status) && !item.downloaded
      ),
    [items]
  );
  const hasGenerations = items.length > 0 || generatedImages.length > 0;

  const downloadHint = downloadingAll
    ? "Downloading completed videos…"
    : "Downloads may expire after one hour.";

  return (
    <aside
      className={cn(
        "order-1 h-screen w-full flex-none overflow-y-auto border-b border-border/60 bg-card/90 backdrop-blur-sm shadow-sm transition-all lg:order-1 lg:h-screen lg:max-h-screen lg:w-[30rem] lg:border-b-0 lg:border-r lg:border-border/60 lg:shadow-none xl:w-[32rem] lg:sticky lg:top-0",
        isMobileOpen ? "fixed inset-0 z-50 flex" : "hidden",
        "lg:flex lg:flex-col"
      )}
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-5">
          <div className="flex flex-col gap-1">
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Library
            </div>
            <div className="text-xl font-semibold text-foreground">
              Your generations
            </div>
            <div className="text-xs text-muted-foreground">{downloadHint}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onDownloadAll}
              disabled={downloadingAll || !hasDownloadable}
              className="hidden rounded-full whitespace-nowrap lg:inline-flex"
            >
              {downloadingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download all
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDownloadAll}
              disabled={downloadingAll || !hasDownloadable}
              className="inline-flex whitespace-nowrap lg:hidden"
            >
              {downloadingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMobileClose}
              className="-mr-1 text-muted-foreground hover:text-foreground lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-3 py-4">
          {!hasGenerations ? (
            <div className="flex h-full items-center justify-center px-2 py-6">
              <Empty className="max-w-sm border-none bg-transparent shadow-none">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PlayCircle className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No generations yet</EmptyTitle>
                  <EmptyDescription>
                    Start by generating videos or images to see them appear in your
                    library.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {generatedImages.map((image) => {
                const isSelected = selectedGeneratedImageId === image.id;
                return (
                  <div
                    key={image.id}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-card/80 transition-colors",
                      isSelected
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-border/60 hover:bg-card"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onPreviewImage(image)}
                      className="block h-60 w-full overflow-hidden bg-muted text-left"
                      aria-label="Preview generated image"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt={image.description || "Generated image"}
                        className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
                      />
                    </button>
                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">
                            Generated image
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {image.id}
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                          Image
                        </span>
                      </div>
                      {image.description ? (
                        <p className="line-clamp-2 whitespace-pre-line text-xs text-foreground/90">
                          {image.description}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onDownloadImage(image)}
                          className="rounded-full px-3 text-xs font-semibold"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onPreviewImage(image)}
                          className="rounded-full border-border px-3 text-xs"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          Preview
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onUseImageAsReference(image)}
                          className="rounded-full border-border px-3 text-xs"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          Use as reference
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {items.map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  thumbnailUrl={thumbnails[item.id]}
                  onDownload={onDownload}
                  onPlayPreview={onPlayPreview}
                  onRemix={onRemix}
                  onRetry={onRetry}
                  onRefresh={onRefresh}
                  onRemove={onRemove}
                  isRefreshing={Boolean(refreshingMap[item.id])}
                  isPreviewing={previewState.previewingId === item.id}
                  previewLoading={previewState.previewLoading}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default VideoSidebar;
