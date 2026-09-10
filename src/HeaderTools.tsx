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
    const abrirDicas = () => setDicasOpen(true);
    const trocarTema = () => alternarTema();
    window.addEventListener('gg-open-tips', abrirDicas);
    window.addEventListener('gg-toggle-theme', trocarTema);
    return () => {
      window.removeEventListener('gg-open-tips', abrirDicas);
      window.removeEventListener('gg-toggle-theme', trocarTema);
    };
  }, []);

  useEffect(() => {
    if (!dicasOpen) return;
    const fechar = (event: KeyboardEvent) => { if (event.key === 'Escape') setDicasOpen(false); };
    document.addEventListener('keydown', fechar);
    return () => document.removeEventListener('keydown', fechar);
  }, [dicasOpen]);

  if (!host) return null;

  const headerActions = <>
    <button className="tips-button header-utility" type="button" onClick={() => setDicasOpen(true)} aria-label="Abrir dicas de uso">◫ DICAS</button>
    <button
      className="theme-button header-utility"
      type="button"
      onClick={alternarTema}
      aria-label={tema === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={tema === 'light' ? 'Modo escuro' : 'Modo claro'}
    >{tema === 'light' ? '☾' : '☀'} <span>Tema</span></button>
  </>;

  const menuActions = menuHost ? createPortal(<div className="menu-extra-actions">
    <b>Ações</b>
    <button type="button" onClick={() => setDicasOpen(true)}>◫ DICAS — Como usar</button>
    <button type="button" onClick={alternarTema}>{tema === 'light' ? '☾ Ativar modo escuro' : '☀ Ativar modo claro'}</button>
    <button type="button" onClick={() => (document.querySelector('.logout-fab') as HTMLButtonElement | null)?.click()}>↪ Sair</button>
  </div>, menuHost) : null;

  return <>
    {createPortal(headerActions, host)}
    {menuActions}
    {dicasOpen && <div className="tips-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setDicasOpen(false); }}>
      <div className="tips-modal" role="dialog" aria-modal="true" aria-labelledby="tips-title">
        <div className="tips-head">
          <div><small>GUIA RÁPIDO</small><h2 id="tips-title">Como usar o Leitor GG</h2></div>
          <button type="button" onClick={() => setDicasOpen(false)} aria-label="Fechar dicas">✕</button>
        </div>
        <div className="tips-content">
          {DICAS.map(([titulo, texto]) => <div className="tip-step" key={titulo}><h3>{titulo}</h3><p>{texto}</p></div>)}
        </div>
        <button className="primary tips-close" type="button" onClick={() => setDicasOpen(false)}>Entendi</button>
      </div>
    </div>}
  </>;
}
