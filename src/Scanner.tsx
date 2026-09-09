import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

export function Scanner({ onCode }:{ onCode:(code:string)=>void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let controls: { stop:()=>void } | undefined;
    const reader = new BrowserMultiFormatReader();
    (async () => {
      try {
        controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } } }, videoRef.current!, (result) => {
          if (result) { onCode(result.getText()); controls?.stop(); }
        });
      } catch { setErro('Não foi possível abrir a câmera. Verifique a permissão do navegador.'); }
    })();
    return () => controls?.stop();
  }, [onCode]);
  return <div className="scanner"><video ref={videoRef} muted playsInline />{erro && <p className="error">{erro}</p>}</div>;
}
