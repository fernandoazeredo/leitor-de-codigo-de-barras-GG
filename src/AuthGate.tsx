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

  // Bootstrap seguro do primeiro administrador do projeto.
  // As regras do Firestore permitem esta criação apenas para o e-mail proprietário verificado.
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

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
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
      // Popup é o fluxo principal e evita problemas de armazenamento entre domínios.
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      const code = e?.code as string | undefined;

      // Em celulares/PWAs alguns navegadores bloqueiam popup; nesses casos usamos redirect.
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
          <label>Senha<input type="password" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" /></label>
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
