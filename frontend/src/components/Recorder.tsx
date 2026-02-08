import React, { useRef, useState, useEffect } from 'react';
import { useGetSignedUrl, uploadFileToUrl } from '../services/api';

interface RecorderProps {
  onUploadComplete: (data: { downloadUrl: string; blobName: string }) => void;
  autoStart?: boolean;
}

export const Recorder: React.FC<RecorderProps> = ({ onUploadComplete, autoStart = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSignedUrlMutation = useGetSignedUrl();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        await handleUpload(blob);
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError("Could not access camera/microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleUpload = async (blob: Blob) => {
    setIsUploading(true);
    try {
      // 1. Get Signed URL
      const filename = `recording_${Date.now()}.webm`;
      const { upload_url, download_url, filename: blobName } = await getSignedUrlMutation.mutateAsync({
        filename,
        contentType: 'video/webm'
      });

      // 2. Upload to Firebase
      await uploadFileToUrl(upload_url, blob, 'video/webm');

      // 3. Notify parent with both download URL and blob name
      onUploadComplete({ downloadUrl: download_url, blobName });
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload video.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (autoStart) {
      startRecording();
    }
    return () => {
      // Cleanup if unmounted while recording
      if (isRecording) {
        stopRecording();
      }
    };
  }, [autoStart]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted // Mute local playback to avoid feedback
        className="w-full h-full object-cover"
      />

      {/* Controls Overlay */}
      <div className="absolute bottom-4 flex flex-col items-center gap-2">
        {error && <div className="text-red-500 bg-black/50 px-2 rounded mb-2">{error}</div>}

        {isUploading ? (
          <div className="text-white bg-blue-600 px-4 py-2 rounded-full animate-pulse">
            Uploading...
          </div>
        ) : !isRecording ? (
          <button
            onClick={startRecording}
            className="px-6 py-2 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition cursor-pointer"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-6 py-2 bg-gray-800 text-white rounded-full font-bold border border-red-500 hover:bg-gray-700 transition cursor-pointer"
          >
            Stop & Upload
          </button>
        )}
      </div>

      {isRecording && (
        <div className="absolute top-4 right-4 w-4 h-4 bg-red-600 rounded-full animate-pulse" />
      )}
    </div>
  );
};
