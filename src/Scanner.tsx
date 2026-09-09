import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

type ScannerProps = {
  onCode: (code: string) => void;
  onClose: () => void;
};

export function Scanner({ onCode, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let controls: { stop: () => void } | undefined;
    let encerrado = false;
    const reader = new BrowserMultiFormatReader();

    const desligarCamera = () => {
      try { controls?.stop(); } catch { /* noop */ }
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    (async () => {
      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current!,
          result => {
            if (result && !encerrado) {
              encerrado = true;
              desligarCamera();
              onCode(result.getText());
            }
          }
        );
      } catch {
        if (!encerrado) setErro('Não foi possível abrir a câmera. Verifique a permissão do navegador.');
      }
    })();

    return () => {
      encerrado = true;
      desligarCamera();
    };
  }, [onCode]);

  return <div className="scanner" style={{ position: 'relative' }}>
    <button
      type="button"
      onClick={onClose}
      aria-label="Fechar câmera"
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 2,
        background: '#fff',
        color: '#183629',
        border: '1px solid #d7e1db',
        boxShadow: '0 2px 8px #0003'
      }}
    >✕ Fechar câmera</button>
    <video ref={videoRef} muted playsInline />
    {erro && <p className="error">{erro}</p>}
  </div>;
}
