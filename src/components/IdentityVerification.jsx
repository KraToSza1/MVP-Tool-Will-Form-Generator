/**
 * #8 Identity Verification - post-completion upload section
 * Photo ID, two proofs of address, selfie holding ID.
 * Single "Upload file" button per slot: opens file picker (on mobile, picker can offer
 * photo library, file browser, or take a picture).
 *
 * STORAGE:
 * - Files stored as base64 data URLs in formValues.identityVerification
 * - File names in formValues.identityVerificationFileNames for display
 * - Persisted with form draft in localStorage (willForm key).
 */
import React, { useState, useEffect } from 'react';
import { Upload, FileCheck, AlertCircle } from 'lucide-react';
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

const UPLOAD_HINT_MOBILE = 'Upload from photo library, choose a file, or take a picture.';
const UPLOAD_HINT_WEB = 'Upload a file or take a picture.';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = () => setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function UploadSlot({ id, label, hasValue, fileName, error, onUpload }) {
  const confirmationText = hasValue
    ? (fileName ? `${fileName} — Uploaded` : 'Uploaded')
    : null;
  return (
    <div className="upload-slot border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onUpload(id)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg cursor-pointer hover:bg-indigo-700 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Upload size={18} />
          <span>Upload file</span>
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

export default function IdentityVerification({ formValues, setFormValues, submittedMatterId = null }) {
  const data = formValues.identityVerification || {};
  const fileNames = formValues.identityVerificationFileNames || {};
  const isPostSubmission = Boolean(submittedMatterId);
  const isMobile = useIsMobile();
  const [errors, setErrors] = useState({});

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

  const uploadHint = isMobile ? UPLOAD_HINT_MOBILE : UPLOAD_HINT_WEB;

  return (
    <div id="identity-verification-section" className="id-verification-block mt-8 scroll-mt-24 border-t-2 border-amber-300 pt-8 bg-amber-50/50 -mx-4 px-4 py-4 rounded-xl">
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">
        {isPostSubmission ? 'Next step — submit ID for review' : 'Verification stage — before solicitor meeting'}
      </p>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">
        {isPostSubmission ? 'Submit identification' : 'Identity verification'}
      </h3>
      <p className="text-sm text-gray-600 mb-2">
        {isPostSubmission
          ? `Your questionnaire has already been submitted. Upload your documents here, then click Update submission below to attach them to the same matter. Maximum ${MAX_FILE_SIZE_MB}MB per file.`
          : `Upload your documents below. Maximum ${MAX_FILE_SIZE_MB}MB per file.`}
      </p>
      <p className="text-sm text-gray-600 mb-4">{uploadHint}</p>
      <div className="space-y-4">
        <UploadSlot id={UPLOAD_IDS.photoId} label={LABELS.photoId} hasValue={!!data[UPLOAD_IDS.photoId]} fileName={fileNames[UPLOAD_IDS.photoId]} error={errors[UPLOAD_IDS.photoId]} onUpload={handleUpload} />
        <UploadSlot id={UPLOAD_IDS.proofOfAddress1} label={LABELS.proofOfAddress1} hasValue={!!data[UPLOAD_IDS.proofOfAddress1]} fileName={fileNames[UPLOAD_IDS.proofOfAddress1]} error={errors[UPLOAD_IDS.proofOfAddress1]} onUpload={handleUpload} />
        <UploadSlot id={UPLOAD_IDS.proofOfAddress2} label={LABELS.proofOfAddress2} hasValue={!!data[UPLOAD_IDS.proofOfAddress2]} fileName={fileNames[UPLOAD_IDS.proofOfAddress2]} error={errors[UPLOAD_IDS.proofOfAddress2]} onUpload={handleUpload} />
        <UploadSlot id={UPLOAD_IDS.selfieWithId} label={LABELS.selfieWithId} hasValue={!!data[UPLOAD_IDS.selfieWithId]} fileName={fileNames[UPLOAD_IDS.selfieWithId]} error={errors[UPLOAD_IDS.selfieWithId]} onUpload={handleUpload} />
      </div>
    </div>
  );
}
