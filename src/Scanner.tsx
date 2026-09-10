import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';

type ScannerControls = { stop: () => void };
type ExtendedCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
  focusMode?: string[];
};

export function Scanner({ onCode }:{ onCode:(code:string)=>void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls>();
  const trackRef = useRef<MediaStreamTrack>();
  const [erro, setErro] = useState('');
  const [torchDisponivel, setTorchDisponivel] = useState(false);
  const [torchAtiva, setTorchAtiva] = useState(false);
  const [zoomDisponivel, setZoomDisponivel] = useState(false);
  const [zoomMin, setZoomMin] = useState(1);
  const [zoomMax, setZoomMax] = useState(1);
  const [zoom, setZoom] = useState(1);

  function desligarCamera() {
    try { controlsRef.current?.stop(); } catch { /* noop */ }
    controlsRef.current = undefined;
    trackRef.current = undefined;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function fecharCamera() {
    desligarCamera();
  }

  async function alternarLanterna() {
    const track = trackRef.current;
    if (!track) return;
    try {
      const proximo = !torchAtiva;
      await track.applyConstraints({ advanced: [{ torch: proximo } as MediaTrackConstraintSet] });
      setTorchAtiva(proximo);
    } catch {
      setErro('A lanterna não pôde ser acionada neste aparelho.');
    }
  }

  async function alterarZoom(valor:number) {
    const track = trackRef.current;
    if (!track) return;
    setZoom(valor);
    try {
      await track.applyConstraints({ advanced: [{ zoom: valor } as MediaTrackConstraintSet] });
    } catch {
      /* Alguns navegadores informam zoom, mas não permitem alteração programática. */
    }
  }

  useEffect(() => {
    let encerrado = false;

    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DecodeHintType.TRY_HARDER, true);
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.RSS_14,
      BarcodeFormat.RSS_EXPANDED
    ]);

    const reader = new BrowserMultiFormatReader(hints, {
      delayBetweenScanAttempts: 70,
      delayBetweenScanSuccess: 300
    });

    (async () => {
      try {
        setErro('');
        controlsRef.current = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              frameRate: { ideal: 30 }
            }
          },
          videoRef.current!,
          result => {
            if (result && !encerrado) {
              const texto = result.getText()?.trim();
              if (!texto) return;
              encerrado = true;
              desligarCamera();
              onCode(texto);
            }
          }
        );

        const stream = videoRef.current?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks()[0];
        if (!track) return;
        trackRef.current = track;

        const caps = track.getCapabilities?.() as ExtendedCapabilities | undefined;
        if (!caps) return;

        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          try {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
          } catch { /* foco automático opcional */ }
        }

        if (caps.torch) setTorchDisponivel(true);

        if (caps.zoom && Number.isFinite(caps.zoom.min) && Number.isFinite(caps.zoom.max) && caps.zoom.max > caps.zoom.min) {
          const inicial = Math.min(Math.max(1.5, caps.zoom.min), caps.zoom.max);
          setZoomMin(caps.zoom.min);
          setZoomMax(caps.zoom.max);
          setZoom(inicial);
          setZoomDisponivel(true);
          try {
            await track.applyConstraints({ advanced: [{ zoom: inicial } as MediaTrackConstraintSet] });
          } catch { /* zoom inicial opcional */ }
        }
      } catch {
        if (!encerrado) setErro('Não foi possível abrir a câmera. Verifique a permissão do navegador e tente novamente.');
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
        zIndex: 4,
        background: '#fff',
        color: '#183629',
        border: '1px solid #d7e1db',
        boxShadow: '0 2px 8px #0003'
      }}
    >✕ Fechar câmera</button>

    <div style={{ position:'relative', overflow:'hidden', borderRadius:14 }}>
      <video ref={videoRef} muted playsInline style={{ width:'100%', display:'block' }} />
      <div aria-hidden="true" style={{
        position:'absolute',
        left:'10%',
        right:'10%',
        top:'34%',
        height:'32%',
        border:'2px solid rgba(255,255,255,.92)',
        borderRadius:12,
        boxShadow:'0 0 0 9999px rgba(0,0,0,.20)',
        pointerEvents:'none'
      }} />
      <div aria-hidden="true" style={{
        position:'absolute',
        left:'14%',
        right:'14%',
        top:'50%',
        height:2,
        background:'rgba(255,255,255,.9)',
        boxShadow:'0 0 8px rgba(0,0,0,.65)',
        pointerEvents:'none'
      }} />
    </div>

    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
      {torchDisponivel&&<button type="button" onClick={()=>void alternarLanterna()}>{torchAtiva?'Desligar lanterna':'Ligar lanterna'}</button>}
      {zoomDisponivel&&<label style={{ display:'flex', alignItems:'center', gap:8, flex:'1 1 220px' }}>
        <span>Zoom</span>
        <input
          type="range"
          min={zoomMin}
          max={zoomMax}
          step={0.1}
          value={zoom}
          onChange={e=>void alterarZoom(Number(e.target.value))}
          style={{ flex:1 }}
        />
      </label>}
    </div>

    <p
      className="muted"
      style={{
        marginTop:10,
        color:'#ffffff',
        textAlign:'center',
        width:'100%',
        display:'block'
      }}
    >
      Centralize todo o código dentro do quadro. Para garrafas e embalagens curvas, afaste um pouco a câmera, evite reflexos e gire o celular ou a embalagem até as barras ficarem bem definidas.
    </p>
    {erro && <p className="error">{erro}</p>}
  </div>;
}
