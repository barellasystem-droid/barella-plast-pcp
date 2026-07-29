import React, { useState, useEffect, useMemo } from 'react';
import {
  Factory, LogOut, Lock, Unlock, Plus, Trash2, Save, X, Menu, AlertTriangle,
  Eye, EyeOff, KeyRound, Printer, Pencil,
} from 'lucide-react';
import { styles } from './styles.js';
import { api, getToken, setToken } from './api.js';
import {
  ROLES, ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_STRIPE, TABS, TURNOS, STATUS_OP,
  PRIORIDADES, MESES, STATUS_COLOR, fmt,
} from './constants.js';

/* ============================== ROOT APP ============================== */

export default function App() {
  const [booting, setBooting] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [myPermissions, setMyPermissions] = useState({});
  const [loginErr, setLoginErr] = useState('');
  const [dataErr, setDataErr] = useState('');

  const [users, setUsers] = useState([]);
  const [permissionsMatrix, setPermissionsMatrix] = useState(null);
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [productMaterials, setProductMaterials] = useState([]);
  const [operators, setOperators] = useState([]);
  const [injetoras, setInjetoras] = useState([]);
  const [ordersGeral, setOrdersGeral] = useState([]);
  const [ordersMaquina, setOrdersMaquina] = useState([]);
  const [apontamentos, setApontamentos] = useState([]);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Restore session on load if a token is already stored.
  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { setBooting(false); return; }
      try {
        const { user, permissions } = await api.me();
        setCurrentUser(user);
        setMyPermissions(permissions);
        await loadCoreData();
        const first = TABS.find(t => permissions[t.id]?.view);
        setActiveTab(first ? first.id : 'dashboard');
      } catch (e) {
        setToken(null);
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCoreData() {
    try {
      const [pr, rm, pm, ops, inj, og, om, ap] = await Promise.all([
        api.products.list(), api.rawMaterials.list(), api.productMaterials.list(), api.operators.list(),
        api.injetoras.list(), api.ordersGeral.list(), api.ordersMaquina.list(), api.apontamentos.list(),
      ]);
      setProducts(pr); setRawMaterials(rm); setProductMaterials(pm); setOperators(ops); setInjetoras(inj);
      setOrdersGeral(og); setOrdersMaquina(om); setApontamentos(ap);
      setDataErr('');
    } catch (e) {
      setDataErr('Não foi possível carregar os dados do servidor: ' + e.message);
    }
  }

  async function reloadProductMaterials() {
    try { setProductMaterials(await api.productMaterials.list()); } catch (e) { setDataErr(e.message); }
  }

  async function reloadOperators() {
    try { setOperators(await api.operators.list()); } catch (e) { setDataErr(e.message); }
  }

  async function reloadInjetoras() {
    try { setInjetoras(await api.injetoras.list()); } catch (e) { setDataErr(e.message); }
  }

  async function handleLogin(username, password) {
    setLoginErr('');
    try {
      const { token, user } = await api.login(username, password);
      setToken(token);
      const me = await api.me();
      setCurrentUser(me.user);
      setMyPermissions(me.permissions);
      await loadCoreData();
      const first = TABS.find(t => me.permissions[t.id]?.view);
      setActiveTab(first ? first.id : 'dashboard');
    } catch (e) {
      setLoginErr(e.message || 'Não foi possível entrar.');
    }
  }

  async function handleRegister(data) {
    const { token, user } = await api.register(data); // deixa o erro propagar pro LoginScreen mostrar
    setToken(token);
    setCurrentUser(user);
    setMyPermissions({});
  }

  function handleLogout() {
    setToken(null);
    setCurrentUser(null);
    setMyPermissions({});
    setActiveTab('dashboard');
  }

  async function loadPermissionsMatrix() {
    try {
      const matrix = await api.permissions.get();
      setPermissionsMatrix(matrix);
    } catch (e) { setDataErr(e.message); }
  }

  async function loadUsers() {
    try {
      const list = await api.users.list();
      setUsers(list);
    } catch (e) { setDataErr(e.message); }
  }

  function goTo(tabId) {
    setActiveTab(tabId);
    setSidebarOpen(false);
    if (tabId === 'permissoes') loadPermissionsMatrix();
    if (tabId === 'usuarios') loadUsers();
  }

  if (booting) {
    return (
      <div style={styles.loadingWrap}>
        <GlobalStyle />
        <div style={styles.loadingCard}>
          <Factory size={28} color="#E8A324" />
          <div style={{ marginTop: 10, fontFamily: 'var(--font-display)', color: '#E7E7E5' }}>Carregando sistema…</div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} error={loginErr} />;

  if (currentUser.role === 'pendente') return <PendingApprovalScreen user={currentUser} onLogout={handleLogout} />;

  const visibleTabs = TABS.filter(t => myPermissions[t.id]?.view);
  const grouped = visibleTabs.reduce((acc, t) => { (acc[t.group] = acc[t.group] || []).push(t); return acc; }, {});
  const activeMeta = TABS.find(t => t.id === activeTab);
  const hasAccess = activeMeta && myPermissions[activeTab]?.view;
  const editAllowed = activeMeta && myPermissions[activeTab]?.edit;

  return (
    <div style={styles.appWrap}>
      <GlobalStyle />

      <div className={`bp-sidebar-backdrop${sidebarOpen ? ' show' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`bp-sidebar${sidebarOpen ? ' sidebar-open' : ''}`} style={styles.sidebar}>
        <div style={styles.brand}>
          <Factory size={22} color="#E8A324" />
          <div>
            <div style={styles.brandTitle}>BARELLA PLAST</div>
            <div style={styles.brandSub}>Painel de Produção — PCP</div>
          </div>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
          {Object.entries(grouped).map(([group, tabs]) => (
            <div key={group} style={{ marginBottom: 14 }}>
              <div style={styles.groupLabel}>{group}</div>
              {tabs.map(t => {
                const Icon = t.icon;
                const active = t.id === activeTab;
                const editableTab = myPermissions[t.id]?.edit;
                return (
                  <button key={t.id} onClick={() => goTo(t.id)} style={{ ...styles.navItem, ...(active ? styles.navItemActive : {}) }}>
                    <Icon size={16} />
                    <span style={{ flex: 1, textAlign: 'left' }}>{t.label}</span>
                    {editableTab ? <Unlock size={12} color="#4C8C6B" /> : <Lock size={12} color="#6B7075" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={styles.userCard}>
          <div style={{ ...styles.roleStripe, background: ROLE_STRIPE[currentUser.role] }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.userName}>{currentUser.name}</div>
            <div style={styles.userRole}>{ROLE_LABELS[currentUser.role]}</div>
          </div>
          <button onClick={handleLogout} title="Sair" style={styles.logoutBtn}><LogOut size={16} /></button>
        </div>
      </aside>

      <div style={styles.main}>
        <header style={styles.topbar}>
          <button className="bp-menu-btn" style={styles.menuBtn} onClick={() => setSidebarOpen(s => !s)}><Menu size={18} /></button>
          <div style={styles.topbarTitle}>{activeMeta ? activeMeta.label : ''}</div>
          <div style={{ ...styles.accessPill, background: editAllowed ? 'rgba(76,140,107,0.15)' : 'rgba(107,112,117,0.15)', color: editAllowed ? '#3B6E4E' : '#6B7075' }}>
            {editAllowed ? <Unlock size={12} /> : <Eye size={12} />}
            {editAllowed ? 'Você pode editar esta aba' : 'Somente visualização'}
          </div>
        </header>

        <main className="bp-content" style={styles.content}>
          {dataErr && <div style={styles.errBox}><AlertTriangle size={14} /> {dataErr}</div>}
          {!hasAccess ? (
            <NoAccess />
          ) : (
            <TabRouter
              tab={activeTab}
              canEdit={editAllowed}
              currentUser={currentUser}
              users={users} reloadUsers={loadUsers}
              permissionsMatrix={permissionsMatrix} reloadPermissions={loadPermissionsMatrix}
              products={products} setProducts={setProducts}
              rawMaterials={rawMaterials} setRawMaterials={setRawMaterials}
              productMaterials={productMaterials} reloadProductMaterials={reloadProductMaterials}
              operators={operators} reloadOperators={reloadOperators}
              injetoras={injetoras} reloadInjetoras={reloadInjetoras}
              ordersGeral={ordersGeral} setOrdersGeral={setOrdersGeral}
              ordersMaquina={ordersMaquina} setOrdersMaquina={setOrdersMaquina}
              apontamentos={apontamentos} setApontamentos={setApontamentos}
              onError={setDataErr}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* ============================== LOGIN ============================== */

// CEP/CPF/telefone só fazem sentido em dígitos; nome/rua/bairro são texto e
// não devem aceitar números — filtra o valor enquanto a pessoa digita, em vez
// de só reclamar depois no envio.
function onlyDigits(v) { return v.replace(/\D/g, ''); }
function onlyLetters(v) { return v.replace(/[0-9]/g, ''); }

function LoginScreen({ onLogin, onRegister, error }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const [regForm, setRegForm] = useState({ name: '', username: '', email: '', password: '', confirmPassword: '', phone: '', cpf: '', cep: '', rua: '', numero: '', bairro: '' });
  const [showRegPw, setShowRegPw] = useState(false);
  const [regErr, setRegErr] = useState('');
  const [regBusy, setRegBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    await onLogin(username, password);
    setBusy(false);
  }

  // `format` opcional filtra o valor digitado (dígitos ou letras) antes de gravar no estado.
  function setReg(field, format) {
    return (e) => {
      const v = format ? format(e.target.value) : e.target.value;
      setRegForm(f => ({ ...f, [field]: v }));
    };
  }

  const pwMismatch = regForm.confirmPassword.length > 0 && regForm.password !== regForm.confirmPassword;

  async function submitRegister(e) {
    e.preventDefault();
    setRegErr('');
    if (regForm.password !== regForm.confirmPassword) {
      setRegErr('As senhas não coincidem — confira os dois campos.');
      return;
    }
    setRegBusy(true);
    const { confirmPassword, ...payload } = regForm;
    try { await onRegister(payload); }
    catch (err) { setRegErr(err.message || 'Não foi possível concluir o cadastro.'); }
    setRegBusy(false);
  }

  return (
    <div style={styles.loginWrap}>
      <GlobalStyle />
      <div className="bp-login-card" style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <Factory size={26} color="#E8A324" />
          <div>
            <div style={styles.loginBrandTitle}>BARELLA PLAST</div>
            <div style={styles.brandSub}>Painel de Produção — PCP</div>
          </div>
        </div>

        {mode === 'login' ? (
          <>
            <form onSubmit={submit}>
              <label style={styles.label}>Usuário</label>
              <input style={styles.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="seu.usuario" autoFocus />

              <label style={styles.label}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input style={styles.input} type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(s => !s)} style={styles.eyeBtn}>{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>

              {error && <div style={styles.errBox}><AlertTriangle size={14} /> {error}</div>}

              <button type="submit" style={styles.loginBtn} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
            </form>

            <button type="button" style={styles.demoToggle} onClick={() => setMode('register')}>
              <KeyRound size={13} /> Não tem conta? Cadastre-se
            </button>
          </>
        ) : (
          <>
            <form onSubmit={submitRegister}>
              <label style={styles.label}>Nome completo</label>
              <input style={styles.input} value={regForm.name} onChange={setReg('name', onlyLetters)} autoFocus />

              <label style={styles.label}>Usuário (login)</label>
              <input style={styles.input} value={regForm.username} onChange={setReg('username')} />

              <label style={styles.label}>E-mail</label>
              <input style={styles.input} type="email" value={regForm.email} onChange={setReg('email')} placeholder="seu.email@exemplo.com" />

              <label style={styles.label}>Senha</label>
              <div style={{ position: 'relative' }}>
                <input style={styles.input} type={showRegPw ? 'text' : 'password'} value={regForm.password} onChange={setReg('password')} placeholder="mínimo 8 caracteres" />
                <button type="button" onClick={() => setShowRegPw(s => !s)} style={styles.eyeBtn}>{showRegPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>

              <label style={styles.label}>Confirmar senha</label>
              <input style={styles.input} type={showRegPw ? 'text' : 'password'} value={regForm.confirmPassword} onChange={setReg('confirmPassword')} placeholder="repita a senha" />
              {pwMismatch && <div style={styles.fieldError}>As senhas não coincidem.</div>}

              <label style={styles.label}>Telefone</label>
              <input style={styles.input} value={regForm.phone} onChange={setReg('phone', onlyDigits)} placeholder="11999990000" maxLength={11} inputMode="numeric" />

              <label style={styles.label}>CPF</label>
              <input style={styles.input} value={regForm.cpf} onChange={setReg('cpf', onlyDigits)} placeholder="00000000000" maxLength={11} inputMode="numeric" />

              <label style={styles.label}>CEP</label>
              <input style={styles.input} value={regForm.cep} onChange={setReg('cep', onlyDigits)} placeholder="00000000" maxLength={8} inputMode="numeric" />

              <label style={styles.label}>Rua</label>
              <input style={styles.input} value={regForm.rua} onChange={setReg('rua', onlyLetters)} />

              <label style={styles.label}>Número</label>
              <input style={styles.input} value={regForm.numero} onChange={setReg('numero')} />

              <label style={styles.label}>Bairro</label>
              <input style={styles.input} value={regForm.bairro} onChange={setReg('bairro', onlyLetters)} />

              {regErr && <div style={styles.errBox}><AlertTriangle size={14} /> {regErr}</div>}

              <button type="submit" style={styles.loginBtn} disabled={regBusy || pwMismatch}>{regBusy ? 'Cadastrando…' : 'Cadastrar'}</button>
            </form>

            <button type="button" style={styles.demoToggle} onClick={() => setMode('login')}>
              <KeyRound size={13} /> Já tem conta? Entrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function PendingApprovalScreen({ user, onLogout }) {
  return (
    <div style={styles.loginWrap}>
      <GlobalStyle />
      <div className="bp-login-card" style={styles.loginCard}>
        <div style={styles.loginHeader}>
          <Factory size={26} color="#E8A324" />
          <div>
            <div style={styles.loginBrandTitle}>BARELLA PLAST</div>
            <div style={styles.brandSub}>Painel de Produção — PCP</div>
          </div>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Olá, {user.name}!</div>
        <div style={{ color: '#6B7075', fontSize: 13.5, lineHeight: 1.5 }}>
          Seu cadastro foi recebido e está aguardando a liberação de um Administrador.
          Assim que sua função for definida em Usuários, você poderá acessar o sistema normalmente.
        </div>
        <button type="button" style={{ ...styles.secondaryBtn, width: '100%', justifyContent: 'center', marginTop: 18 }} onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}

function NoAccess() {
  return (
    <div style={styles.card}>
      <Lock size={20} color="#C1462E" />
      <div style={{ marginTop: 8, fontWeight: 600 }}>Seu perfil não tem acesso a esta aba.</div>
      <div style={{ marginTop: 4, color: '#6B7075', fontSize: 13 }}>Peça ao administrador para revisar as permissões em Administração → Permissões.</div>
    </div>
  );
}

/* ============================== TAB ROUTER ============================== */

function TabRouter(props) {
  switch (props.tab) {
    case 'dashboard': return <DashboardTab {...props} />;
    case 'cadastros': return <CadastrosTab {...props} />;
    case 'materiasPrimas': return <MateriasPrimasTab {...props} />;
    case 'operadores': return <OperadoresTab {...props} />;
    case 'injetoras': return <InjetorasTab {...props} />;
    case 'programacaoGeral': return <ProgramacaoGeralTab {...props} />;
    case 'distribuicaoInjetoras': return <DistribuicaoTab {...props} />;
    case 'apontamento': return <ApontamentoTab {...props} />;
    case 'opImpressao': return <OpImpressaoTab {...props} />;
    case 'consolidadoMP': return <ConsolidadoMPTab {...props} />;
    case 'estoque': return <EstoqueTab {...props} />;
    case 'comparativoMensal': return <ComparativoMensalTab {...props} />;
    case 'perdasOperadores': return <PerdasOperadoresTab {...props} />;
    case 'usuarios': return <UsuariosTab {...props} />;
    case 'permissoes': return <PermissoesTab {...props} />;
    default: return null;
  }
}

/* ============================== DASHBOARD ============================== */

function DashboardTab({ ordersMaquina, apontamentos, injetoras }) {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState(String(now.getMonth() + 1));

  const totals = useMemo(() => {
    const programado = ordersMaquina.reduce((s, o) => s + Number(o.qtd_programada || 0), 0);
    const produzido = apontamentos.reduce((s, a) => s + Number(a.qtd_produzida || 0), 0);
    const refugo = apontamentos.reduce((s, a) => s + Number(a.refugo || 0), 0);
    return { programado, produzido, refugo, boas: produzido - refugo };
  }, [ordersMaquina, apontamentos]);

  const byInjetora = useMemo(() => injetoras.map(i => {
    const oms = ordersMaquina.filter(o => o.injetora === i.nome);
    const programado = oms.reduce((s, o) => s + Number(o.qtd_programada || 0), 0);
    const omIds = new Set(oms.map(o => o.id));
    const aps = apontamentos.filter(a => omIds.has(a.op_maquina_id));
    const produzido = aps.reduce((s, a) => s + Number(a.qtd_produzida || 0), 0);
    const refugo = aps.reduce((s, a) => s + Number(a.refugo || 0), 0);
    return { inj: i.nome, programado, produzido, refugo };
  }), [injetoras, ordersMaquina, apontamentos]);

  const atingimento = totals.programado ? (totals.boas / totals.programado) * 100 : 0;
  const indiceRefugo = totals.produzido ? (totals.refugo / totals.produzido) * 100 : 0;

  return (
    <div>
      <div className="bp-kpi-grid" style={styles.kpiGrid}>
        <Kpi label="Peças programadas" value={fmt(totals.programado, 0)} />
        <Kpi label="Peças produzidas" value={fmt(totals.produzido, 0)} />
        <Kpi label="Peças boas" value={fmt(totals.boas, 0)} accent="#4C8C6B" />
        <Kpi label="Refugo total" value={fmt(totals.refugo, 0)} accent="#C1462E" />
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Programado x Produzido por Injetora</div>
        <Table columns={['Injetora', 'Programado', 'Produzido', 'Refugo']} rows={byInjetora.map(r => [r.inj, fmt(r.programado, 0), fmt(r.produzido, 0), fmt(r.refugo, 0)])} />
      </div>
      <div className="bp-grid-2" style={{ gap: 14 }}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Atingimento geral</div>
          <div style={styles.bigNumber}>{fmt(atingimento, 1)}%</div>
          <div style={styles.caption}>Peças boas ÷ peças programadas</div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Índice de refugo</div>
          <div style={{ ...styles.bigNumber, color: '#C1462E' }}>{fmt(indiceRefugo, 1)}%</div>
          <div style={styles.caption}>Refugo ÷ produção total</div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Comparativo mensal</div>
        <div className="bp-grid-2" style={{ gap: 12 }}>
          <Field label="Ano"><input style={styles.input} value={ano} onChange={e => setAno(e.target.value)} /></Field>
          <Field label="Mês">
            <select style={styles.input} value={mes} onChange={e => setMes(e.target.value)}>
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <ComparativoMensalDashboard ordersMaquina={ordersMaquina} apontamentos={apontamentos} ano={ano} mes={mes} />
    </div>
  );
}

function monthKeyMatch(dateStr, ano, mes) {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === Number(ano) && (d.getMonth() + 1) === Number(mes);
}

function previousMonth(ano, mes) {
  let y = Number(ano), m = Number(mes) - 1;
  if (m < 1) { m = 12; y -= 1; }
  return [y, m];
}

// Agrega parada/refugo/atingimento por operador e produção por injetora, para um mês específico.
function monthStats(ordersMaquina, apontamentos, ano, mes) {
  const aps = apontamentos.filter(a => monthKeyMatch(a.date, ano, mes));
  const byOperador = {};
  const byInjetora = {};
  aps.forEach(a => {
    const om = ordersMaquina.find(o => o.id === a.op_maquina_id);
    const key = a.operador || 'Não informado';
    if (!byOperador[key]) byOperador[key] = { parada: 0, refugo: 0, atingimentoSum: 0, atingimentoCount: 0 };
    byOperador[key].parada += Number(a.parada) || 0;
    byOperador[key].refugo += Number(a.refugo) || 0;
    if (om?.qtd_programada) {
      const qtdBoa = (Number(a.qtd_produzida) || 0) - (Number(a.refugo) || 0);
      byOperador[key].atingimentoSum += (qtdBoa / Number(om.qtd_programada)) * 100;
      byOperador[key].atingimentoCount += 1;
    }
    if (om) {
      byInjetora[om.injetora] = (byInjetora[om.injetora] || 0) + (Number(a.qtd_produzida) || 0);
    }
  });
  return { byOperador, byInjetora };
}

function topBy(entries, getValue, mode = 'max') {
  if (!entries.length) return null;
  return entries.reduce((best, cur) => {
    const v = getValue(cur), bv = getValue(best);
    return (mode === 'max' ? v > bv : v < bv) ? cur : best;
  });
}

function ComparativoMensalDashboard({ ordersMaquina, apontamentos, ano, mes }) {
  const [py, pm] = previousMonth(ano, mes);
  const current = useMemo(() => monthStats(ordersMaquina, apontamentos, ano, mes), [ordersMaquina, apontamentos, ano, mes]);
  const previous = useMemo(() => monthStats(ordersMaquina, apontamentos, py, pm), [ordersMaquina, apontamentos, py, pm]);

  const operadorEntries = Object.entries(current.byOperador);
  const injetoraEntries = Object.entries(current.byInjetora);

  const paradaTop = topBy(operadorEntries, ([, v]) => v.parada, 'max');
  const refugoTop = topBy(operadorEntries, ([, v]) => v.refugo, 'max');
  const atingimentoTop = topBy(operadorEntries, ([, v]) => v.atingimentoCount ? v.atingimentoSum / v.atingimentoCount : 0, 'max');
  const injMax = topBy(injetoraEntries, ([, v]) => v, 'max');
  const injMin = topBy(injetoraEntries, ([, v]) => v, 'min');

  function prevParada(name) { return current.byOperador[name] ? (previous.byOperador[name]?.parada ?? null) : null; }
  function prevRefugo(name) { return previous.byOperador[name]?.refugo ?? null; }
  function prevAtingimento(name) {
    const p = previous.byOperador[name];
    return p && p.atingimentoCount ? p.atingimentoSum / p.atingimentoCount : null;
  }
  function prevInjetora(inj) { return previous.byInjetora[inj] ?? null; }

  return (
    <div>
      <div className="bp-kpi-grid" style={styles.kpiGrid}>
        <RankingCard title="Operador com mais tempo parado" name={paradaTop?.[0]} value={paradaTop ? paradaTop[1].parada : 0} unit=" min" prevValue={paradaTop ? prevParada(paradaTop[0]) : null} accent="#C1462E" />
        <RankingCard title="Operador com mais perda (refugo)" name={refugoTop?.[0]} value={refugoTop ? refugoTop[1].refugo : 0} unit=" pç" prevValue={refugoTop ? prevRefugo(refugoTop[0]) : null} accent="#C1462E" />
        <RankingCard title="Melhor produtividade (atingimento)" name={atingimentoTop?.[0]} value={atingimentoTop ? (atingimentoTop[1].atingimentoCount ? atingimentoTop[1].atingimentoSum / atingimentoTop[1].atingimentoCount : 0) : 0} unit="%" prevValue={atingimentoTop ? prevAtingimento(atingimentoTop[0]) : null} accent="#4C8C6B" />
        <RankingCard title="Injetora que mais produz" name={injMax?.[0]} value={injMax ? injMax[1] : 0} unit=" pç" prevValue={injMax ? prevInjetora(injMax[0]) : null} accent="#4C8C6B" />
        <RankingCard title="Injetora que menos produz" name={injMin?.[0]} value={injMin ? injMin[1] : 0} unit=" pç" prevValue={injMin ? prevInjetora(injMin[0]) : null} accent="#C1462E" />
      </div>
      {!operadorEntries.length && <div style={styles.emptyState}>Sem apontamentos lançados para o mês selecionado.</div>}
      <OperadorMesAMesTable apontamentos={apontamentos} ordersMaquina={ordersMaquina} ano={ano} />
    </div>
  );
}

function RankingCard({ title, name, value, unit, prevValue, accent }) {
  const delta = (prevValue !== null && prevValue !== undefined) ? value - prevValue : null;
  return (
    <div style={styles.kpiBox}>
      <div style={styles.kpiLabel}>{title}</div>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 4, minHeight: 18 }}>{name || '—'}</div>
      <div style={{ ...styles.kpiValue, color: accent || '#1B1D1F', fontSize: 22 }}>{fmt(value, 1)}{unit}</div>
      {delta !== null && (
        <div style={{ fontSize: 11.5, color: delta > 0 ? '#C1462E' : delta < 0 ? '#4C8C6B' : '#6B7075', marginTop: 4 }}>
          {delta > 0 ? '▲' : delta < 0 ? '▼' : '·'} {fmt(Math.abs(delta), 1)}{unit} vs. mês anterior
        </div>
      )}
    </div>
  );
}

function OperadorMesAMesTable({ apontamentos, ordersMaquina, ano }) {
  const [metric, setMetric] = useState('produzida');
  const operadores = Array.from(new Set(apontamentos.map(a => a.operador || 'Não informado')));

  function valorApontamento(a) {
    if (metric === 'produzida') return Number(a.qtd_produzida) || 0;
    if (metric === 'refugo') return Number(a.refugo) || 0;
    return Number(a.parada) || 0;
  }

  const matrix = operadores.map(op => {
    const meses = MESES.map((_, mIdx) => apontamentos.filter(a => {
      if ((a.operador || 'Não informado') !== op || !a.date) return false;
      const d = new Date(a.date + 'T00:00:00');
      return d.getFullYear() === Number(ano) && d.getMonth() === mIdx;
    }).reduce((s, a) => s + valorApontamento(a), 0));
    return { op, meses, total: meses.reduce((s, v) => s + v, 0) };
  });

  const metricLabel = { produzida: 'Peças produzidas', refugo: 'Refugo (peças)', parada: 'Parada (min)' };

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Comparativo mensal por operador — {ano}</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {Object.entries(metricLabel).map(([key, label]) => (
          <button key={key} type="button" style={metric === key ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setMetric(key)}>{label}</button>
        ))}
      </div>
      {!matrix.length ? <div style={styles.emptyState}>Nenhum apontamento lançado ainda.</div> : (
        <div style={{ overflowX: 'auto' }}>
          <Table columns={['Operador', ...MESES, 'Total']} rows={matrix.map(r => [r.op, ...r.meses.map(v => fmt(v, 0)), fmt(r.total, 0)])} />
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div style={styles.kpiBox}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={{ ...styles.kpiValue, color: accent || '#1B1D1F' }}>{value}</div>
    </div>
  );
}

/* ============================== CADASTROS ============================== */

function CadastrosTab({ products, setProducts, rawMaterials, productMaterials, reloadProductMaterials, injetoras, canEdit, onError }) {
  const activeInjetoras = injetoras.filter(i => i.ativa);
  function emptyProduct() { return { code: '', name: '', molde: '', maquina: activeInjetoras[0]?.nome || '', prodDia: '', peso: '', cavidades: '', materials: [{ rawMaterialCode: '', percentual: '' }] }; }
  const [form, setForm] = useState(emptyProduct());
  const [editingCode, setEditingCode] = useState(null);

  function updateMaterial(idx, field, value) {
    setForm({ ...form, materials: form.materials.map((m, i) => i === idx ? { ...m, [field]: value } : m) });
  }
  function addMaterialRow() { setForm({ ...form, materials: [...form.materials, { rawMaterialCode: '', percentual: '' }] }); }
  function removeMaterialRow(idx) { setForm({ ...form, materials: form.materials.filter((_, i) => i !== idx) }); }

  function startEdit(p) {
    const mats = productMaterials.filter(m => m.product_code === p.code)
      .map(m => ({ rawMaterialCode: m.raw_material_code, percentual: m.percentual }));
    setForm({
      code: p.code, name: p.name, molde: p.molde || '', maquina: p.maquina || '',
      prodDia: p.prod_dia ?? '', peso: p.peso ?? '', cavidades: p.cavidades ?? '',
      materials: mats.length ? mats : [{ rawMaterialCode: '', percentual: '' }],
    });
    setEditingCode(p.code);
  }
  function cancelEdit() { setForm(emptyProduct()); setEditingCode(null); }

  async function submit(e) {
    e.preventDefault();
    if (!form.code || !form.name) return;
    const materials = form.materials.filter(m => m.rawMaterialCode);
    try {
      if (editingCode) {
        await api.products.update(editingCode, { ...form, materials });
        setProducts(products.map(p => p.code === editingCode
          ? { ...p, name: form.name, molde: form.molde, maquina: form.maquina, prod_dia: form.prodDia, peso: form.peso, cavidades: form.cavidades }
          : p));
      } else {
        await api.products.create({ ...form, materials });
        setProducts([...products, { code: form.code, name: form.name, molde: form.molde, maquina: form.maquina, prod_dia: form.prodDia, peso: form.peso, cavidades: form.cavidades }]);
      }
      await reloadProductMaterials();
      setForm(emptyProduct());
      setEditingCode(null);
    } catch (e) { onError(e.message); }
  }
  async function remove(code) {
    try {
      await api.products.remove(code);
      setProducts(products.filter(p => p.code !== code));
      await reloadProductMaterials();
      if (editingCode === code) cancelEdit();
    } catch (e) { onError(e.message); }
  }

  const totalPct = form.materials.reduce((s, m) => s + (Number(m.percentual) || 0), 0);
  const rmByCode = Object.fromEntries(rawMaterials.map(r => [r.code, r]));

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{editingCode ? `Editar produto: ${editingCode}` : 'Novo produto'}</div>
          <form onSubmit={submit}>
            <div className="bp-form-grid" style={styles.formGrid}>
              <Field label="Código"><input style={styles.input} value={form.code} disabled={!!editingCode} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
              <Field label="Produto" wide><input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Molde"><input style={styles.input} value={form.molde} onChange={e => setForm({ ...form, molde: e.target.value })} /></Field>
              <Field label="Máquina padrão">
                <select style={styles.input} value={form.maquina} onChange={e => setForm({ ...form, maquina: e.target.value })}>{selectableNames(injetoras, 'ativa', form.maquina).map(i => <option key={i}>{i}</option>)}</select>
              </Field>
              <Field label="Produção/dia (peças)"><input type="number" style={styles.input} value={form.prodDia} onChange={e => setForm({ ...form, prodDia: e.target.value })} /></Field>
              <Field label="Peso peça (g)"><input type="number" step="0.01" style={styles.input} value={form.peso} onChange={e => setForm({ ...form, peso: e.target.value })} /></Field>
              <Field label="Cavidades"><input type="number" style={styles.input} value={form.cavidades} onChange={e => setForm({ ...form, cavidades: e.target.value })} /></Field>
            </div>

            <div style={styles.subTitle}>Composição (matérias-primas do produto)</div>
            {form.materials.map((m, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '2 1 220px' }}>
                  <label style={styles.label}>Matéria-prima</label>
                  <select style={styles.input} value={m.rawMaterialCode} onChange={e => updateMaterial(idx, 'rawMaterialCode', e.target.value)}>
                    <option value="">Selecione…</option>
                    {rawMaterials.map(r => <option key={r.code} value={r.code}>{r.code} — {r.descricao}</option>)}
                  </select>
                </div>
                <div style={{ flex: '0 1 110px' }}>
                  <label style={styles.label}>%</label>
                  <input type="number" step="0.1" style={styles.input} value={m.percentual} onChange={e => updateMaterial(idx, 'percentual', e.target.value)} />
                </div>
                <div style={{ ...styles.caption, paddingBottom: 9, minWidth: 70 }}>
                  {m.rawMaterialCode ? `= ${fmt((Number(form.peso) || 0) * (Number(m.percentual) || 0) / 100)} g` : ''}
                </div>
                <button type="button" style={styles.iconBtnDanger} onClick={() => removeMaterialRow(idx)}><Trash2 size={13} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0 14px' }}>
              <button type="button" style={styles.secondaryBtn} onClick={addMaterialRow}><Plus size={14} /> Adicionar matéria-prima</button>
              <span style={{ fontSize: 12, color: totalPct === 100 ? '#4C8C6B' : '#C1462E' }}>Total: {fmt(totalPct, 1)}%</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={styles.primaryBtn}><Save size={14} /> {editingCode ? 'Salvar alterações' : 'Salvar'}</button>
              {editingCode && <button type="button" style={styles.secondaryBtn} onClick={cancelEdit}><X size={14} /> Cancelar</button>}
            </div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Produtos cadastrados ({products.length})</div>
        <Table
          columns={['Código', 'Produto', 'Molde', 'Máquina', 'Peso (g)', 'Composição', 'Cavidades', canEdit ? 'Ações' : null].filter(Boolean)}
          rows={products.map(p => {
            const mats = productMaterials.filter(m => m.product_code === p.code);
            const compStr = mats.length
              ? mats.map(m => `${rmByCode[m.raw_material_code]?.descricao || m.raw_material_code} ${fmt(m.percentual, 1)}% (${fmt((Number(p.peso) || 0) * (Number(m.percentual) || 0) / 100)} g)`).join(' · ')
              : '—';
            return [
              <span style={styles.mono}>{p.code}</span>, p.name, p.molde, p.maquina, fmt(p.peso), compStr, p.cavidades,
              canEdit ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={styles.iconBtn} onClick={() => startEdit(p)}><Pencil size={13} /></button>
                  <button style={styles.iconBtnDanger} onClick={() => remove(p.code)}><Trash2 size={13} /></button>
                </div>
              ) : null,
            ].filter(v => v !== null);
          })}
        />
      </div>
    </div>
  );
}

function Field({ label, children, wide }) {
  return <div style={{ gridColumn: wide ? 'span 2' : 'span 1' }}><label style={styles.label}>{label}</label>{children}</div>;
}

/* ============================== MATÉRIAS-PRIMAS ============================== */

function MateriasPrimasTab({ rawMaterials, setRawMaterials, canEdit, onError }) {
  function emptyForm() { return { code: '', descricao: '', fornecedor: '', tipo: 'Virgem', unidade: 'kg', estoque: '' }; }
  const [form, setForm] = useState(emptyForm());
  const [editingCode, setEditingCode] = useState(null);

  function startEdit(r) {
    setForm({ code: r.code, descricao: r.descricao || '', fornecedor: r.fornecedor || '', tipo: r.tipo || 'Virgem', unidade: r.unidade || 'kg', estoque: r.estoque ?? '' });
    setEditingCode(r.code);
  }
  function cancelEdit() { setForm(emptyForm()); setEditingCode(null); }

  async function submit(e) {
    e.preventDefault();
    if (!form.code || !form.descricao) return;
    try {
      if (editingCode) {
        await api.rawMaterials.update(editingCode, form);
        setRawMaterials(rawMaterials.map(r => r.code === editingCode ? { ...r, ...form } : r));
      } else {
        await api.rawMaterials.create(form);
        setRawMaterials([...rawMaterials, form]);
      }
      setForm(emptyForm());
      setEditingCode(null);
    } catch (e) { onError(e.message); }
  }
  async function remove(code) {
    try {
      await api.rawMaterials.remove(code);
      setRawMaterials(rawMaterials.filter(r => r.code !== code));
      if (editingCode === code) cancelEdit();
    } catch (e) { onError(e.message); }
  }

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{editingCode ? `Editar matéria-prima: ${editingCode}` : 'Nova matéria-prima'}</div>
          <form onSubmit={submit} className="bp-form-grid" style={styles.formGrid}>
            <Field label="Código MP"><input style={styles.input} value={form.code} disabled={!!editingCode} onChange={e => setForm({ ...form, code: e.target.value })} /></Field>
            <Field label="Descrição" wide><input style={styles.input} value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} /></Field>
            <Field label="Fornecedor"><input style={styles.input} value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })} /></Field>
            <Field label="Tipo"><select style={styles.input} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option>Virgem</option><option>Moído</option><option>Pigmento</option></select></Field>
            <Field label="Estoque atual (kg)"><input type="number" style={styles.input} value={form.estoque} onChange={e => setForm({ ...form, estoque: e.target.value })} /></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" style={styles.primaryBtn}>{editingCode ? <><Save size={14} /> Salvar</> : <><Plus size={14} /> Adicionar</>}</button>
              {editingCode && <button type="button" style={styles.secondaryBtn} onClick={cancelEdit}><X size={14} /> Cancelar</button>}
            </div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Matérias-primas ({rawMaterials.length})</div>
        <Table
          columns={['Código', 'Descrição', 'Fornecedor', 'Tipo', 'Estoque (kg)', canEdit ? 'Ações' : null].filter(Boolean)}
          rows={rawMaterials.map(r => [
            <span style={styles.mono}>{r.code}</span>, r.descricao, r.fornecedor, r.tipo, fmt(r.estoque, 0),
            canEdit ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={styles.iconBtn} onClick={() => startEdit(r)}><Pencil size={13} /></button>
                <button style={styles.iconBtnDanger} onClick={() => remove(r.code)}><Trash2 size={13} /></button>
              </div>
            ) : null,
          ].filter(v => v !== null))}
        />
      </div>
    </div>
  );
}

/* ============================== OPERADORES ============================== */

function OperadoresTab({ operators, reloadOperators, canEdit, onError }) {
  function emptyForm() { return { name: '', turno: TURNOS[0], funcao: '' }; }
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { reloadOperators().then(() => setLoaded(true)); /* eslint-disable-next-line */ }, []);

  function startEdit(o) { setEditingId(o.id); setForm({ name: o.name, turno: o.turno || TURNOS[0], funcao: o.funcao || '' }); }
  function cancelEdit() { setEditingId(null); setForm(emptyForm()); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    try {
      if (editingId) await api.operators.update(editingId, form);
      else await api.operators.create(form);
      await reloadOperators();
      setForm(emptyForm()); setEditingId(null);
    } catch (e) { onError(e.message); }
  }
  async function setActive(id, active) {
    try { await api.operators.setActive(id, active); await reloadOperators(); }
    catch (e) { onError(e.message); }
  }

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{editingId ? 'Editar operador' : 'Novo operador'}</div>
          <form onSubmit={submit} className="bp-form-grid" style={styles.formGrid}>
            <Field label="Nome completo" wide><input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Turno">
              <select style={styles.input} value={form.turno} onChange={e => setForm({ ...form, turno: e.target.value })}>
                {TURNOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Função"><input style={styles.input} value={form.funcao} onChange={e => setForm({ ...form, funcao: e.target.value })} placeholder="ex: Operador de injetora" /></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" style={styles.primaryBtn}>{editingId ? <><Save size={14} /> Salvar</> : <><Plus size={14} /> Cadastrar operador</>}</button>
              {editingId && <button type="button" style={styles.secondaryBtn} onClick={cancelEdit}><X size={14} /> Cancelar</button>}
            </div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Operadores cadastrados ({operators.length})</div>
        {!loaded ? <div style={styles.emptyState}>Carregando…</div> : (
          <Table
            columns={['Nome', 'Turno', 'Função', 'Status', canEdit ? 'Ações' : null].filter(Boolean)}
            rows={operators.map(o => [
              o.name, o.turno || '—', o.funcao || '—',
              <span style={{ ...styles.badge, background: (o.active ? '#4C8C6B' : '#8A8F94') + '22', color: o.active ? '#4C8C6B' : '#8A8F94' }}>{o.active ? 'Ativo' : 'Inativo'}</span>,
              canEdit ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={styles.iconBtn} onClick={() => startEdit(o)}><Pencil size={13} /></button>
                  {o.active
                    ? <button style={styles.secondaryBtn} onClick={() => setActive(o.id, false)}>Inativar</button>
                    : <button style={styles.secondaryBtn} onClick={() => setActive(o.id, true)}>Ativar</button>}
                </div>
              ) : null,
            ].filter(v => v !== null))}
          />
        )}
      </div>
    </div>
  );
}

/* ============================== INJETORAS ============================== */

function InjetorasTab({ injetoras, reloadInjetoras, canEdit, onError }) {
  const [nome, setNome] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { reloadInjetoras().then(() => setLoaded(true)); /* eslint-disable-next-line */ }, []);

  function startEdit(i) { setEditingId(i.id); setNome(i.nome); }
  function cancelEdit() { setEditingId(null); setNome(''); }

  async function submit(e) {
    e.preventDefault();
    if (!nome.trim()) return;
    try {
      if (editingId) await api.injetoras.update(editingId, { nome });
      else await api.injetoras.create({ nome });
      await reloadInjetoras();
      setNome(''); setEditingId(null);
    } catch (e) { onError(e.message); }
  }
  async function setActive(id, active) {
    try { await api.injetoras.setActive(id, active); await reloadInjetoras(); }
    catch (e) { onError(e.message); }
  }

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{editingId ? 'Editar injetora' : 'Nova injetora'}</div>
          <form onSubmit={submit} className="bp-form-grid" style={styles.formGrid}>
            <Field label="Nome / identificação" wide><input style={styles.input} value={nome} onChange={e => setNome(e.target.value)} placeholder="ex: INJ-11" /></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" style={styles.primaryBtn}>{editingId ? <><Save size={14} /> Salvar</> : <><Plus size={14} /> Cadastrar injetora</>}</button>
              {editingId && <button type="button" style={styles.secondaryBtn} onClick={cancelEdit}><X size={14} /> Cancelar</button>}
            </div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Injetoras cadastradas ({injetoras.length})</div>
        {!loaded ? <div style={styles.emptyState}>Carregando…</div> : (
          <Table
            columns={['Nome', 'Status', canEdit ? 'Ações' : null].filter(Boolean)}
            rows={injetoras.map(i => [
              i.nome,
              <span style={{ ...styles.badge, background: (i.ativa ? '#4C8C6B' : '#8A8F94') + '22', color: i.ativa ? '#4C8C6B' : '#8A8F94' }}>{i.ativa ? 'Ativa' : 'Inativa'}</span>,
              canEdit ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button style={styles.iconBtn} onClick={() => startEdit(i)}><Pencil size={13} /></button>
                  {i.ativa
                    ? <button style={styles.secondaryBtn} onClick={() => setActive(i.id, false)}>Inativar</button>
                    : <button style={styles.secondaryBtn} onClick={() => setActive(i.id, true)}>Ativar</button>}
                </div>
              ) : null,
            ].filter(v => v !== null))}
          />
        )}
      </div>
    </div>
  );
}

// Nomes selecionáveis num combo (operadores/injetoras ativos), mantendo o valor
// já escolhido selecionável mesmo se ele tiver sido inativado nesse meio-tempo,
// para não travar a edição/criação de um registro que já usava esse valor.
function selectableNames(list, activeField, currentValue) {
  const names = new Set(list.filter(x => x[activeField]).map(x => x.nome ?? x.name));
  if (currentValue) names.add(currentValue);
  return Array.from(names);
}

/* ============================== PROGRAMAÇÃO GERAL ============================== */

// Composição em kg de um produto para uma dada quantidade total em kg,
// a partir da lista flexível de matérias-primas cadastrada em product_materials.
function materialBreakdown(productCode, kgTotal, productMaterials) {
  return productMaterials
    .filter(m => m.product_code === productCode)
    .map(m => ({ rawMaterialCode: m.raw_material_code, percentual: Number(m.percentual) || 0, kg: kgTotal * (Number(m.percentual) || 0) / 100 }));
}

function CompositionList({ materiais, rmByCode }) {
  if (!materiais.length) return <span style={styles.caption}>—</span>;
  return (
    <div>
      {materiais.map(m => (
        <div key={m.rawMaterialCode} style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>
          {rmByCode[m.rawMaterialCode]?.descricao || m.rawMaterialCode}: <b>{fmt(m.kg)} kg</b>
        </div>
      ))}
    </div>
  );
}

function computeOG(og, products, productMaterials) {
  const p = products.find(x => x.code === og.product_code) || {};
  const kgNecessario = (Number(og.qtd_planejada) || 0) * (Number(p.peso) || 0) * (Number(p.cavidades) || 1) / 1000;
  return { ...og, product: p, kgNecessario, materiais: materialBreakdown(og.product_code, kgNecessario, productMaterials) };
}

function ProgramacaoGeralTab({ ordersGeral, setOrdersGeral, products, productMaterials, rawMaterials, canEdit, onError }) {
  function emptyForm() { return { date: '', priority: 'Alta', productCode: products[0]?.code || '', qtdPlanejada: '', status: 'Planejada', prazo: '', obs: '' }; }
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);

  function startEdit(o) {
    setForm({
      date: o.date || '', priority: o.priority || 'Média', productCode: o.product_code,
      qtdPlanejada: o.qtd_planejada ?? '', status: o.status, prazo: o.prazo || '', obs: o.obs || '',
    });
    setEditingId(o.id);
  }
  function cancelEdit() { setForm(emptyForm()); setEditingId(null); }

  async function submit(e) {
    e.preventDefault();
    if (!form.productCode || !form.qtdPlanejada) return;
    try {
      if (editingId) {
        await api.ordersGeral.update(editingId, form);
        setOrdersGeral(ordersGeral.map(o => o.id === editingId
          ? { ...o, date: form.date, priority: form.priority, product_code: form.productCode, qtd_planejada: form.qtdPlanejada, prazo: form.prazo, obs: form.obs }
          : o));
        setForm(emptyForm());
        setEditingId(null);
      } else {
        const created = await api.ordersGeral.create(form);
        setOrdersGeral([...ordersGeral, { id: created.id, date: form.date, priority: form.priority, product_code: form.productCode, qtd_planejada: form.qtdPlanejada, status: form.status, prazo: form.prazo, obs: form.obs }]);
        setForm({ ...form, qtdPlanejada: '', obs: '' });
      }
    } catch (e) { onError(e.message); }
  }
  async function updateStatus(id, status) {
    try { await api.ordersGeral.setStatus(id, status); setOrdersGeral(ordersGeral.map(o => o.id === id ? { ...o, status } : o)); }
    catch (e) { onError(e.message); }
  }
  async function remove(id) {
    try {
      await api.ordersGeral.remove(id);
      setOrdersGeral(ordersGeral.filter(o => o.id !== id));
      if (editingId === id) cancelEdit();
    } catch (e) { onError(e.message); }
  }
  async function confirmarEntrega(id) {
    try {
      await api.ordersGeral.entregarMaterial(id);
      setOrdersGeral(ordersGeral.map(o => o.id === id ? { ...o, entregue_em: new Date().toISOString() } : o));
    } catch (e) { onError(e.message); }
  }

  const rmByCode = Object.fromEntries(rawMaterials.map(r => [r.code, r]));
  const computed = ordersGeral.map(o => computeOG(o, products, productMaterials));

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{editingId ? `Editar OP Geral: ${editingId}` : 'Nova Ordem de Produção Geral'}</div>
          <form onSubmit={submit} className="bp-form-grid" style={styles.formGrid}>
            <Field label="Data"><input type="date" style={styles.input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Prioridade"><select style={styles.input} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{PRIORIDADES.map(p => <option key={p}>{p}</option>)}</select></Field>
            <Field label="Código"><select style={styles.input} value={form.productCode} onChange={e => setForm({ ...form, productCode: e.target.value })}>{products.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}</select></Field>
            <Field label="Qtd. planejada"><input type="number" style={styles.input} value={form.qtdPlanejada} onChange={e => setForm({ ...form, qtdPlanejada: e.target.value })} /></Field>
            <Field label="Prazo"><input type="date" style={styles.input} value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} /></Field>
            <Field label="Observação" wide><input style={styles.input} value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} /></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" style={styles.primaryBtn}>{editingId ? <><Save size={14} /> Salvar</> : <><Plus size={14} /> Criar OP Geral</>}</button>
              {editingId && <button type="button" style={styles.secondaryBtn} onClick={cancelEdit}><X size={14} /> Cancelar</button>}
            </div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Ordens gerais programadas ({computed.length})</div>
        <Table
          columns={['Nº OP', 'Data', 'Prior.', 'Produto', 'Qtd.', 'Kg necessário', 'Composição (kg)', 'Status', 'Material', canEdit ? 'Ações' : null].filter(Boolean)}
          rows={computed.map(o => [
            <span style={styles.mono}>{o.id}</span>, o.date, o.priority, `${o.product_code} — ${o.product.name || '?'}`,
            fmt(o.qtd_planejada, 0), fmt(o.kgNecessario), <CompositionList materiais={o.materiais} rmByCode={rmByCode} />,
            canEdit ? <select style={{ ...styles.input, padding: '4px 6px' }} value={o.status} onChange={e => updateStatus(o.id, e.target.value)}>{STATUS_OP.map(s => <option key={s}>{s}</option>)}</select> : <StatusBadge status={o.status} />,
            o.entregue_em ? (
              <span style={{ ...styles.badge, background: '#4C8C6B22', color: '#4C8C6B' }}>Entregue em {new Date(o.entregue_em).toLocaleDateString('pt-BR')}</span>
            ) : (
              canEdit ? <button style={styles.secondaryBtn} onClick={() => confirmarEntrega(o.id)}>Confirmar entrega</button> : <span style={styles.caption}>Pendente</span>
            ),
            canEdit ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={styles.iconBtn} onClick={() => startEdit(o)}><Pencil size={13} /></button>
                <button style={styles.iconBtnDanger} onClick={() => remove(o.id)}><Trash2 size={13} /></button>
              </div>
            ) : null,
          ].filter(v => v !== null))}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  return <span style={{ ...styles.badge, background: (STATUS_COLOR[status] || '#8A8F94') + '22', color: STATUS_COLOR[status] || '#8A8F94' }}>{status}</span>;
}

/* ============================== DISTRIBUIÇÃO INJETORAS ============================== */

function DistribuicaoTab({ ordersGeral, ordersMaquina, setOrdersMaquina, products, productMaterials, rawMaterials, operators, injetoras, canEdit, onError }) {
  function emptyForm() { return { opGeralId: '', date: '', injetora: injetoras.find(i => i.ativa)?.nome || '', qtdProgramada: '', op1: '', op2: '', op3: '', status: 'Planejada' }; }
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const activeOGs = ordersGeral.filter(o => o.status !== 'Cancelada' && o.status !== 'Concluída');

  function startEdit(o) {
    setForm({
      opGeralId: o.op_geral_id, date: o.date || '', injetora: o.injetora,
      qtdProgramada: o.qtd_programada ?? '', op1: o.op1 || '', op2: o.op2 || '', op3: o.op3 || '', status: o.status,
    });
    setEditingId(o.id);
  }
  function cancelEdit() { setForm(emptyForm()); setEditingId(null); }

  async function submit(e) {
    e.preventDefault();
    if (!form.opGeralId || !form.qtdProgramada) return;
    try {
      if (editingId) {
        await api.ordersMaquina.update(editingId, form);
        setOrdersMaquina(ordersMaquina.map(o => o.id === editingId
          ? { ...o, op_geral_id: form.opGeralId, date: form.date, injetora: form.injetora, qtd_programada: form.qtdProgramada, op1: form.op1, op2: form.op2, op3: form.op3, status: form.status }
          : o));
        setForm(emptyForm());
        setEditingId(null);
      } else {
        const created = await api.ordersMaquina.create(form);
        setOrdersMaquina([...ordersMaquina, { id: created.id, op_geral_id: form.opGeralId, date: form.date, injetora: form.injetora, qtd_programada: form.qtdProgramada, op1: form.op1, op2: form.op2, op3: form.op3, status: form.status }]);
        setForm({ ...form, qtdProgramada: '', op1: '', op2: '', op3: '' });
      }
    } catch (e) { onError(e.message); }
  }
  async function remove(id) {
    try {
      await api.ordersMaquina.remove(id);
      setOrdersMaquina(ordersMaquina.filter(o => o.id !== id));
      if (editingId === id) cancelEdit();
    } catch (e) { onError(e.message); }
  }

  function computeOM(om) {
    const og = ordersGeral.find(o => o.id === om.op_geral_id) || {};
    const p = products.find(x => x.code === og.product_code) || {};
    const kgProgramado = (Number(om.qtd_programada) || 0) * (Number(p.peso) || 0) * (Number(p.cavidades) || 1) / 1000;
    return { ...om, og, product: p, kgProgramado, materiais: materialBreakdown(og.product_code, kgProgramado, productMaterials) };
  }
  const rmByCode = Object.fromEntries(rawMaterials.map(r => [r.code, r]));
  const computed = ordersMaquina.map(computeOM);

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>{editingId ? `Editar OP de Máquina: ${editingId}` : 'Nova distribuição por injetora'}</div>
          <form onSubmit={submit} className="bp-form-grid" style={styles.formGrid}>
            <Field label="OP Geral" wide><select style={styles.input} value={form.opGeralId} onChange={e => setForm({ ...form, opGeralId: e.target.value })}><option value="">Selecione…</option>{activeOGs.map(o => <option key={o.id} value={o.id}>{o.id} — {o.product_code}</option>)}</select></Field>
            <Field label="Data"><input type="date" style={styles.input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Injetora"><select style={styles.input} value={form.injetora} onChange={e => setForm({ ...form, injetora: e.target.value })}>{selectableNames(injetoras, 'ativa', form.injetora).map(i => <option key={i}>{i}</option>)}</select></Field>
            <Field label="Qtd. programada (dia)"><input type="number" style={styles.input} value={form.qtdProgramada} onChange={e => setForm({ ...form, qtdProgramada: e.target.value })} /></Field>
            <Field label="Operador 1º Turno">
              <select style={styles.input} value={form.op1} onChange={e => setForm({ ...form, op1: e.target.value })}>
                <option value="">Selecione…</option>
                {selectableNames(operators, 'active', form.op1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Operador 2º Turno">
              <select style={styles.input} value={form.op2} onChange={e => setForm({ ...form, op2: e.target.value })}>
                <option value="">Selecione…</option>
                {selectableNames(operators, 'active', form.op2).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Operador 3º Turno">
              <select style={styles.input} value={form.op3} onChange={e => setForm({ ...form, op3: e.target.value })}>
                <option value="">Selecione…</option>
                {selectableNames(operators, 'active', form.op3).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" style={styles.primaryBtn}>{editingId ? <><Save size={14} /> Salvar</> : <><Plus size={14} /> Distribuir</>}</button>
              {editingId && <button type="button" style={styles.secondaryBtn} onClick={cancelEdit}><X size={14} /> Cancelar</button>}
            </div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>OPs de máquina ({computed.length})</div>
        <Table
          columns={['Nº OP Máquina', 'OP Geral', 'Injetora', 'Produto', 'Qtd.', 'Composição (kg)', 'Operadores', canEdit ? 'Ações' : null].filter(Boolean)}
          rows={computed.map(o => [
            <span style={styles.mono}>{o.id}</span>, o.op_geral_id, o.injetora, `${o.og.product_code || '?'} — ${o.product.name || ''}`,
            fmt(o.qtd_programada, 0), <CompositionList materiais={o.materiais} rmByCode={rmByCode} />, [o.op1, o.op2, o.op3].filter(Boolean).join(' · ') || '—',
            canEdit ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={styles.iconBtn} onClick={() => startEdit(o)}><Pencil size={13} /></button>
                <button style={styles.iconBtnDanger} onClick={() => remove(o.id)}><Trash2 size={13} /></button>
              </div>
            ) : null,
          ].filter(v => v !== null))}
        />
      </div>
    </div>
  );
}

/* ============================== APONTAMENTO ============================== */

function ApontamentoTab({ ordersMaquina, ordersGeral, products, operators, apontamentos, setApontamentos, canEdit, onError }) {
  const [form, setForm] = useState({ opMaquinaId: '', date: '', turno: TURNOS[0], qtdProduzida: '', refugo: '', horaInicio: '', horaFim: '', parada: '', motivo: '', obs: '', operador: '' });

  function suggestOperador(opMaquinaId, turno) {
    const om = ordersMaquina.find(o => o.id === opMaquinaId);
    if (!om) return '';
    if (turno === '1º Turno') return om.op1 || '';
    if (turno === '2º Turno') return om.op2 || '';
    return om.op3 || '';
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.opMaquinaId) return;
    if (form.qtdProduzida === '' || form.refugo === '' || !form.horaInicio || !form.horaFim) {
      onError('Preencha quantidade produzida, refugo, hora início e hora fim.');
      return;
    }
    try {
      const created = await api.apontamentos.create(form);
      setApontamentos([...apontamentos, {
        id: created.id, op_maquina_id: form.opMaquinaId, date: form.date, turno: form.turno,
        qtd_produzida: form.qtdProduzida, refugo: form.refugo, hora_inicio: form.horaInicio, hora_fim: form.horaFim,
        parada: form.parada, motivo: form.motivo, obs: form.obs, operador: created.operador,
      }]);
      setForm({ ...form, qtdProduzida: '', refugo: '', horaInicio: '', horaFim: '', parada: '', motivo: '', obs: '' });
    } catch (e) { onError(e.message); }
  }
  async function remove(id) {
    try { await api.apontamentos.remove(id); setApontamentos(apontamentos.filter(a => a.id !== id)); }
    catch (e) { onError(e.message); }
  }

  function computeAP(ap) {
    const om = ordersMaquina.find(o => o.id === ap.op_maquina_id) || {};
    const og = ordersGeral.find(o => o.id === om.op_geral_id) || {};
    const p = products.find(x => x.code === og.product_code) || {};
    const qtdBoa = (Number(ap.qtd_produzida) || 0) - (Number(ap.refugo) || 0);
    const atingimento = om.qtd_programada ? (qtdBoa / Number(om.qtd_programada)) * 100 : 0;
    const kgConsumido = (Number(ap.qtd_produzida) || 0) * (Number(p.peso) || 0) * (Number(p.cavidades) || 1) / 1000;
    return { ...ap, qtdBoa, atingimento, kgConsumido };
  }
  const computed = apontamentos.map(computeAP);

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Novo apontamento</div>
          <form onSubmit={submit} className="bp-form-grid" style={styles.formGrid}>
            <Field label="OP Máquina" wide>
              <select style={styles.input} value={form.opMaquinaId} onChange={e => { const opMaquinaId = e.target.value; setForm({ ...form, opMaquinaId, operador: suggestOperador(opMaquinaId, form.turno) }); }}>
                <option value="">Selecione…</option>
                {ordersMaquina.map(o => <option key={o.id} value={o.id}>{o.id} — {o.injetora}</option>)}
              </select>
            </Field>
            <Field label="Data"><input type="date" style={styles.input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Turno">
              <select style={styles.input} value={form.turno} onChange={e => { const turno = e.target.value; setForm({ ...form, turno, operador: suggestOperador(form.opMaquinaId, turno) }); }}>
                {TURNOS.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Operador">
              <select style={styles.input} value={form.operador} onChange={e => setForm({ ...form, operador: e.target.value })}>
                <option value="">Selecione…</option>
                {selectableNames(operators, 'active', form.operador).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Qtd. produzida"><input type="number" required style={styles.input} value={form.qtdProduzida} onChange={e => setForm({ ...form, qtdProduzida: e.target.value })} /></Field>
            <Field label="Refugo (peças)"><input type="number" required style={styles.input} value={form.refugo} onChange={e => setForm({ ...form, refugo: e.target.value })} /></Field>
            <Field label="Hora início"><input type="time" required style={styles.input} value={form.horaInicio} onChange={e => setForm({ ...form, horaInicio: e.target.value })} /></Field>
            <Field label="Hora fim"><input type="time" required style={styles.input} value={form.horaFim} onChange={e => setForm({ ...form, horaFim: e.target.value })} /></Field>
            <Field label="Parada (min)"><input type="number" style={styles.input} value={form.parada} onChange={e => setForm({ ...form, parada: e.target.value })} /></Field>
            <Field label="Motivo da parada" wide><input style={styles.input} value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} /></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="submit" style={styles.primaryBtn}><Plus size={14} /> Registrar</button></div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Apontamentos ({computed.length})</div>
        <Table
          columns={['Nº', 'OP Máquina', 'Turno', 'Operador', 'Produzida', 'Refugo', 'Boa', 'Atingimento', 'Kg consumido', canEdit ? 'Ações' : null].filter(Boolean)}
          rows={computed.map(a => [
            <span style={styles.mono}>{a.id}</span>, a.op_maquina_id, a.turno, a.operador || '—',
            fmt(a.qtd_produzida, 0), fmt(a.refugo, 0), fmt(a.qtdBoa, 0), `${fmt(a.atingimento, 1)}%`, fmt(a.kgConsumido),
            canEdit ? <button style={styles.iconBtnDanger} onClick={() => remove(a.id)}><Trash2 size={13} /></button> : null,
          ].filter(v => v !== null))}
        />
      </div>
    </div>
  );
}

/* ============================== OP PARA IMPRESSÃO ============================== */

function OpImpressaoTab({ ordersMaquina, ordersGeral, products, productMaterials, rawMaterials, canEdit }) {
  const [mode, setMode] = useState('maquina');
  const rmByCode = Object.fromEntries(rawMaterials.map(r => [r.code, r]));

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Documento a imprimir</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={mode === 'geral' ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setMode('geral')}>OP Geral (Almoxarifado)</button>
          <button type="button" style={mode === 'maquina' ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setMode('maquina')}>OP de Máquina (Injetora)</button>
        </div>
      </div>
      {mode === 'geral'
        ? <OpGeralImpressao ordersGeral={ordersGeral} products={products} productMaterials={productMaterials} rmByCode={rmByCode} />
        : <OpMaquinaImpressao ordersMaquina={ordersMaquina} ordersGeral={ordersGeral} products={products} canEdit={canEdit} />}
    </div>
  );
}

// Documento para o líder do Almoxarifado: mostra a composição completa de
// matéria-prima da OP Geral (todas as injetoras que vão consumi-la, somadas).
function OpGeralImpressao({ ordersGeral, products, productMaterials, rmByCode }) {
  const [selected, setSelected] = useState('');
  const og = ordersGeral.find(o => o.id === selected);
  const p = og ? products.find(x => x.code === og.product_code) : null;
  const kgNecessario = og ? (Number(og.qtd_planejada) || 0) * (Number(p?.peso) || 0) * (Number(p?.cavidades) || 1) / 1000 : 0;
  const materiais = og ? materialBreakdown(og.product_code, kgNecessario, productMaterials) : [];

  return (
    <div>
      <div style={styles.card}>
        <select style={styles.input} value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Selecione a OP Geral…</option>
          {ordersGeral.map(o => <option key={o.id} value={o.id}>{o.id} — {o.product_code}</option>)}
        </select>
      </div>
      {og && (
        <div style={styles.card}>
          <div style={styles.printHeader}>
            <div>
              <div style={styles.cardTitle}>Ordem de Produção Geral — {og.id}</div>
              <div style={styles.caption}>Destino: Líder do Almoxarifado · Data {og.date || '—'} · Prazo {og.prazo || '—'}</div>
            </div>
            <button style={styles.secondaryBtn} onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
          </div>
          <div className="bp-grid-2" style={{ gap: 10, marginTop: 10 }}>
            <InfoRow label="Código" value={og.product_code} />
            <InfoRow label="Produto" value={p?.name} />
            <InfoRow label="Qtd. planejada (peças)" value={fmt(og.qtd_planejada, 0)} />
            <InfoRow label="Kg total necessário" value={`${fmt(kgNecessario)} kg`} />
          </div>
          <div style={styles.subTitle}>Composição de matéria-prima a separar</div>
          <Table
            columns={['Matéria-prima', '%', 'Kg necessário']}
            rows={materiais.map(m => [rmByCode[m.rawMaterialCode]?.descricao || m.rawMaterialCode, `${fmt(m.percentual, 1)}%`, `${fmt(m.kg)} kg`])}
          />
        </div>
      )}
    </div>
  );
}

// Documento para quem abastece a máquina: fluxo original, por injetora.
function OpMaquinaImpressao({ ordersMaquina, ordersGeral, products, canEdit }) {
  const [selected, setSelected] = useState('');
  const [checklist, setChecklist] = useState({ molde: false, maquina: false, peca: false, material: false, cor: false, liberada: false });

  const om = ordersMaquina.find(o => o.id === selected);
  const og = om ? ordersGeral.find(o => o.id === om.op_geral_id) : null;
  const p = og ? products.find(x => x.code === og.product_code) : null;

  return (
    <div>
      <div style={styles.card}>
        <select style={styles.input} value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Selecione a OP de máquina…</option>
          {ordersMaquina.map(o => <option key={o.id} value={o.id}>{o.id} — {o.injetora}</option>)}
        </select>
      </div>

      {om && (
        <div style={styles.card}>
          <div style={styles.printHeader}>
            <div>
              <div style={styles.cardTitle}>Ordem de Produção — {om.id}</div>
              <div style={styles.caption}>Destino: abastecimento de máquina · Injetora {om.injetora} · Data {om.date || '—'}</div>
            </div>
            <button style={styles.secondaryBtn} onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
          </div>
          <div className="bp-grid-2" style={{ gap: 10, marginTop: 10 }}>
            <InfoRow label="Código" value={og?.product_code} />
            <InfoRow label="Produto" value={p?.name} />
            <InfoRow label="Molde" value={p?.molde} />
            <InfoRow label="Qtd. programada" value={fmt(om.qtd_programada, 0)} />
          </div>
          <div style={styles.subTitle}>Operadores por turno</div>
          <div className="bp-grid-3" style={{ gap: 10 }}>
            <InfoRow label="1º Turno" value={om.op1 || '—'} />
            <InfoRow label="2º Turno" value={om.op2 || '—'} />
            <InfoRow label="3º Turno" value={om.op3 || '—'} />
          </div>
          <div style={styles.subTitle}>Checklist de liberação {canEdit ? '' : '(somente leitura)'}</div>
          <div className="bp-grid-2" style={{ gap: 8 }}>
            {Object.entries({ molde: 'Molde conferido', maquina: 'Máquina regulada', peca: 'Peça piloto aprovada', material: 'Material separado', cor: 'Cor aprovada', liberada: 'Ordem liberada' }).map(([k, label]) => (
              <label key={k} style={styles.checkRow}>
                <input type="checkbox" disabled={!canEdit} checked={checklist[k]} onChange={e => setChecklist({ ...checklist, [k]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return <div><div style={styles.caption}>{label}</div><div style={{ fontWeight: 600 }}>{value || '—'}</div></div>;
}

/* ============================== CONSOLIDADO MP DO DIA ============================== */

function ConsolidadoMPTab({ ordersMaquina, ordersGeral, products, productMaterials, rawMaterials }) {
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const filtered = ordersMaquina.filter(o => (!dateStart || o.date >= dateStart) && (!dateEnd || o.date <= dateEnd));
  const rmByCode = Object.fromEntries(rawMaterials.map(r => [r.code, r]));

  const aggregated = {};
  const rows = filtered.map(om => {
    const og = ordersGeral.find(o => o.id === om.op_geral_id) || {};
    const p = products.find(x => x.code === og.product_code) || {};
    const kg = (Number(om.qtd_programada) || 0) * (Number(p.peso) || 0) * (Number(p.cavidades) || 1) / 1000;
    const materiais = materialBreakdown(og.product_code, kg, productMaterials);
    materiais.forEach(m => { aggregated[m.rawMaterialCode] = (aggregated[m.rawMaterialCode] || 0) + m.kg; });
    return { om, p, kg, materiais };
  });

  const totals = rows.reduce((acc, r) => ({
    kg: acc.kg + r.kg, pecas: acc.pecas + (Number(r.om.qtd_programada) || 0),
  }), { kg: 0, pecas: 0 });

  const aggregatedRows = Object.entries(aggregated).map(([code, kg]) => [rmByCode[code]?.descricao || code, fmt(kg)]);

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.printHeader}>
          <div>
            <div style={styles.cardTitle}>Separação de matéria-prima do dia</div>
            <div style={styles.caption}>{dateStart || dateEnd ? `Período: ${dateStart || '—'} a ${dateEnd || '—'}` : 'Todas as datas'}</div>
          </div>
          <button style={styles.secondaryBtn} onClick={() => window.print()}><Printer size={14} /> Imprimir</button>
        </div>
        <div className="bp-grid-2" style={{ gap: 12, marginTop: 10 }}>
          <Field label="Data início"><input type="date" style={styles.input} value={dateStart} onChange={e => setDateStart(e.target.value)} /></Field>
          <Field label="Data fim"><input type="date" style={styles.input} value={dateEnd} onChange={e => setDateEnd(e.target.value)} /></Field>
        </div>
      </div>
      <div className="bp-kpi-grid" style={styles.kpiGrid}>
        <Kpi label="Peças programadas" value={fmt(totals.pecas, 0)} />
        <Kpi label="Kg total" value={fmt(totals.kg)} />
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Necessidade de matéria-prima do dia</div>
        <Table columns={['Matéria-prima', 'Kg necessário']} rows={aggregatedRows} />
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>OPs do dia ({rows.length})</div>
        <Table columns={['OP Máquina', 'Injetora', 'Produto', 'Qtd.', 'Composição (kg)']} rows={rows.map(r => [r.om.id, r.om.injetora, r.p.name || '—', fmt(r.om.qtd_programada, 0), <CompositionList materiais={r.materiais} rmByCode={rmByCode} />])} />
      </div>
    </div>
  );
}

/* ============================== ESTOQUE ============================== */

function EstoqueTab({ rawMaterials, setRawMaterials, products, canEdit, onError }) {
  const [mode, setMode] = useState('visao'); // 'visao' | 'entrada' | 'historico'

  return (
    <div>
      <div style={styles.card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={mode === 'visao' ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setMode('visao')}>Visão geral</button>
          {canEdit && <button type="button" style={mode === 'entrada' ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setMode('entrada')}>Entrada de nota fiscal</button>}
          <button type="button" style={mode === 'historico' ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setMode('historico')}>Histórico</button>
        </div>
      </div>
      {mode === 'visao' && <EstoqueVisaoGeral rawMaterials={rawMaterials} products={products} />}
      {mode === 'entrada' && canEdit && <EstoqueEntradaNF rawMaterials={rawMaterials} setRawMaterials={setRawMaterials} onError={onError} />}
      {mode === 'historico' && <EstoqueHistorico onError={onError} />}
    </div>
  );
}

function EstoqueVisaoGeral({ rawMaterials, products }) {
  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Matéria-prima (kg)</div>
        <Table
          columns={['Código', 'Descrição', 'Estoque']}
          rows={rawMaterials.map(r => [<span style={styles.mono}>{r.code}</span>, r.descricao, fmt(r.estoque, 0)])}
        />
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Em processo (kg)</div>
        <div style={styles.caption}>Material já entregue no chão de fábrica pra uma OP, ainda não consumido em apontamento.</div>
        <Table
          columns={['Código', 'Descrição', 'Em processo']}
          rows={rawMaterials.map(r => [<span style={styles.mono}>{r.code}</span>, r.descricao, fmt(r.estoque_em_processo, 0)])}
        />
      </div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Produto acabado (peças)</div>
        <Table
          columns={['Código', 'Produto', 'Estoque']}
          rows={products.map(p => [<span style={styles.mono}>{p.code}</span>, p.name, fmt(p.estoque_pa, 0)])}
        />
      </div>
    </div>
  );
}

function EstoqueEntradaNF({ rawMaterials, setRawMaterials, onError }) {
  const [xmlMode, setXmlMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [manual, setManual] = useState({ rawMaterialCode: rawMaterials[0]?.code || '', quantidade: '', referencia: '', obs: '' });

  async function refreshRawMaterials() {
    const list = await api.rawMaterials.list();
    setRawMaterials(list);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const data = await api.stock.nfeParse(text);
      setPreview({ ...data, itens: data.itens.map(i => ({ ...i, quantidade: i.qCom })) });
    } catch (err) { onError(err.message); }
    setBusy(false);
  }

  function updateItem(idx, field, value) {
    setPreview(p => ({ ...p, itens: p.itens.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }));
  }

  async function confirmarNF() {
    setBusy(true);
    try {
      const itens = preview.itens.map(i => ({ rawMaterialCode: i.rawMaterialCode, quantidade: i.quantidade, xProd: i.xProd }));
      await api.stock.nfeConfirmar({ referencia: preview.nNF, itens });
      setPreview(null);
      await refreshRawMaterials();
    } catch (err) { onError(err.message); }
    setBusy(false);
  }

  async function submitManual(e) {
    e.preventDefault();
    if (!manual.rawMaterialCode || !manual.quantidade) return;
    setBusy(true);
    try {
      await api.stock.entradaManual(manual);
      setManual({ ...manual, quantidade: '', referencia: '', obs: '' });
      await refreshRawMaterials();
    } catch (err) { onError(err.message); }
    setBusy(false);
  }

  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button type="button" style={xmlMode ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setXmlMode(true)}>Por XML da nota</button>
        <button type="button" style={!xmlMode ? styles.primaryBtn : styles.secondaryBtn} onClick={() => setXmlMode(false)}>Lançar manualmente</button>
      </div>

      {xmlMode ? (
        <div>
          <label style={styles.label}>Arquivo XML da nota fiscal</label>
          <input type="file" accept=".xml,text/xml" onChange={handleFile} disabled={busy} />
          {preview && (
            <div style={{ marginTop: 16 }}>
              <div style={styles.subTitle}>NF {preview.nNF || '?'} — {preview.emitente || 'emitente não identificado'}</div>
              <Table
                columns={['Cód. na NF', 'Descrição na NF', 'Quantidade', 'Un.', 'Matéria-prima vinculada']}
                rows={preview.itens.map((it, idx) => [
                  it.cProd || '—', it.xProd || '—',
                  <input type="number" step="0.01" style={{ ...styles.input, width: 100 }} value={it.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} />,
                  it.uCom || '—',
                  <select style={styles.input} value={it.rawMaterialCode || ''} onChange={e => updateItem(idx, 'rawMaterialCode', e.target.value || null)}>
                    <option value="">— não vinculado —</option>
                    {rawMaterials.map(r => <option key={r.code} value={r.code}>{r.code} — {r.descricao}</option>)}
                  </select>,
                ])}
              />
              <div style={{ ...styles.caption, marginTop: 8 }}>Itens sem matéria-prima vinculada não entram no estoque ao confirmar — cadastre a matéria-prima em Matérias-Primas se precisar, depois refaça o upload.</div>
              <button type="button" style={{ ...styles.primaryBtn, marginTop: 12 }} disabled={busy} onClick={confirmarNF}><Save size={14} /> Confirmar entrada</button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submitManual} className="bp-form-grid" style={styles.formGrid}>
          <Field label="Matéria-prima">
            <select style={styles.input} value={manual.rawMaterialCode} onChange={e => setManual({ ...manual, rawMaterialCode: e.target.value })}>
              {rawMaterials.map(r => <option key={r.code} value={r.code}>{r.code} — {r.descricao}</option>)}
            </select>
          </Field>
          <Field label="Quantidade (kg)"><input type="number" step="0.01" style={styles.input} value={manual.quantidade} onChange={e => setManual({ ...manual, quantidade: e.target.value })} /></Field>
          <Field label="Referência (nº da nota)"><input style={styles.input} value={manual.referencia} onChange={e => setManual({ ...manual, referencia: e.target.value })} /></Field>
          <Field label="Observação" wide><input style={styles.input} value={manual.obs} onChange={e => setManual({ ...manual, obs: e.target.value })} /></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="submit" style={styles.primaryBtn} disabled={busy}><Plus size={14} /> Lançar entrada</button></div>
        </form>
      )}
    </div>
  );
}

const STOCK_MOVEMENT_LABELS = {
  entrada_mp: 'Entrada Matéria-Prima',
  ajuste_mp: 'Ajuste manual MP',
  transferencia_processo: 'MP → Em Processo',
  consumo_processo: 'Consumo em Processo',
  entrada_pa: 'Entrada Produto Acabado',
};

function EstoqueHistorico({ onError }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.stock.movements().then(setRows).catch(e => onError(e.message)).finally(() => setLoaded(true));
    // eslint-disable-next-line
  }, []);

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Movimentações de estoque</div>
      {!loaded ? <div style={styles.emptyState}>Carregando…</div> : (
        <Table
          columns={['Data', 'Tipo', 'Item', 'Quantidade', 'Referência', 'Usuário']}
          rows={rows.map(m => [
            new Date(m.created_at).toLocaleString('pt-BR'),
            STOCK_MOVEMENT_LABELS[m.tipo] || m.tipo,
            m.raw_material_code || m.product_code || '—',
            fmt(m.quantidade), m.referencia || '—', m.usuario || '—',
          ])}
        />
      )}
    </div>
  );
}

/* ============================== COMPARATIVO MENSAL ============================== */

function ComparativoMensalTab({ apontamentos, ordersMaquina, injetoras }) {
  const [ano, setAno] = useState(String(new Date().getFullYear()));

  const matrix = injetoras.map(i => {
    const inj = i.nome;
    const omIds = new Set(ordersMaquina.filter(o => o.injetora === inj).map(o => o.id));
    const meses = MESES.map((_, mIdx) => apontamentos.filter(a => {
      if (!omIds.has(a.op_maquina_id) || !a.date) return false;
      const d = new Date(a.date + 'T00:00:00');
      return d.getFullYear() === Number(ano) && d.getMonth() === mIdx;
    }).reduce((s, a) => s + Number(a.qtd_produzida || 0), 0));
    return { inj, meses, total: meses.reduce((s, v) => s + v, 0) };
  });
  const totalGeral = MESES.map((_, mIdx) => matrix.reduce((s, r) => s + r.meses[mIdx], 0));

  return (
    <div>
      <div style={styles.card}><Field label="Ano de referência"><input style={styles.input} value={ano} onChange={e => setAno(e.target.value)} /></Field></div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Produção por injetora — {ano}</div>
        <div style={{ overflowX: 'auto' }}>
          <Table columns={['Injetora', ...MESES, 'Total']} rows={[...matrix.map(r => [r.inj, ...r.meses.map(v => fmt(v, 0)), fmt(r.total, 0)]), ['TOTAL GERAL', ...totalGeral.map(v => fmt(v, 0)), fmt(totalGeral.reduce((s, v) => s + v, 0), 0)]]} />
        </div>
      </div>
    </div>
  );
}

/* ============================== PRODUÇÃO x PERDAS OPERADORES ============================== */

function PerdasOperadoresTab({ apontamentos, products, ordersMaquina, ordersGeral }) {
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [mes, setMes] = useState('');

  const filtered = apontamentos.filter(a => {
    if (!a.date) return false;
    const d = new Date(a.date + 'T00:00:00');
    if (d.getFullYear() !== Number(ano)) return false;
    if (mes && (d.getMonth() + 1) !== Number(mes)) return false;
    return true;
  });

  const byOperador = {};
  filtered.forEach(a => {
    const key = a.operador || 'Não informado';
    if (!byOperador[key]) byOperador[key] = { produzida: 0, refugo: 0, kg: 0 };
    const om = ordersMaquina.find(o => o.id === a.op_maquina_id);
    const og = om ? ordersGeral.find(o => o.id === om.op_geral_id) : null;
    const p = og ? products.find(x => x.code === og.product_code) : null;
    byOperador[key].produzida += Number(a.qtd_produzida || 0);
    byOperador[key].refugo += Number(a.refugo || 0);
    byOperador[key].kg += (Number(a.qtd_produzida) || 0) * (Number(p?.peso) || 0) * (Number(p?.cavidades) || 1) / 1000;
  });

  const rows = Object.entries(byOperador).map(([op, v]) => {
    const boa = v.produzida - v.refugo;
    const pctRefugo = v.produzida ? (v.refugo / v.produzida) * 100 : 0;
    return [op, fmt(v.produzida, 0), fmt(v.refugo, 0), fmt(boa, 0), `${fmt(pctRefugo, 1)}%`, fmt(v.kg)];
  });

  return (
    <div>
      <div style={styles.card}>
        <div className="bp-grid-2" style={{ gap: 12 }}>
          <Field label="Ano"><input style={styles.input} value={ano} onChange={e => setAno(e.target.value)} /></Field>
          <Field label="Mês (1-12, vazio = ano todo)"><input style={styles.input} value={mes} onChange={e => setMes(e.target.value)} /></Field>
        </div>
      </div>
      <div style={styles.card}><div style={styles.cardTitle}>Produção x perdas por operador</div><Table columns={['Operador', 'Qtd. produzida', 'Refugo', 'Qtd. boa', '% Refugo', 'Kg consumido']} rows={rows} /></div>
    </div>
  );
}

/* ============================== USUÁRIOS ============================== */

function UsuariosTab({ users, reloadUsers, canEdit, currentUser, onError }) {
  const [form, setForm] = useState({ username: '', password: '', name: '', role: 'operador' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { reloadUsers().then(() => setLoaded(true)); /* eslint-disable-next-line */ }, []);

  async function submit(e) {
    e.preventDefault();
    if (!form.username || !form.password || !form.name) return;
    try { await api.users.create(form); await reloadUsers(); setForm({ username: '', password: '', name: '', role: 'operador' }); }
    catch (e) { onError(e.message); }
  }
  async function remove(id) {
    if (id === currentUser.id) return;
    try { await api.users.remove(id); await reloadUsers(); } catch (e) { onError(e.message); }
  }
  async function setRole(id, role) {
    try { await api.users.setRole(id, role); await reloadUsers(); } catch (e) { onError(e.message); }
  }

  return (
    <div>
      {canEdit && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>Novo usuário</div>
          <form onSubmit={submit} className="bp-form-grid" style={styles.formGrid}>
            <Field label="Nome completo" wide><input style={styles.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Usuário (login)"><input style={styles.input} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></Field>
            <Field label="Senha"><input style={styles.input} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></Field>
            <Field label="Perfil / hierarquia"><select style={styles.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}><button type="submit" style={styles.primaryBtn}><Plus size={14} /> Criar usuário</button></div>
          </form>
        </div>
      )}
      <div style={styles.card}>
        <div style={styles.cardTitle}>Usuários cadastrados ({users.length})</div>
        {!loaded ? <div style={styles.emptyState}>Carregando…</div> : (
          <Table
            columns={['Nome', 'Login', 'Perfil', canEdit ? 'Ações' : null].filter(Boolean)}
            rows={users.map(u => [
              u.name, <span style={styles.mono}>{u.username}</span>,
              <span style={{ ...styles.badge, background: ROLE_STRIPE[u.role] + '22', color: ROLE_STRIPE[u.role] }}>{ROLE_LABELS[u.role]}</span>,
              canEdit ? (
                u.id === currentUser.id ? <span style={styles.caption}>(você)</span> : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select style={{ ...styles.input, width: 'auto', padding: '4px 6px', fontSize: 12 }} value={u.role} onChange={e => setRole(u.id, e.target.value)}>
                      {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button style={styles.iconBtnDanger} onClick={() => remove(u.id)}><Trash2 size={13} /></button>
                  </div>
                )
              ) : null,
            ].filter(v => v !== null))}
          />
        )}
      </div>
    </div>
  );
}

/* ============================== PERMISSÕES ============================== */

function PermissoesTab({ permissionsMatrix, reloadPermissions, canEdit, onError }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { reloadPermissions().then(() => setLoaded(true)); /* eslint-disable-next-line */ }, []);

  async function toggle(tabId, kind, role) {
    if (!canEdit || !permissionsMatrix) return;
    const cfg = permissionsMatrix[tabId];
    const has = cfg[kind].includes(role);
    const nextView = kind === 'view' ? !has : cfg.view.includes(role);
    const nextEdit = kind === 'edit' ? !has : cfg.edit.includes(role);
    try {
      await api.permissions.set(tabId, role, nextEdit ? true : nextView, nextEdit);
      await reloadPermissions();
    } catch (e) { onError(e.message); }
  }

  if (!loaded || !permissionsMatrix) return <div style={styles.emptyState}>Carregando matriz de permissões…</div>;

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.cardTitle}>Controle de permissões por aba</div>
        <div style={styles.caption}>Marque quem pode <b>ver</b> e quem pode <b>editar</b> cada aba do sistema. Editar exige acesso de visualização. As mudanças aqui valem para todos os usuários daquele perfil, em qualquer máquina.</div>
      </div>
      <div style={styles.card}>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Aba</th>
                {ASSIGNABLE_ROLES.map(r => <th key={r} style={{ ...styles.th, textAlign: 'center' }}><div style={{ ...styles.roleStripeSmall, background: ROLE_STRIPE[r] }} />{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {TABS.map(t => (
                <tr key={t.id}>
                  <td style={styles.td}>{t.label}</td>
                  {ASSIGNABLE_ROLES.map(r => (
                    <td key={r} style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                        <label style={styles.permLabel} title="Ver"><input type="checkbox" disabled={!canEdit} checked={permissionsMatrix[t.id].view.includes(r)} onChange={() => toggle(t.id, 'view', r)} /><Eye size={12} /></label>
                        <label style={styles.permLabel} title="Editar"><input type="checkbox" disabled={!canEdit} checked={permissionsMatrix[t.id].edit.includes(r)} onChange={() => toggle(t.id, 'edit', r)} /><Unlock size={12} /></label>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== SHARED UI ============================== */

function Table({ columns, rows }) {
  if (!rows.length) return <div style={styles.emptyState}>Nenhum registro ainda.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead><tr>{columns.map((c, i) => <th key={i} style={styles.th}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={styles.td}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      input, select, button { font-family: var(--font-body); }
      input:focus, select:focus { outline: 2px solid #E8A324; outline-offset: 1px; }
      button:focus-visible { outline: 2px solid #E8A324; outline-offset: 2px; }

      /* O sistema já tem seu próprio botão de mostrar/ocultar senha — some com
         o ícone nativo do navegador (Edge/IE) pra não ficar duplicado por cima. */
      input[type="password"]::-ms-reveal, input[type="password"]::-ms-clear { display: none; }

      .bp-sidebar { width: 250px; min-width: 250px; }
      .bp-menu-btn { display: none; }
      .bp-content { padding: 22px; }
      .bp-form-grid { grid-template-columns: repeat(4, 1fr); }
      .bp-kpi-grid { grid-template-columns: repeat(4, 1fr); }
      .bp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
      .bp-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; }
      .bp-login-card { width: 380px; }
      .bp-sidebar-backdrop { display: none; }

      @media (max-width: 900px) {
        .bp-sidebar {
          position: fixed; top: 0; left: -260px; height: 100vh; z-index: 60;
          transition: left 0.2s ease;
          box-shadow: 4px 0 24px rgba(0,0,0,0.3);
        }
        .bp-sidebar.sidebar-open { left: 0; }
        .bp-menu-btn { display: inline-flex; }
        .bp-form-grid { grid-template-columns: repeat(2, 1fr); }
        .bp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
        .bp-sidebar-backdrop.show {
          display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 55;
        }
      }

      @media (max-width: 600px) {
        .bp-content { padding: 14px; }
        .bp-form-grid { grid-template-columns: 1fr; }
        .bp-kpi-grid { grid-template-columns: 1fr; }
        .bp-grid-2 { grid-template-columns: 1fr; }
        .bp-grid-3 { grid-template-columns: 1fr; }
        .bp-login-card { width: 100%; padding: 20px; }
      }
    `}</style>
  );
}
