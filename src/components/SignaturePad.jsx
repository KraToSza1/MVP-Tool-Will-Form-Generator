/**
 * Signature pad using signature_pad directly for reliable cross-device support
 * (desktop, tablet, mobile with touch).
 * Replaces react-signature-canvas for better touch handling and fewer quirks.
 */
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { default as SignaturePadLib } from 'signature_pad';

const SignaturePadComponent = forwardRef(function SignaturePadComponent({
  fieldId,
  width = 400,
  height = 120,
  existingSignature,
  onSignatureEnd,
  onClear,
  penColor = 'black',
  className = '',
  style = {},
}, ref) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);

  // Initialize signature_pad when canvas is ready
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const pad = new SignaturePadLib(canvas, {
      penColor,
      backgroundColor: 'rgb(255, 255, 255)',
      minWidth: 1,
      maxWidth: 2.5,
      throttle: 16,
    });

    padRef.current = pad;

    return () => {
      pad.off();
      padRef.current = null;
    };
  }, [fieldId, width, height, penColor]);

  // Load existing signature
  useEffect(() => {
    const pad = padRef.current;
    if (!pad || !existingSignature || !existingSignature.startsWith('data:image')) return;

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;
        let drawWidth, drawHeight, drawX, drawY;
        if (imgAspect > canvasAspect) {
          drawWidth = width;
          drawHeight = width / imgAspect;
          drawX = 0;
          drawY = (height - drawHeight) / 2;
        } else {
          drawHeight = height;
          drawWidth = height * imgAspect;
          drawX = (width - drawWidth) / 2;
          drawY = 0;
        }
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      } catch {
        // Ignore draw errors
      }
    };
    img.src = existingSignature;
  }, [existingSignature, width, height]);

  const handleEnd = useCallback(() => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;

    try {
      const dataUrl = pad.toDataURL('image/png');
      if (dataUrl && dataUrl.startsWith('data:image')) {
        onSignatureEnd?.(dataUrl);
      }
    } catch {
      // Ignore
    }
  }, [onSignatureEnd]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.addEventListener('endStroke', handleEnd);
    return () => pad.removeEventListener('endStroke', handleEnd);
  }, [handleEnd]);

  const clear = useCallback(() => {
    const pad = padRef.current;
    if (pad) {
      pad.clear();
      onClear?.();
    }
  }, [onClear]);

  useImperativeHandle(ref, () => ({ clear }), [clear]);

  return (
    <div className={className} style={style}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          maxWidth: '100%',
          touchAction: 'none',
          msTouchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        tabIndex={-1}
        aria-label="Signature pad - draw with finger or mouse"
      />
    </div>
  );
});

export default SignaturePadComponent;
