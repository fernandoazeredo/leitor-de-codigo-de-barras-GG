import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export function Scanner({ onCode }:{ onCode:(code:string)=>void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void }>();
  const [erro, setErro] = useState('');

  function desligarCamera() {
    try { controlsRef.current?.stop(); } catch { /* noop */ }
    controlsRef.current = undefined;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function fecharCamera() {
    desligarCamera();
    onCode('');
  }

  useEffect(() => {
    let encerrado = false;
    const reader = new BrowserMultiFormatReader();

    (async () => {
      try {
        controlsRef.current = await reader.decodeFromConstraints(
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
      onClick={fecharCamera}
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
