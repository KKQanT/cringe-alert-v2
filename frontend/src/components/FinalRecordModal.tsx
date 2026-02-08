import React, { useState, useCallback, useRef } from 'react';
import { X, Film, Upload, Loader2 } from 'lucide-react';
import { Recorder } from './Recorder';
import { useGetSignedUrl, uploadFileToUrl } from '../services/api';

interface FinalRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (downloadUrl: string, blobName: string) => void;
}

type ModalPhase = 'idle' | 'uploading';

export const FinalRecordModal: React.FC<FinalRecordModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [phase, setPhase] = useState<ModalPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const getSignedUrlMutation = useGetSignedUrl();

  const handleRecordComplete = useCallback(({ downloadUrl, blobName }: { downloadUrl: string; blobName: string }) => {
    onComplete(downloadUrl, blobName);
  }, [onComplete]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid video file (MP4, WebM, or MOV)');
      return;
    }

    setPhase('uploading');
    setUploadProgress('Getting upload URL...');
    try {
      const filename = `final_${Date.now()}_${file.name}`;
      const { upload_url, download_url, filename: blobName } = await getSignedUrlMutation.mutateAsync({
        filename,
        contentType: file.type,
      });

      setUploadProgress('Uploading video...');
      await uploadFileToUrl(upload_url, file, file.type);

      onComplete(download_url, blobName);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload video');
      setPhase('idle');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [getSignedUrlMutation, onComplete]);

  // Reset state when modal opens/closes
  const handleClose = useCallback(() => {
    setPhase('idle');
    setUploadProgress('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] bg-[var(--color-surface-base)] rounded-2xl border border-[var(--color-border)] shadow-2xl flex flex-col overflow-hidden animate-fadeInUp">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Film className="w-5 h-5 text-[var(--color-primary)]" />
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg">Record Final Performance</h3>
            <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
              Show what you've got! Record your full performance.
            </p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5 text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {phase === 'idle' && (
            <>
              {/* Record area */}
              <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-black" style={{ height: '360px' }}>
                <Recorder onUploadComplete={handleRecordComplete} />
              </div>

              {/* Upload alternative */}
              <div className="flex items-center justify-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-text-dim)]">or</span>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm font-medium">Upload a video file</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}

          {phase === 'uploading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
              <p className="text-sm text-[var(--color-text-muted)]">{uploadProgress}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2.5 rounded-xl bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-mid)] text-[var(--color-text-muted)] border border-[var(--color-border)] transition font-medium text-sm cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
