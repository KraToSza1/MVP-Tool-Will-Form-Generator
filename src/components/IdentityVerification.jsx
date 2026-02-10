/**
 * #8 Identity Verification - post-completion upload section
 * Photo ID, two proofs of address, selfie holding ID.
 * Supports: upload from device, camera capture on mobile (capture attribute).
 *
 * STORAGE:
 * - Files stored as base64 data URLs in formValues.identityVerification:
 *   { photoId, proofOfAddress1, proofOfAddress2, selfieWithId }
 * - Persisted with form draft in localStorage (willForm key).
 * - Linked to submission: when form is submitted/saved, identityVerification
 *   is included in formValues; backend would receive it with the rest of the payload.
 */
import React from 'react';
import { Camera, FileCheck } from 'lucide-react';

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

export default function IdentityVerification({ formValues, setFormValues }) {
  const data = formValues.identityVerification || {};

  const handleFile = (key, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormValues(prev => ({
        ...prev,
        identityVerification: {
          ...(prev.identityVerification || {}),
          [key]: reader.result,
        },
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const UploadSlot = ({ id, label }) => (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFile(id, e)}
          className="sr-only"
          id={id}
        />
        <label
          htmlFor={id}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg cursor-pointer hover:bg-indigo-200 text-sm font-medium"
        >
          <Camera size={18} />
          <span>Take photo or upload</span>
        </label>
        {data[id] && (
          <span className="flex items-center gap-1 text-green-600 text-sm">
            <FileCheck size={16} />
            Uploaded
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">Use camera on mobile or choose file from device</p>
    </div>
  );

  return (
    <div className="mt-8 border-t-2 border-amber-300 pt-8 bg-amber-50/50 -mx-4 px-4 py-4 rounded-xl">
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Verification stage — before solicitor meeting</p>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Identity verification</h3>
      <p className="text-sm text-gray-600 mb-4">
        Please upload the following. On mobile, you can take a photo directly. On desktop, choose a file.
      </p>
      <div className="space-y-4">
        <UploadSlot id={UPLOAD_IDS.photoId} label={LABELS.photoId} />
        <UploadSlot id={UPLOAD_IDS.proofOfAddress1} label={LABELS.proofOfAddress1} />
        <UploadSlot id={UPLOAD_IDS.proofOfAddress2} label={LABELS.proofOfAddress2} />
        <UploadSlot id={UPLOAD_IDS.selfieWithId} label={LABELS.selfieWithId} />
      </div>
    </div>
  );
}
