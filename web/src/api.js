const TOKEN_KEY = 'barella_token';

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (!res.ok) {
    const message = (data && data.error) || `Erro ${res.status} ao acessar ${path}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  register: (data) => request('POST', '/auth/register', data),
  me: () => request('GET', '/auth/me'),

  users: {
    list: () => request('GET', '/users'),
    create: (u) => request('POST', '/users', u),
    setRole: (id, role) => request('PATCH', `/users/${id}/role`, { role }),
    remove: (id) => request('DELETE', `/users/${id}`),
  },
  permissions: {
    get: () => request('GET', '/permissions'),
    set: (tabId, role, canView, canEdit) => request('PUT', '/permissions', { tabId, role, canView, canEdit }),
  },
  products: {
    list: () => request('GET', '/products'),
    create: (p) => request('POST', '/products', p),
    update: (code, p) => request('PUT', `/products/${code}`, p),
    remove: (code) => request('DELETE', `/products/${code}`),
  },
  rawMaterials: {
    list: () => request('GET', '/raw-materials'),
    create: (r) => request('POST', '/raw-materials', r),
    update: (code, r) => request('PUT', `/raw-materials/${code}`, r),
    remove: (code) => request('DELETE', `/raw-materials/${code}`),
  },
  productMaterials: {
    list: () => request('GET', '/product-materials'),
  },
  operators: {
    list: () => request('GET', '/operators'),
    create: (o) => request('POST', '/operators', o),
    update: (id, o) => request('PUT', `/operators/${id}`, o),
    setActive: (id, active) => request('PATCH', `/operators/${id}/active`, { active }),
  },
  injetoras: {
    list: () => request('GET', '/injetoras'),
    create: (i) => request('POST', '/injetoras', i),
    update: (id, i) => request('PUT', `/injetoras/${id}`, i),
    setActive: (id, active) => request('PATCH', `/injetoras/${id}/active`, { active }),
  },
  ordersGeral: {
    list: () => request('GET', '/orders-geral'),
    create: (o) => request('POST', '/orders-geral', o),
    update: (id, o) => request('PUT', `/orders-geral/${id}`, o),
    setStatus: (id, status) => request('PATCH', `/orders-geral/${id}/status`, { status }),
    entregarMaterial: (id) => request('PATCH', `/orders-geral/${id}/entregar-material`),
    remove: (id) => request('DELETE', `/orders-geral/${id}`),
  },
  ordersMaquina: {
    list: () => request('GET', '/orders-maquina'),
    create: (o) => request('POST', '/orders-maquina', o),
    update: (id, o) => request('PUT', `/orders-maquina/${id}`, o),
    remove: (id) => request('DELETE', `/orders-maquina/${id}`),
  },
  apontamentos: {
    list: () => request('GET', '/apontamentos'),
    create: (a) => request('POST', '/apontamentos', a),
    remove: (id) => request('DELETE', `/apontamentos/${id}`),
  },
  stock: {
    movements: (params) => request('GET', `/stock/movements${params ? '?' + new URLSearchParams(params).toString() : ''}`),
    entradaManual: (data) => request('POST', '/stock/entrada-manual', data),
    nfeParse: (xml) => request('POST', '/stock/nfe/parse', { xml }),
    nfeConfirmar: (data) => request('POST', '/stock/nfe/confirmar', data),
  },
};
