import {
  LayoutDashboard, Package, Beaker, ClipboardList, Factory, ClipboardCheck,
  Printer, Boxes, BarChart3, Users2, ShieldCheck, HardHat, Cog, Warehouse,
} from 'lucide-react';

export const ROLES = ['admin', 'pcp', 'operador', 'almoxarifado', 'qualidade', 'gerencia', 'pendente'];

// Perfis que um Administrador pode atribuir na criação de usuário e que
// aparecem como coluna na matriz de Permissões — "pendente" fica de fora
// dos dois: ninguém cria um usuário já pendente, e quem está pendente nunca
// chega na tela de abas mesmo (ver PendingApprovalScreen em App.jsx).
export const ASSIGNABLE_ROLES = ROLES.filter(r => r !== 'pendente');

export const ROLE_LABELS = {
  admin: 'Administrador',
  pcp: 'PCP / Engenharia',
  operador: 'Operador',
  almoxarifado: 'Almoxarifado',
  qualidade: 'Qualidade',
  gerencia: 'Gerência',
  pendente: 'Pendente de Aprovação',
};

export const ROLE_STRIPE = {
  admin: '#E8A324',
  pcp: '#3E6E91',
  operador: '#4C8C6B',
  almoxarifado: '#8B5FB0',
  qualidade: '#C1462E',
  gerencia: '#1B1D1F',
  pendente: '#9A9FA4',
};

export const TABS = [
  { id: 'dashboard', label: 'Dashboard', group: 'Geral', icon: LayoutDashboard },
  { id: 'cadastros', label: 'Cadastros', group: 'Cadastros', icon: Package },
  { id: 'materiasPrimas', label: 'Matérias-Primas', group: 'Cadastros', icon: Beaker },
  { id: 'operadores', label: 'Operadores', group: 'Cadastros', icon: HardHat },
  { id: 'injetoras', label: 'Injetoras', group: 'Cadastros', icon: Cog },
  { id: 'programacaoGeral', label: 'Programação Geral', group: 'Produção', icon: ClipboardList },
  { id: 'distribuicaoInjetoras', label: 'Distribuição Injetoras', group: 'Produção', icon: Factory },
  { id: 'apontamento', label: 'Apontamento', group: 'Produção', icon: ClipboardCheck },
  { id: 'opImpressao', label: 'OP para Impressão', group: 'Produção', icon: Printer },
  { id: 'consolidadoMP', label: 'Consolidado MP do Dia', group: 'Almoxarifado', icon: Boxes },
  { id: 'estoque', label: 'Estoque', group: 'Almoxarifado', icon: Warehouse },
  { id: 'comparativoMensal', label: 'Comparativo Mensal', group: 'Relatórios', icon: BarChart3 },
  { id: 'perdasOperadores', label: 'Produção x Perdas', group: 'Relatórios', icon: BarChart3 },
  { id: 'usuarios', label: 'Usuários', group: 'Administração', icon: Users2 },
  { id: 'permissoes', label: 'Permissões', group: 'Administração', icon: ShieldCheck },
];

export const TURNOS = ['1º Turno', '2º Turno', '3º Turno'];
export const STATUS_OP = ['Planejada', 'Liberada', 'Em produção', 'Concluída', 'Cancelada'];
export const PRIORIDADES = ['Alta', 'Média', 'Baixa'];
export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const STATUS_COLOR = {
  Planejada: '#8A8F94', Liberada: '#3E6E91', 'Em produção': '#E8A324',
  Concluída: '#4C8C6B', Cancelada: '#C1462E',
};

export function fmt(n, d = 2) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
