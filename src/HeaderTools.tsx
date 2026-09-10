import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Tema = 'light' | 'dark';

const DICAS = [
  ['1. Prepare as bases', 'No menu hambúrguer, importe ou substitua as bases de Fabricantes, GG Manual e GG Automático. Use os modelos disponíveis para manter o formato correto.'],
  ['2. Ler um código', 'Na aba Leitor, toque em Abrir câmera. Centralize todo o código de barras dentro do quadro. Em garrafas ou superfícies curvas, afaste um pouco a câmera e evite reflexos.'],
  ['3. Use foco, zoom e lanterna', 'Mantenha o aparelho firme. Se disponível, ajuste o Zoom e use a Lanterna em ambientes escuros. Gire a embalagem ou o celular quando o código estiver na vertical.'],
  ['4. Buscar pelo código', 'Você também pode digitar no campo de busca o código do fabricante, o código GG Manual ou o GG Automático e tocar em Buscar.'],
  ['5. Buscar pelo produto', 'Se não tiver o código, use Buscar por nome do produto. A pesquisa consulta as bases GG e Fabricantes.'],
  ['6. Confirmar correspondência', 'Quando um código de fabricante ainda não estiver vinculado, o aplicativo apresenta possíveis produtos GG. Confira os dados antes de confirmar a opção correta.'],
  ['7. Consultar o Extrato', 'A aba Extrato mostra as correspondências já realizadas. Pesquise por código ou produto para localizar um registro sem criar duplicidade.'],
  ['8. Conferir as bases', 'As abas Fabricantes e Códigos GG permitem consultar o conteúdo atualmente carregado no aplicativo.'],
  ['9. Gerar relatórios', 'Use Consolidado para visualizar os vínculos e o menu hambúrguer para exportar o relatório consolidado ou o Extrato em Excel.'],
  ['10. Dica para leitura difícil', 'Limpe a lente da câmera, deixe o código inteiro visível, procure boa iluminação, reduza reflexos e teste diferentes distâncias até as barras ficarem nítidas.']
] as const;

function BookIcon(){
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5.5A4.5 4.5 0 0 1 8 3h3v16H8a4.5 4.5 0 0 0-4.5 2V5.5Zm17 0A4.5 4.5 0 0 0 16 3h-3v16h3a4.5 4.5 0 0 1 4.5 2V5.5Z"/></svg>;
}
function MoonIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.1A8.6 8.6 0 0 1 8.9 3.8 8.9 8.9 0 1 0 20.2 15.1Z"/></svg>;}
function SunIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>;}
function ExitIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H5v14h5M13 8l4 4-4 4M17 12H9"/></svg>;}
function ShareIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V3M8 7l4-4 4 4M5 11v8h14v-8"/></svg>;}

export function HeaderTools() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [menuHost, setMenuHost] = useState<HTMLElement | null>(null);
  const [dicasOpen, setDicasOpen] = useState(false);
  const [tema, setTema] = useState<Tema>(() => {
    const salvo = localStorage.getItem('gg-theme');
    if (salvo === 'dark' || salvo === 'light') return salvo;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const alternarTema = () => setTema(t => t === 'light' ? 'dark' : 'light');
  const sair = () => (document.querySelector('.logout-fab') as HTMLButtonElement | null)?.click();
  const compartilhar = async () => {
    const url = 'https://leitor-codigo-barras-gg.web.app';
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Leitor GG', text: 'Leitor de Código de Barras GG', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      window.alert('Link do aplicativo copiado. Envie para a pessoa abrir e adicionar à tela inicial.');
    } catch (erro) {
      if ((erro as DOMException)?.name !== 'AbortError') {
        window.alert(`Compartilhe este endereço: ${url}`);
      }
    }
  };

  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('gg-theme', tema);
  }, [tema]);

  useEffect(() => {
    const localizar = () => {
      setHost(document.querySelector<HTMLElement>('.authorized-shell .header-actions'));
      setMenuHost(document.querySelector<HTMLElement>('.authorized-shell .sheet-menu'));
    };
    localizar();
    const observer = new MutationObserver(localizar);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!dicasOpen) return;
    const fechar = (event: KeyboardEvent) => { if (event.key === 'Escape') setDicasOpen(false); };
    document.addEventListener('keydown', fechar);
    return () => document.removeEventListener('keydown', fechar);
  }, [dicasOpen]);

  if (!host) return null;

  const headerActions = <>
    <button className="share-button" type="button" onClick={() => void compartilhar()} aria-label="Compartilhar aplicativo" title="Compartilhar aplicativo"><ShareIcon/></button>
    <button className="tips-button header-utility" type="button" onClick={() => setDicasOpen(true)}><BookIcon/><span>DICAS</span></button>
    <button className="theme-button header-utility" type="button" onClick={alternarTema}>{tema === 'light' ? <MoonIcon/> : <SunIcon/>}<span>Tema</span></button>
    <button className="header-logout header-utility" type="button" onClick={sair}><ExitIcon/><span>Sair</span></button>
  </>;

  const menuActions = menuHost ? createPortal(<div className="menu-extra-actions">
    <b>Ações</b>
    <button type="button" onClick={() => setDicasOpen(true)}>DICAS — Como usar</button>
    <button type="button" onClick={alternarTema}>{tema === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}</button>
    <button type="button" onClick={sair}>Sair</button>
  </div>, menuHost) : null;

  return <>
    {createPortal(headerActions, host)}
    {menuActions}
    {dicasOpen && <div className="tips-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setDicasOpen(false); }}>
      <div className="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-title">
        <div className="tips-head"><div><small>GUIA RÁPIDO</small><h2 id="tips-title">Como usar o Leitor GG</h2></div><button type="button" onClick={() => setDicasOpen(false)}>✕</button></div>
        <div className="tips-content">{DICAS.map(([titulo, texto]) => <div className="tip-step" key={titulo}><h3>{titulo}</h3><p>{texto}</p></div>)}</div>
        <button className="primary tips-close" type="button" onClick={() => setDicasOpen(false)}>Entendi</button>
      </div>
    </div>}
  </>;
}
