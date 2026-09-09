import { FormEvent, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import App from './App';
import { auth, db, googleProvider } from './firebase';

type Perfil = {
  nome?: string;
  email?: string;
  ativo: boolean;
  perfil: 'ADMINISTRADOR' | 'OPERADOR';
};

function mensagemErro(codigo?: string) {
  switch (codigo) {
    case 'auth/invalid-credential': return 'E-mail ou senha inválidos.';
    case 'auth/user-disabled': return 'Este usuário está desativado.';
    case 'auth/too-many-requests': return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'auth/popup-closed-by-user': return 'Login com Google cancelado.';
    default: return 'Não foi possível entrar. Verifique os dados e tente novamente.';
  }
}

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setCarregando(true);
    setErro('');
    setUser(u);
    setPerfil(null);

    if (u) {
      try {
        const snap = await getDoc(doc(db, 'usuarios', u.uid));
        if (snap.exists()) setPerfil(snap.data() as Perfil);
      } catch {
        setErro('Não foi possível validar sua autorização no banco de dados.');
      }
    }

    setCarregando(false);
  }), []);

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
      setErro(mensagemErro(e?.code));
    } finally {
      setEntrando(false);
    }
  }

  async function sair() {
    await signOut(auth);
  }

  if (carregando) {
    return <div className="auth-page"><div className="auth-card"><div className="auth-logo">GG</div><h1>Leitor de Código de Barras GG</h1><p>Validando acesso...</p></div></div>;
  }

  if (!user) {
    return <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">GG</div>
        <h1>Leitor de Código de Barras GG</h1>
        <p className="muted">Acesso restrito a usuários autorizados.</p>
        <form onSubmit={entrarEmail} className="auth-form">
          <label>E-mail<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label>Senha<input type="password" value={senha} onChange={e => setSenha(e.target.value)} required autoComplete="current-password" /></label>
          <button className="primary wide" disabled={entrando}>{entrando ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div className="auth-divider"><span>ou</span></div>
        <button className="google-button wide" onClick={entrarGoogle} disabled={entrando}>Entrar com Google</button>
        {erro && <p className="auth-error">{erro}</p>}
      </div>
    </div>;
  }

  if (!perfil || !perfil.ativo) {
    return <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">GG</div>
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
