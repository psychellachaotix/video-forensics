export type SeekableVideo = {
  currentTime: number;
  play: () => Promise<unknown> | unknown;
  scrollIntoView: (options?: ScrollIntoViewOptions) => void;
};

export function canSeekToFinding(mediaType: string, seconds?: number | null) {
  return mediaType === "video"
    && typeof seconds === "number"
    && Number.isFinite(seconds)
    && seconds >= 0;
}

export function seekVideoToFinding(video: SeekableVideo | null, seconds?: number | null) {
  if (!video || !canSeekToFinding("video", seconds)) return false;
  video.currentTime = seconds as number;
  video.scrollIntoView({ behavior: "smooth", block: "center" });
  void video.play();
  return true;
}