/**
 * #8 Identity Verification — cross-device uploads + optional in-browser selfie camera
 *
 * | Device / context        | ID & proof docs      | Selfie                          |
 * |-------------------------|----------------------|----------------------------------|
 * | Phone (touch-primary)   | Upload file → OS picker (camera/gallery/files) | Same + native “take photo” in picker |
 * | Tablet / desktop / laptop (wide ≥769px OR mouse/trackpad) | Choose a file      | Choose a file + Take a picture (webcam) |
 *
 * Webcam path: Chrome, Safari, Edge, Firefox, Samsung Internet — same getUserMedia
 * fallbacks (minimal constraints → any camera). HTTPS + iframe allow="camera" when embedded.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileCheck, AlertCircle, Camera, X, Loader2 } from 'lucide-react';
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

const UPLOAD_HINT_MOBILE = 'Upload from photo library, choose a file, or take a picture.';
const UPLOAD_HINT_WEB =
  'On a computer or tablet with a mouse or trackpad, you can Choose a file or use Take a picture (webcam) for your selfie.';

function computeUploadLayout() {
  if (typeof window === 'undefined') {
    return { phoneStyle: true, showWebcamSelfie: false };
  }
  const wide = window.matchMedia('(min-width: 769px)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  /** Wide screen OR mouse/trackpad → show file picker + in-browser webcam for selfie (Windows/Mac/Linux tablets too). */
  const showWebcamSelfie = wide || finePointer;
  const phoneStyle = !showWebcamSelfie;
  return { phoneStyle, showWebcamSelfie };
}

function useUploadLayout() {
  const [layout, setLayout] = useState(computeUploadLayout);
  useEffect(() => {
    const update = () => setLayout(computeUploadLayout());
    const mqW = window.matchMedia('(min-width: 769px)');
    const mqP = window.matchMedia('(pointer: fine)');
    mqW.addEventListener('change', update);
    mqP.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mqW.removeEventListener('change', update);
      mqP.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return layout;
}

function UploadSlot({ id, label, hasValue, fileName, error, onUpload, buttonLabel = 'Upload file' }) {
  const confirmationText = hasValue
    ? (fileName ? `${fileName} — Uploaded` : 'Uploaded')
    : null;
  return (
    <div className="upload-slot rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner dark:border-slate-600 dark:bg-slate-800/90">
      <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onUpload(id)}
          className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <Upload size={18} />
          <span>{buttonLabel}</span>
        </button>
        {hasValue && (
          <span
            className="flex min-h-[44px] items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            role="status"
          >
            <FileCheck size={16} className="shrink-0" aria-hidden />
            {confirmationText}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 flex min-h-0 items-center gap-1 break-words text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Maximum file size: {MAX_FILE_SIZE_MB}MB per file</p>
    </div>
  );
}

/** Web selfie: Choose a file + Take a picture */
function SelfieSlotWeb({ id, label, hasValue, fileName, error, onChooseFile, onTakePicture }) {
  const confirmationText = hasValue
    ? (fileName ? `${fileName} — Uploaded` : 'Uploaded')
    : null;
  return (
    <div className="upload-slot rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-inner dark:border-slate-600 dark:bg-slate-800/90">
      <label className="mb-2 block text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
      <p className="mb-3 break-words text-xs text-slate-600 dark:text-slate-400">
        Take a picture uses your device camera in the browser (Chrome, Safari, Edge, Firefox). Or choose an existing photo
        from your device.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChooseFile(id)}
          className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <Upload size={18} />
          <span>Choose a file</span>
        </button>
        <button
          type="button"
          onClick={() => onTakePicture(id)}
          className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-violet-400/80 bg-violet-100/90 px-4 py-2 text-sm font-medium text-violet-900 transition-colors hover:border-violet-500 hover:bg-violet-200/90 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-violet-500/60 dark:bg-violet-950/80 dark:text-violet-100 dark:hover:border-violet-400 dark:hover:bg-violet-900/90"
        >
          <Camera size={18} />
          <span>Take a picture</span>
        </button>
        {hasValue && (
          <span
            className="flex min-h-[44px] items-center gap-1 text-sm font-medium text-emerald-700 dark:text-emerald-400"
            role="status"
          >
            <FileCheck size={16} className="shrink-0" aria-hidden />
            {confirmationText}
          </span>
        )}
      </div>
      {error && (
        <p className="mt-2 flex min-h-0 items-center gap-1 break-words text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Maximum file size: {MAX_FILE_SIZE_MB}MB per file</p>
    </div>
  );
}

function isWebcamSupported() {
  if (typeof window === 'undefined') return false;
  if (!window.isSecureContext) return false;
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Progressive constraints: strict specs break on Safari, some Android, and older Edge.
 * Order works across Chrome / Safari / Firefox / Edge / Samsung Internet.
 */
async function getSelfieStream(deviceId = null) {
  const gUM = (constraints) => navigator.mediaDevices.getUserMedia({ ...constraints, audio: false });

  if (deviceId) {
    const withId = [
      { video: { deviceId: { exact: deviceId } } },
      { video: true },
    ];
    let lastErr;
    for (const c of withId) {
      try {
        return await gUM(c);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  const attempts = [
    { video: { facingMode: { ideal: 'user' } } },
    { video: { facingMode: 'user' } },
    { video: { facingMode: { ideal: 'environment' } } },
    { video: true },
  ];
  let lastErr;
  for (const c of attempts) {
    try {
      return await gUM(c);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Required for autoplay on iOS, Safari, and many Android WebViews; harmless on desktop Chrome/Edge/Firefox. */
function configureVideoForLiveCapture(video) {
  if (!video) return;
  video.muted = true;
  video.defaultMuted = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', 'true');
  video.playsInline = true;
}

async function playVideoWithRetries(video) {
  configureVideoForLiveCapture(video);
  const delays = [0, 200, 450];
  for (const ms of delays) {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    try {
      await video.play();
      return;
    } catch {
      /* next retry */
    }
  }
}

/** Modal mounts after getUserMedia — wait until <video> exists (all browsers). */
function waitForVideoRef(videoRef, maxFrames = 150) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const step = () => {
      const el = videoRef.current;
      if (el) return resolve(el);
      if (++n >= maxFrames) {
        return reject(new Error('Video element not ready'));
      }
      requestAnimationFrame(step);
    };
    step();
  });
}

export default function IdentityVerification({ formValues, setFormValues, submittedMatterId = null }) {
  const data = formValues.identityVerification || {};
  const fileNames = formValues.identityVerificationFileNames || {};
  const isPostSubmission = Boolean(submittedMatterId);
  const { phoneStyle, showWebcamSelfie } = useUploadLayout();
  const [errors, setErrors] = useState({});

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
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

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCapturedBlob(null);
    setCameraOpen(false);
    setCameraError(null);
    setDevices([]);
    setSelectedDeviceId(null);
  }, []);

  const openSelfieCamera = () => {
    if (!isWebcamSupported()) {
      toast.error('Webcam not available', {
        description: 'Camera needs HTTPS. Use Choose a file to upload a photo instead. If the form is embedded, the page may need allow="camera" on the iframe.',
      });
      return;
    }
    setCameraError(null);
    setPreviewUrl(null);
    setCapturedBlob(null);
    setSelectedDeviceId(null);
    setLoading(true);
    setCameraOpen(true);
  };

  useEffect(() => {
    if (!cameraOpen) return;
    let aborted = false;

    const failAttach = (stream) => {
      stream.getTracks().forEach((t) => t.stop());
      if (!aborted) {
        setCameraError('Could not show camera preview. Close and try Take a picture again, or use Choose a file.');
        setLoading(false);
      }
    };

    getSelfieStream(selectedDeviceId || undefined)
      .then(async (stream) => {
        if (aborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        let video;
        try {
          video = await waitForVideoRef(videoRef, 120);
        } catch {
          failAttach(stream);
          return;
        }
        if (aborted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        await playVideoWithRetries(video);
        const markReady = () => {
          if (!aborted) setLoading(false);
        };
        const t = window.setTimeout(markReady, 8000);
        const done = () => {
          window.clearTimeout(t);
          markReady();
        };
        if (video.readyState >= 2) {
          done();
        } else {
          video.addEventListener('loadeddata', done, { once: true });
          video.addEventListener('playing', done, { once: true });
        }
      })
      .catch((err) => {
        if (aborted) return;
        const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|Edg/i.test(navigator.userAgent);
        const browserHint = isSafari
          ? ' Safari: address bar → camera icon, or Settings for This Website → Camera → Allow.'
          : ' Allow camera in your browser’s site settings (lock icon in the address bar).';
        const msg = err?.name === 'NotAllowedError'
          ? `Camera access was denied.${browserHint} Or use Choose a file. Embedded sites need allow="camera" on the iframe.`
          : err?.name === 'NotFoundError'
            ? 'No camera found. Windows: Settings → Privacy → Camera. Mac: System Settings → Privacy → Camera. Or use Choose a file.'
            : err?.name === 'OverconstrainedError'
              ? 'Could not use that camera. Try another from the list or use Choose a file.'
              : err?.message === 'Video element not ready'
                ? 'Preview did not load in time. Try again or use Choose a file.'
                : `Could not start camera. Try Choose a file.${isSafari ? ` ${browserHint}` : ''}`;
        setCameraError(msg);
        setLoading(false);
      });

    return () => {
      aborted = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOpen, cameraRetry, selectedDeviceId]);

  /** After retake, <video> remounts — re-attach stream (React unmount; all browsers). */
  useEffect(() => {
    if (!cameraOpen || (previewUrl && capturedBlob) || !streamRef.current) return;
    const v = videoRef.current;
    const stream = streamRef.current;
    if (!v || v.srcObject === stream) return;
    v.srcObject = stream;
    void playVideoWithRetries(v);
  }, [cameraOpen, previewUrl, capturedBlob]);

  useEffect(() => {
    if (!cameraOpen || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices()
      .then((all) => setDevices(all.filter(d => d.kind === 'videoinput')))
      .catch(() => setDevices([]));
  }, [cameraOpen, cameraRetry]);

  const switchCamera = (deviceId) => {
    setSelectedDeviceId(deviceId || null);
    setLoading(true);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (!w || !h) {
      toast.info('Wait for preview', { description: 'Give the camera a moment, then tap Capture again.' });
      return;
    }
    const scale = Math.min(1, MAX_CAPTURE_WIDTH / w);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h, 0, 0, cw, ch);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setCapturedBlob(blob);
        } else {
          toast.error('Capture failed');
        }
      },
      'image/jpeg',
      CAPTURE_JPEG_QUALITY
    );
  };

  const confirmSelfie = () => {
    if (!capturedBlob) return;
    const reader = new FileReader();
    reader.onload = () => {
      void persistDataUrl(
        UPLOAD_IDS.selfieWithId,
        reader.result,
        'Selfie saved',
        'Your selfie has been saved.',
        'Webcam selfie'
      );
      closeCamera();
    };
    reader.onerror = () => toast.error('Could not save photo.');
    reader.readAsDataURL(capturedBlob);
  };

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCapturedBlob(null);
  };

  const uploadHint = phoneStyle ? UPLOAD_HINT_MOBILE : UPLOAD_HINT_WEB;

  const showPreview = Boolean(previewUrl && capturedBlob);

  return (
    <div
      id="identity-verification-section"
      className="id-verification-block -mx-4 mt-8 min-w-0 scroll-mt-24 rounded-xl border border-slate-200 border-t-2 border-t-amber-500 bg-white px-4 py-6 pt-8 shadow-lg dark:border-slate-600 dark:border-t-amber-400/80 dark:bg-slate-900/95"
    >
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300/90">
        {isPostSubmission ? 'Next step — submit ID for review' : 'Verification stage — before solicitor meeting'}
      </p>
      <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
        {isPostSubmission ? 'Submit identification' : 'Identity verification'}
      </h3>
      <p className="mb-2 min-w-0 break-words text-sm text-slate-600 dark:text-slate-300">
        {isPostSubmission
          ? `Your questionnaire has already been submitted. Upload your documents here, then click Update submission below to attach them to the same matter. Maximum ${MAX_FILE_SIZE_MB}MB per file.`
          : `Upload your documents below. Maximum ${MAX_FILE_SIZE_MB}MB per file.`}
      </p>
      <p className="mb-4 min-w-0 break-words text-sm text-slate-500 dark:text-slate-400">{uploadHint}</p>
      <div className="space-y-4">
        <UploadSlot
          id={UPLOAD_IDS.photoId}
          label={LABELS.photoId}
          hasValue={!!data[UPLOAD_IDS.photoId]}
          fileName={fileNames[UPLOAD_IDS.photoId]}
          error={errors[UPLOAD_IDS.photoId]}
          onUpload={handleUpload}
          buttonLabel={phoneStyle ? 'Upload file' : 'Choose a file'}
        />
        <UploadSlot
          id={UPLOAD_IDS.proofOfAddress1}
          label={LABELS.proofOfAddress1}
          hasValue={!!data[UPLOAD_IDS.proofOfAddress1]}
          fileName={fileNames[UPLOAD_IDS.proofOfAddress1]}
          error={errors[UPLOAD_IDS.proofOfAddress1]}
          onUpload={handleUpload}
          buttonLabel={phoneStyle ? 'Upload file' : 'Choose a file'}
        />
        <UploadSlot
          id={UPLOAD_IDS.proofOfAddress2}
          label={LABELS.proofOfAddress2}
          hasValue={!!data[UPLOAD_IDS.proofOfAddress2]}
          fileName={fileNames[UPLOAD_IDS.proofOfAddress2]}
          error={errors[UPLOAD_IDS.proofOfAddress2]}
          onUpload={handleUpload}
          buttonLabel={phoneStyle ? 'Upload file' : 'Choose a file'}
        />
        {!showWebcamSelfie ? (
          <UploadSlot
            id={UPLOAD_IDS.selfieWithId}
            label={LABELS.selfieWithId}
            hasValue={!!data[UPLOAD_IDS.selfieWithId]}
            fileName={fileNames[UPLOAD_IDS.selfieWithId]}
            error={errors[UPLOAD_IDS.selfieWithId]}
            onUpload={handleUpload}
          />
        ) : (
          <SelfieSlotWeb
            id={UPLOAD_IDS.selfieWithId}
            label={LABELS.selfieWithId}
            hasValue={!!data[UPLOAD_IDS.selfieWithId]}
            fileName={fileNames[UPLOAD_IDS.selfieWithId]}
            error={errors[UPLOAD_IDS.selfieWithId]}
            onChooseFile={handleUpload}
            onTakePicture={openSelfieCamera}
          />
        )}
      </div>

      {cameraOpen && (
        <div
          className="fixed inset-0 z-[10000] flex min-w-0 items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="selfie-camera-title"
          onClick={closeCamera}
        >
          <div
            className="max-h-[90vh] w-full min-w-0 max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center justify-between border-b border-slate-200 p-4 dark:border-slate-600">
              <h2 id="selfie-camera-title" className="min-w-0 text-lg font-semibold text-slate-900 dark:text-slate-100">
                Take your selfie
              </h2>
              <button
                type="button"
                onClick={closeCamera}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              {cameraError ? (
                <div className="py-6 text-center">
                  <p className="mb-4 min-w-0 break-words text-sm text-red-600 dark:text-red-400">{cameraError}</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        setLoading(true);
                        setCameraRetry((c) => c + 1);
                      }}
                      className="min-h-[44px] rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : showPreview ? (
                <>
                  <div className="relative aspect-[4/3] max-h-[50vh] overflow-hidden rounded-lg bg-black">
                    <img src={previewUrl} alt="Your selfie" className="h-full w-full object-contain" />
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Use this photo or retake.</p>
                  <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={retake}
                      className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      Retake
                    </button>
                    <button
                      type="button"
                      onClick={confirmSelfie}
                      className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <FileCheck size={20} className="shrink-0" />
                      <span className="min-w-0 break-words">Use this photo</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative aspect-[4/3] max-h-[50vh] overflow-hidden rounded-lg bg-black">
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white">
                        <span className="flex items-center gap-2">
                          <Loader2 size={22} className="animate-spin" aria-hidden />
                          Loading camera…
                        </span>
                      </div>
                    )}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-contain"
                      style={{ visibility: loading ? 'hidden' : 'visible' }}
                    />
                  </div>
                  {devices.length > 1 && !loading && (
                    <div className="mt-2 min-w-0">
                      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Camera</label>
                      <select
                        value={selectedDeviceId || ''}
                        onChange={(e) => switchCamera(e.target.value || null)}
                        className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        aria-label="Switch camera"
                      >
                        <option value="">Default (usually front / built-in)</option>
                        {devices.map((d) => (
                          <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">Hold your ID as required, then capture.</p>
                  <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={closeCamera}
                      className="min-h-[44px] flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      disabled={loading}
                      className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <Camera size={20} className="shrink-0" />
                      <span>Capture</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
