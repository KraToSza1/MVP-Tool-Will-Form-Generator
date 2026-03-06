/**
 * #8 Identity Verification - post-completion upload section
 * Photo ID, two proofs of address, selfie holding ID.
 * Take photo: opens device camera (phone or desktop) and captures image.
 * Upload: opens file picker for PDF/images.
 *
 * STORAGE:
 * - Files stored as base64 data URLs in formValues.identityVerification
 * - Persisted with form draft in localStorage (willForm key).
 */
import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileCheck, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

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
const MAX_CAPTURE_WIDTH = 1920;

function UploadSlot({ id, label, hasValue, error, onTakePhoto, onUpload }) {
  return (
    <div className="upload-slot border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onTakePhoto(id)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg cursor-pointer hover:bg-indigo-200 text-sm font-medium transition-colors"
        >
          <Camera size={18} />
          <span>Take photo</span>
        </button>
        <button
          type="button"
          onClick={() => onUpload(id)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg cursor-pointer hover:bg-gray-200 text-sm font-medium transition-colors"
        >
          <Upload size={18} />
          <span>Upload</span>
        </button>
        {hasValue && (
          <span className="flex items-center gap-1 text-green-600 text-sm">
            <FileCheck size={16} />
            Uploaded
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

export default function IdentityVerification({ formValues, setFormValues }) {
  const data = formValues.identityVerification || {};
  const [errors, setErrors] = useState({});
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraKey, setCameraKey] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const validateFileSize = (file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      return `File size (${sizeMB}MB) exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB per file. Please choose a smaller file.`;
    }
    return null;
  };

  const setValueFromBlob = (key, blob) => {
    const sizeError = blob.size > MAX_FILE_SIZE_BYTES
      ? `Photo is too large (${(blob.size / (1024 * 1024)).toFixed(2)}MB). Max ${MAX_FILE_SIZE_MB}MB.`
      : null;
    if (sizeError) {
      setErrors(prev => ({ ...prev, [key]: sizeError }));
      toast.error('Photo too large', { description: sizeError });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormValues(prev => ({
        ...prev,
        identityVerification: {
          ...(prev.identityVerification || {}),
          [key]: reader.result,
        },
      }));
      setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
      toast.success('Photo captured', { description: `${LABELS[key]} has been saved.` });
    };
    reader.onerror = () => toast.error('Failed to save photo.');
    reader.readAsDataURL(blob);
  };

  const handleFile = (key, file) => {
    if (!file) return;
    const sizeError = validateFileSize(file);
    if (sizeError) {
      setErrors(prev => ({ ...prev, [key]: sizeError }));
      toast.error('File too large', { description: sizeError });
      return;
    }
    setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
    const reader = new FileReader();
    reader.onload = () => {
      setFormValues(prev => ({
        ...prev,
        identityVerification: {
          ...(prev.identityVerification || {}),
          [key]: reader.result,
        },
      }));
      toast.success('File uploaded', { description: `${LABELS[key]} has been uploaded successfully.` });
    };
    reader.onerror = () => toast.error('Upload failed', { description: 'There was an error reading the file. Please try again.' });
    reader.readAsDataURL(file);
  };

  const openCamera = (key) => {
    setCameraKey(key);
    setCameraError(null);
    setCameraOpen(true);
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraKey(null);
    setCameraError(null);
  };

  useEffect(() => {
    if (!cameraOpen || !cameraKey || !videoRef.current) return;
    const video = videoRef.current;
    const constraints = {
      video: {
        facingMode: cameraKey === UPLOAD_IDS.selfieWithId ? 'user' : 'environment',
        width: { ideal: Math.min(1920, window.innerWidth) },
        height: { ideal: Math.min(1080, window.innerHeight) },
      },
      audio: false,
    };
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        streamRef.current = stream;
        video.srcObject = stream;
        video.play().catch(() => {});
      })
      .catch((err) => {
        const msg = err.name === 'NotAllowedError'
          ? 'Camera access was denied. Please allow camera in your browser settings.'
          : err.name === 'NotFoundError'
            ? 'No camera found on this device.'
            : 'Could not start camera. Please check permissions or try again.';
        setCameraError(msg);
        toast.error('Camera error', { description: msg });
      });
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOpen, cameraKey]);

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
          setValueFromBlob(cameraKey, blob);
          closeCamera();
        } else {
          toast.error('Capture failed', { description: 'Could not create image.' });
        }
      },
      'image/jpeg',
      CAPTURE_JPEG_QUALITY
    );
  };

  const handleTakePhoto = (key) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Camera not supported', { description: 'Use "Upload" to choose a file instead, or use a device with a camera.' });
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

  return (
    <>
      <div className="id-verification-block mt-8 border-t-2 border-amber-300 pt-8 bg-amber-50/50 -mx-4 px-4 py-4 rounded-xl">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Verification stage — before solicitor meeting</p>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">Identity verification</h3>
        <p className="text-sm text-gray-600 mb-4">
          Take a photo with your phone or computer camera, or upload a file. Maximum {MAX_FILE_SIZE_MB}MB per file.
        </p>
        <div className="space-y-4">
          <UploadSlot id={UPLOAD_IDS.photoId} label={LABELS.photoId} hasValue={!!data[UPLOAD_IDS.photoId]} error={errors[UPLOAD_IDS.photoId]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
          <UploadSlot id={UPLOAD_IDS.proofOfAddress1} label={LABELS.proofOfAddress1} hasValue={!!data[UPLOAD_IDS.proofOfAddress1]} error={errors[UPLOAD_IDS.proofOfAddress1]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
          <UploadSlot id={UPLOAD_IDS.proofOfAddress2} label={LABELS.proofOfAddress2} hasValue={!!data[UPLOAD_IDS.proofOfAddress2]} error={errors[UPLOAD_IDS.proofOfAddress2]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
          <UploadSlot id={UPLOAD_IDS.selfieWithId} label={LABELS.selfieWithId} hasValue={!!data[UPLOAD_IDS.selfieWithId]} error={errors[UPLOAD_IDS.selfieWithId]} onTakePhoto={handleTakePhoto} onUpload={handleUpload} />
        </div>
      </div>

      {/* Camera modal: live preview and capture */}
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
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden aspect-[4/3] max-h-[50vh]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-contain"
                    />
                  </div>
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
                      className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-center gap-2"
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
