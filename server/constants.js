const ROLES = ['admin', 'pcp', 'operador', 'almoxarifado', 'qualidade', 'gerencia'];

const ROLE_LABELS = {
  admin: 'Administrador',
  pcp: 'PCP / Engenharia',
  operador: 'Operador',
  almoxarifado: 'Almoxarifado',
  qualidade: 'Qualidade',
  gerencia: 'Gerência',
};

const TABS = [
  'dashboard', 'cadastros', 'materiasPrimas', 'operadores', 'injetoras', 'programacaoGeral',
  'distribuicaoInjetoras', 'apontamento', 'opImpressao', 'consolidadoMP',
  'comparativoMensal', 'perdasOperadores', 'usuarios', 'permissoes',
];

// [tabId]: { view: [roles...], edit: [roles...] }
const DEFAULT_PERMISSIONS = {
  dashboard: { view: ['admin', 'pcp', 'operador', 'almoxarifado', 'qualidade', 'gerencia'], edit: [] },
  cadastros: { view: ['admin', 'pcp', 'gerencia'], edit: ['admin', 'pcp'] },
  materiasPrimas: { view: ['admin', 'pcp', 'almoxarifado', 'gerencia'], edit: ['admin', 'pcp', 'almoxarifado'] },
  operadores: { view: ['admin', 'pcp', 'gerencia'], edit: ['admin', 'pcp'] },
  injetoras: { view: ['admin', 'pcp', 'gerencia'], edit: ['admin', 'pcp'] },
  programacaoGeral: { view: ['admin', 'pcp', 'gerencia'], edit: ['admin', 'pcp'] },
  distribuicaoInjetoras: { view: ['admin', 'pcp', 'gerencia', 'operador'], edit: ['admin', 'pcp'] },
  apontamento: { view: ['admin', 'pcp', 'operador', 'qualidade', 'gerencia'], edit: ['admin', 'pcp', 'operador'] },
  opImpressao: { view: ['admin', 'pcp', 'operador', 'almoxarifado', 'qualidade', 'gerencia'], edit: ['admin', 'pcp', 'qualidade'] },
  consolidadoMP: { view: ['admin', 'pcp', 'almoxarifado', 'gerencia'], edit: ['admin', 'pcp', 'almoxarifado'] },
  comparativoMensal: { view: ['admin', 'pcp', 'gerencia'], edit: [] },
  perdasOperadores: { view: ['admin', 'pcp', 'gerencia'], edit: [] },
  usuarios: { view: ['admin'], edit: ['admin'] },
  permissoes: { view: ['admin'], edit: ['admin'] },
};

const SEED_USERS = [
  { id: 'u1', username: 'admin', password: 'admin123', name: 'Administrador do Sistema', role: 'admin' },
  { id: 'u2', username: 'ana.pcp', password: 'pcp123', name: 'Ana Ribeiro', role: 'pcp' },
  { id: 'u3', username: 'carlos.op', password: 'op123', name: 'Carlos Souza', role: 'operador' },
  { id: 'u4', username: 'marcos.almox', password: 'almox123', name: 'Marcos Lima', role: 'almoxarifado' },
  { id: 'u5', username: 'beatriz.qa', password: 'qual123', name: 'Beatriz Nunes', role: 'qualidade' },
  { id: 'u6', username: 'roberto.ger', password: 'ger123', name: 'Roberto Alves', role: 'gerencia' },
];

const SEED_PRODUCTS = [
  { code: 'P001', name: 'BOTÃO DO L-99 Nº4 - PRETO', molde: 'M-001', maquina: 'INJ-01', prodDia: 24686, peso: 9.12, virgem: 98.5, moido: 0, pigmento: 1.5, cavidades: 4 },
  { code: 'P002', name: 'BOTÃO L/D (AIR FRYER 50) - PRETO', molde: 'M-002', maquina: 'INJ-02', prodDia: 20329, peso: 6.15, virgem: 97, moido: 0, pigmento: 3, cavidades: 4 },
  { code: 'P003', name: 'BOTÃO L/D L-99 Nº3 - PRETO', molde: 'M-003', maquina: 'INJ-03', prodDia: 24686, peso: 9.12, virgem: 98.5, moido: 0, pigmento: 1.5, cavidades: 4 },
  { code: 'P004', name: 'BOTÃO L/D VENTILADOR VP-PRO-55/65', molde: 'M-004', maquina: 'INJ-04', prodDia: 11917, peso: 3.09, virgem: 98.5, moido: 0, pigmento: 1.5, cavidades: 2 },
  { code: 'P005', name: 'CANOPLA', molde: 'M-005', maquina: 'INJ-05', prodDia: 3323, peso: 31.46, virgem: 98, moido: 0, pigmento: 2, cavidades: 1 },
  { code: 'P006', name: 'ETIQUETA LOGO MAIOR MAXIPOWER - PRETO', molde: 'M-006', maquina: 'INJ-06', prodDia: 5760, peso: 26, virgem: 98.5, moido: 0, pigmento: 1.5, cavidades: 2 },
  { code: 'P007', name: 'EMBOLO', molde: 'M-007', maquina: 'INJ-07', prodDia: 5082, peso: 40.5, virgem: 98.5, moido: 0, pigmento: 1.5, cavidades: 1 },
  { code: 'P008', name: 'ETIQUETA PRO-55', molde: 'M-008', maquina: 'INJ-08', prodDia: 4937, peso: 24.52, virgem: 98.5, moido: 0, pigmento: 1.5, cavidades: 2 },
  { code: 'P009', name: 'SUPORTE DA CHAVE V-45', molde: 'M-009', maquina: 'INJ-09', prodDia: 12343, peso: 17.68, virgem: 98.5, moido: 0, pigmento: 1.5, cavidades: 2 },
  { code: 'P010', name: 'TAMPA PP 4CAV Nº02 - PRETA', molde: 'M-010', maquina: 'INJ-10', prodDia: 11520, peso: 39.25, virgem: 98, moido: 0, pigmento: 2, cavidades: 4 },
];

const SEED_RAW = [
  { code: 'MP-001', descricao: 'PP VIRGEM NATURAL', fornecedor: 'Braskem', tipo: 'Virgem', unidade: 'kg', estoque: 0 },
  { code: 'MP-002', descricao: 'PP MOÍDO INTERNO', fornecedor: 'Reciclagem própria', tipo: 'Moído', unidade: 'kg', estoque: 0 },
  { code: 'MP-003', descricao: 'MASTERBATCH PRETO', fornecedor: 'Cromex', tipo: 'Pigmento', unidade: 'kg', estoque: 0 },
];

const INJETORAS = Array.from({ length: 10 }, (_, i) => `INJ-${String(i + 1).padStart(2, '0')}`);

// Popula a tabela injetoras na primeira vez, a partir das 10 injetoras que já
// estavam em uso (embutidas no código) — assim nenhum produto/OP existente perde a referência.
const SEED_INJETORAS = INJETORAS.map(nome => ({ nome }));

// Composição inicial de cada produto de demonstração, montada a partir dos
// percentuais antigos (virgem/moído/pigmento) apontando para as matérias-primas
// de demonstração (SEED_RAW). Vira a base da tabela product_materials no seed.
const SEED_PRODUCT_MATERIALS = SEED_PRODUCTS.flatMap(p => ([
  { productCode: p.code, rawMaterialCode: 'MP-001', percentual: p.virgem },
  { productCode: p.code, rawMaterialCode: 'MP-002', percentual: p.moido },
  { productCode: p.code, rawMaterialCode: 'MP-003', percentual: p.pigmento },
]).filter(m => Number(m.percentual) > 0));

module.exports = {
  ROLES, ROLE_LABELS, TABS, DEFAULT_PERMISSIONS, SEED_USERS, SEED_PRODUCTS, SEED_RAW,
  SEED_PRODUCT_MATERIALS, SEED_INJETORAS, INJETORAS,
};
