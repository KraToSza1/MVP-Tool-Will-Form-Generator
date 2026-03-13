/**
 * #8 Identity Verification - post-completion upload section
 * Photo ID, two proofs of address, selfie holding ID.
 * Take photo: opens device camera (phone or desktop) and captures image.
 * Upload: opens file picker for PDF/images.
 *
 * STORAGE:
 * - Files stored as base64 data URLs in formValues.identityVerification
 * - Persisted with form draft in localStorage (willForm key).
 *
 * Camera: browser getUserMedia only. Requires HTTPS (secure context).
 * In iframe: parent must use allow="camera" on the iframe.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, FileCheck, AlertCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { compressImageDataUrl } from '../lib/compressIdImages.js';

const UPLOAD_IDS = {
  photoId: 'identityVerificationPhotoId',
  proofOfAddress1: 'identityVerificationProofOfAddress1',
  proofOfAddress2: 'identityVerificationProofOfAddress2',
  selfieWithId: 'identityVerificationSelfieWithId',
};

const LABELS = {
  photoId: 'Photo ID (passport or driving licence)',
  proofOfAddress1: 'Proof of address 1 (e.g. utility bill, bank statement)',
  proofOfAddress2: 'Proof of address 2 (different document)',
  selfieWithId: 'Selfie holding your ID',
};

const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const CAPTURE_JPEG_QUALITY = 0.85;
const MAX_CAPTURE_WIDTH = 1200;

function UploadSlot({ id, label, hasValue, fileName, error, onTakePhoto, onUpload }) {
  const confirmationText = hasValue
    ? (fileName ? `${fileName} — Uploaded` : 'Uploaded')
    : null;
  return (
    <div className="upload-slot border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onTakePhoto(id)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg cursor-pointer hover:bg-indigo-200 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Camera size={18} />
          <span>Take photo</span>
        </button>
        <button
          type="button"
          onClick={() => onUpload(id)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg cursor-pointer hover:bg-gray-200 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Upload size={18} />
          <span>Upload</span>
        </button>
        {hasValue && (
          <span className="flex items-center gap-1 text-green-700 text-sm font-medium" role="status">
            <FileCheck size={16} className="shrink-0" aria-hidden />
            {confirmationText}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={14} />
          <span>{error}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">Maximum file size: {MAX_FILE_SIZE_MB}MB per file</p>
    </div>
  );
}

/** Returns true if the environment supports requesting camera (secure context + API). */
function isCameraSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Request a media stream with optional facingMode and deviceId.
 * Tries: preferred facingMode (ideal) -> other facingMode (ideal) -> no facingMode.
 */
async function getStreamWithFallback(preferFacingMode, deviceId = null) {
  const baseVideo = {
    width: { ideal: Math.min(1920, window.innerWidth) },
    height: { ideal: Math.min(1080, window.innerHeight) },
  };
  if (deviceId) baseVideo.deviceId = { exact: deviceId };

  const attempts = [
    { ...baseVideo, facingMode: { ideal: preferFacingMode } },
    { ...baseVideo, facingMode: { ideal: preferFacingMode === 'user' ? 'environment' : 'user' } },
    baseVideo,
  ];

  let lastErr;
  for (const video of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video,
        audio: false,
      });
      return stream;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export default function IdentityVerification({ formValues, setFormValues, submittedMatterId = null }) {
  const data = formValues.identityVerification || {};
  const fileNames = formValues.identityVerificationFileNames || {};
  const isPostSubmission = Boolean(submittedMatterId);
  const [errors, setErrors] = useState({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraKey, setCameraKey] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const persistDataUrl = async (key, dataUrl, successTitle, successDescription, displayFileName = null) => {
    if (typeof dataUrl !== 'string') {
      toast.error('Upload failed', { description: 'The selected file could not be read. Please try again.' });
      return;
    }

    const normalizedDataUrl = await compressImageDataUrl(dataUrl);
    setFormValues(prev => ({
      ...prev,
      identityVerification: {
        ...(prev.identityVerification || {}),
        [key]: normalizedDataUrl,
      },
      identityVerificationFileNames: {
        ...(prev.identityVerificationFileNames || {}),
        [key]: displayFileName ?? null,
      },
    }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    toast.success(successTitle, { description: successDescription });
  };

  const isImageFile = (file) => file?.type?.startsWith('image/');

  const setValueFromBlob = useCallback((key, blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      void persistDataUrl(key, reader.result, 'Photo captured', `${LABELS[key]} has been saved.`, 'Photo captured');
    };
    reader.onerror = () => toast.error('Failed to save photo.');
    reader.readAsDataURL(blob);
  }, []);

  const handleFile = (key, file) => {
    if (!file) return;
    const isImage = isImageFile(file);
    if (!isImage && file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const msg = `File size (${sizeMB}MB) exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB per file. Please choose a smaller file.`;
      setErrors(prev => ({ ...prev, [key]: msg }));
      toast.error('File too large', { description: msg });
      return;
    }
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    const fileName = file.name || 'Document';
    const reader = new FileReader();
    reader.onload = () => {
      void persistDataUrl(key, reader.result, 'File uploaded', `${LABELS[key]} has been uploaded successfully.`, fileName);
    };
    reader.onerror = () => toast.error('Upload failed', { description: 'There was an error reading the file. Please try again.' });
    reader.readAsDataURL(file);
  };

  const openCamera = (key) => {
    setCameraKey(key);
    setCameraError(null);
    setCameraRetryCount(0);
    setCapturedPreviewUrl(null);
    setCapturedBlob(null);
    setSelectedDeviceId(null);
    setLoading(true);
    setCameraOpen(true);
  };

  const requestCameraAgain = () => {
    setCameraError(null);
    setLoading(true);
    setCameraRetryCount((c) => c + 1);
  };

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraKey(null);
    setCameraError(null);
    setCapturedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCapturedBlob(null);
    setDevices([]);
    setSelectedDeviceId(null);
  }, []);

  // Request stream when modal opens or retry/device change
  useEffect(() => {
    if (!cameraOpen || !cameraKey) return;

    const preferFacing = cameraKey === UPLOAD_IDS.selfieWithId ? 'user' : 'environment';
    const controller = new AbortController();

    setLoading(true);
    setCameraError(null);

    getStreamWithFallback(preferFacing, selectedDeviceId || undefined)
      .then((stream) => {
        if (controller.signal.aborted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});

          const markReady = () => {
            if (controller.signal.aborted) return;
            setLoading(false);
          };
          let timeoutId = window.setTimeout(markReady, 5000);
          video.addEventListener('loadeddata', () => {
            window.clearTimeout(timeoutId);
            markReady();
          }, { once: true });
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        const msg = err?.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera in your browser settings, or click Try again. If this app is embedded in another webpage, the page owner may need to enable camera access for the embed.'
          : err?.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Could not start camera. Please check permissions or try again.';
        setCameraError(msg);
        setLoading(false);
      });

    return () => {
      controller.abort();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOpen, cameraKey, cameraRetryCount, selectedDeviceId]);

  // Attach stream to video when it becomes available (e.g. after error cleared)
  useEffect(() => {
    if (cameraError || loading || !streamRef.current || !videoRef.current) return;
    if (videoRef.current.srcObject === streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {});
  }, [cameraError, loading, cameraOpen, cameraKey]);

  // Enumerate devices when stream is active (to show camera switch)
  useEffect(() => {
    if (!cameraOpen || !navigator.mediaDevices?.enumerateDevices) return;

    navigator.mediaDevices.enumerateDevices()
      .then((all) => {
        const videoDevices = all.filter(d => d.kind === 'videoinput');
        setDevices(videoDevices);
      })
      .catch(() => setDevices([]));
  }, [cameraOpen, cameraRetryCount]);

  const switchCamera = (deviceId) => {
    setSelectedDeviceId(deviceId || null);
    setLoading(true);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !cameraKey || !streamRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const scale = Math.min(1, MAX_CAPTURE_WIDTH / w);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h, 0, 0, cw, ch);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          setCapturedPreviewUrl(url);
          setCapturedBlob(blob);
        } else {
          toast.error('Capture failed', { description: 'Could not create image.' });
        }
      },
      'image/jpeg',
      CAPTURE_JPEG_QUALITY
    );
  };

  const confirmUsePhoto = () => {
    if (capturedBlob && cameraKey) {
      setValueFromBlob(cameraKey, capturedBlob);
      closeCamera();
    }
  };

  const retakePhoto = () => {
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    setCapturedPreviewUrl(null);
    setCapturedBlob(null);
  };

  const handleTakePhoto = (key) => {
    if (!isCameraSupported()) {
      toast.error(
        'Camera not available',
        { description: 'Camera requires a secure connection (HTTPS) and browser support. Use "Upload" to choose a file instead.' }
      );
      return;
    }
    openCamera(key);
  };

  const handleUpload = (key) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.heic';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (file) handleFile(key, file);
    };
    input.click();
  };

  const showPreview = Boolean(capturedPreviewUrl && capturedBlob);

  return (
    <>
      <div id="identity-verification-section" className="id-verification-block mt-8 scroll-mt-24 border-t-2 border-amber-300 pt-8 bg-amber-50/50 -mx-4 px-4 py-4 rounded-xl">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
          {isPostSubmission ? 'Next step — submit ID for review' : 'Verification stage — before solicitor meeting'}
        </p>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">
          {isPostSubmission ? 'Submit identification' : 'Identity verification'}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {isPostSubmission
            ? `Your questionnaire has already been submitted. Upload your documents here, then click Update submission below to attach them to the same matter. Maximum ${MAX_FILE_SIZE_MB}MB per file.`
            : `Take a photo with your phone or computer camera, or upload a file. Maximum ${MAX_FILE_SIZE_MB}MB per file.`}
        </p>
        <div className="space-y-4">
          <UploadSlot id={UPLOAD_IDS.photoId} label={LABELS.photoId} hasValue={!!data[UPLOAD_IDS.photoId]} fileName={fileNames[UPLOAD_IDS.photoId]} error={errors[UPLOAD_IDS.photoId]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
          <UploadSlot id={UPLOAD_IDS.proofOfAddress1} label={LABELS.proofOfAddress1} hasValue={!!data[UPLOAD_IDS.proofOfAddress1]} fileName={fileNames[UPLOAD_IDS.proofOfAddress1]} error={errors[UPLOAD_IDS.proofOfAddress1]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
          <UploadSlot id={UPLOAD_IDS.proofOfAddress2} label={LABELS.proofOfAddress2} hasValue={!!data[UPLOAD_IDS.proofOfAddress2]} fileName={fileNames[UPLOAD_IDS.proofOfAddress2]} error={errors[UPLOAD_IDS.proofOfAddress2]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
          <UploadSlot id={UPLOAD_IDS.selfieWithId} label={LABELS.selfieWithId} hasValue={!!data[UPLOAD_IDS.selfieWithId]} fileName={fileNames[UPLOAD_IDS.selfieWithId]} error={errors[UPLOAD_IDS.selfieWithId]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
        </div>
      </div>

      {/* Camera modal: loading, error, live preview + capture, or captured preview + confirm/retake */}
      {cameraOpen && cameraKey && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="camera-modal-title"
          onClick={closeCamera}
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between border-b border-gray-200">
              <h2 id="camera-modal-title" className="text-lg font-semibold text-gray-800">
                {LABELS[cameraKey]}
              </h2>
              <button
                type="button"
                onClick={closeCamera}
                className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Close camera"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {cameraError ? (
                <div className="py-8 text-center">
                  <p className="text-red-600 mb-4">{cameraError}</p>
                  <p className="text-sm text-gray-500 mb-4">You can use &quot;Upload&quot; to choose a file from your device instead.</p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={requestCameraAgain}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : showPreview ? (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3] max-h-[50vh]">
                    <img
                      src={capturedPreviewUrl}
                      alt="Captured"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Use this photo or retake.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={retakePhoto}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={confirmUsePhoto}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center gap-2"
                    >
                      <FileCheck size={20} />
                      Use this
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3] max-h-[50vh]">
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
                        <span className="flex items-center gap-2">
                          <Loader2 size={24} className="animate-spin" aria-hidden />
                          Loading camera…
                        </span>
                      </div>
                    )}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                      style={{ visibility: loading ? 'hidden' : 'visible' }}
                    />
                  </div>
                  {devices.length > 1 && !loading && (
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Camera</label>
                      <select
                        value={selectedDeviceId || ''}
                        onChange={(e) => switchCamera(e.target.value || null)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="Switch camera"
                      >
                        <option value="">Default (auto)</option>
                        {devices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Position the document or yourself in frame, then click Capture.
                  </p>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Camera size={20} />
                      Capture photo
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
