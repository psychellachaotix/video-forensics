import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CloudUpload, LoaderCircle } from 'lucide-react';
import {
  getListAnalysesQueryKey,
  useCreateAnalysis,
  useRequestUploadUrl,
  type Analysis,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/lib/use-language';

type MediaKind = 'video' | 'image';

const formats: Record<MediaKind, { pattern: RegExp; accept: string }> = {
  video: { pattern: /\.(mp4|mov|mkv|avi)$/i, accept: '.mp4,.mov,.mkv,.avi,video/*' },
  image: { pattern: /\.(jpg|jpeg|png|webp)$/i, accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp' },
};

function putToSignedUrl(url: string, file: File, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`Storage returned ${request.status}.`));
    request.onerror = () => reject(new Error('Could not reach object storage.'));
    request.send(file);
  });
}

async function computeFileHash(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function MediaDropUpload({ kind, onCreated }: { kind: MediaKind; onCreated: (analysis: Analysis) => void }) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const requestUploadUrl = useRequestUploadUrl();
  const createAnalysis = useCreateAnalysis();

  const upload = async (file?: File) => {
    if (!file) return;
    if (!formats[kind].pattern.test(file.name)) {
      toast({ title: t.unsupportedFormat, description: kind === 'video' ? t.editorVideoFormats : t.editorImageFormats, variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      toast({ title: t.fileTooLarge, description: t.maxSizeIs2GB, variant: 'destructive' });
      return;
    }
    try {
      setProgress(1);
      const contentType = file.type || 'application/octet-stream';
      const signed = await requestUploadUrl.mutateAsync({ data: { name: file.name, size: file.size, contentType } });
      await putToSignedUrl(signed.uploadURL, file, setProgress);
      const created = await createAnalysis.mutateAsync({
        data: {
          name: file.name,
          objectPath: signed.objectPath,
          size: file.size,
          contentType,
          fileHash: await computeFileHash(file),
        },
      });
      await queryClient.invalidateQueries({ queryKey: getListAnalysesQueryKey() });
      onCreated(created);
      toast({ title: t.fileAddedToEditor, description: file.name });
    } catch (error) {
      toast({
        title: t.uploadFailed,
        description: error instanceof Error ? error.message : t.operationFailed,
        variant: 'destructive',
      });
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <button
      type="button"
      className={`w-full border border-dashed p-4 text-left transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-border bg-background/40 hover:border-primary/50 hover:bg-primary/5'}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void upload(event.dataTransfer.files[0]);
      }}
      disabled={progress !== null}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={formats[kind].accept}
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <div className="flex items-center gap-3">
        {progress !== null ? <LoaderCircle className="h-5 w-5 animate-spin text-primary" /> : <CloudUpload className="h-5 w-5 text-primary" />}
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground">{kind === 'video' ? t.dropVideoIntoEditor : t.dropImageIntoEditor}</div>
          <div className="mt-1 font-mono text-[9px] uppercase text-muted-foreground">
            {progress !== null ? `${t.uploadingFile} ${progress}%` : kind === 'video' ? t.editorVideoFormats : t.editorImageFormats}
          </div>
        </div>
      </div>
    </button>
  );
}