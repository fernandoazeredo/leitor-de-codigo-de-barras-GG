import { FormEvent, useEffect, useState } from 'react';
import {
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import App from './App';
import { BrandMark, GoogleGIcon } from './BrandMark';
import { auth, db, googleProvider } from './firebase';

type Perfil = {
  nome?: string;
  email?: string;
  ativo: boolean;
  perfil: 'ADMINISTRADOR' | 'OPERADOR';
};

const OWNER_EMAIL = 'fernandoazeredo64@gmail.com';

function mensagemErro(codigo?: string) {
  switch (codigo) {
    case 'auth/invalid-credential': return 'E-mail ou senha inválidos.';
    case 'auth/user-disabled': return 'Este usuário está desativado.';
    case 'auth/too-many-requests': return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/popup-closed-by-user': return 'Login com Google cancelado.';
    case 'auth/popup-blocked': return 'O navegador bloqueou a janela do Google. Tentaremos o acesso por redirecionamento.';
    case 'auth/unauthorized-domain': return 'Este endereço ainda não está autorizado no Firebase Authentication.';
    case 'auth/operation-not-allowed': return 'O provedor Google não está habilitado no Firebase Authentication.';
    case 'auth/network-request-failed': return 'Falha de conexão. Verifique a internet e tente novamente.';
    case 'auth/account-exists-with-different-credential': return 'Já existe uma conta com este e-mail usando outro método de acesso.';
    default: return codigo ? `Não foi possível entrar (${codigo}).` : 'Não foi possível entrar. Verifique os dados e tente novamente.';
  }
}

async function carregarPerfil(u: User): Promise<Perfil | null> {
  const ref = doc(db, 'usuarios', u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data() as Perfil;

  if (u.email?.toLowerCase() === OWNER_EMAIL && u.emailVerified) {
    const novo: Perfil = {
      nome: u.displayName || 'Fernando Azeredo',
      email: u.email,
      ativo: true,
      perfil: 'ADMINISTRADOR'
    };
    await setDoc(ref, novo);
    return novo;
  }

  return null;
}

function EyeIcon({ aberto }: { aberto: boolean }) {
  return aberto ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.9 10.9 0 0 1 12 4c5.4 0 9 5.5 9 5.5a17.3 17.3 0 0 1-3 3.6M6.2 6.2C4.2 7.5 3 9.5 3 9.5S6.6 15 12 15c1 0 1.9-.2 2.7-.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-5.5 9-5.5S21 12 21 12s-3.5 5.5-9 5.5S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    void setPersistence(auth, browserLocalPersistence).catch(() => undefined);
    void getRedirectResult(auth).catch((e: any) => setErro(mensagemErro(e?.code)));

    return onAuthStateChanged(auth, async (u) => {
      setCarregando(true);
      setErro('');
      setUser(u);
      setPerfil(null);

      if (u) {
        try {
          setPerfil(await carregarPerfil(u));
        } catch (e: any) {
          setErro(e?.code ? mensagemErro(e.code) : 'Não foi possível validar sua autorização no banco de dados.');
        }
      }

      setCarregando(false);
    });
  }, []);

  async function entrarEmail(e: FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro('');
    try {
      await signInWithEmailAndPassword(auth, email.trim(), senha);
    } catch (e: any) {
      setErro(mensagemErro(e?.code));
    } finally {
      setEntrando(false);
    }
  }

  async function entrarGoogle() {
    setEntrando(true);
    setErro('');

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError: any) {
          setErro(mensagemErro(redirectError?.code));
        }
      } else {
        setErro(mensagemErro(code));
      }
    } finally {
      setEntrando(false);
    }
  }

  async function sair() {
    await signOut(auth);
  }

  if (carregando) {
    return <div className="auth-page"><div className="auth-card"><BrandMark /><h1>Leitor de Código de Barras GG</h1><p>Validando acesso...</p></div></div>;
  }

  if (!user) {
    return <div className="auth-page">
      <div className="auth-card">
        <BrandMark />
        <h1>Leitor de Código de Barras GG</h1>
        <p className="muted">Acesso restrito a usuários autorizados.</p>
        <form onSubmit={entrarEmail} className="auth-form">
          <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Senha
            <div className="password-field">
              <input type={mostrarSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                <EyeIcon aberto={mostrarSenha} />
              </button>
            </div>
          </label>
          <button className="primary wide" disabled={entrando}>{entrando ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div className="auth-divider"><span>ou</span></div>
        <button className="google-button wide" onClick={entrarGoogle} disabled={entrando}>
          <GoogleGIcon />
          <span>{entrando ? 'Conectando...' : 'Entrar com Google'}</span>
        </button>
        {erro && <p className="auth-error">{erro}</p>}
      </div>
    </div>;
  }

  if (!perfil || !perfil.ativo) {
    return <div className="auth-page">
      <div className="auth-card">
        <BrandMark />
        <h1>Acesso não autorizado</h1>
        <p>Você entrou como <b>{user.email}</b>, mas este usuário ainda não está autorizado para usar o aplicativo.</p>
        <p className="muted">Um administrador deve cadastrar o seu UID na coleção <b>usuarios</b> e marcar o acesso como ativo.</p>
        {erro && <p className="auth-error">{erro}</p>}
        <button className="wide" onClick={sair}>Sair</button>
      </div>
    </div>;
  }

  return <div className="authorized-shell">
    <App />
    <button className="logout-fab" onClick={sair} title={`Sair de ${user.email ?? ''}`}>Sair</button>
  </div>;
}
