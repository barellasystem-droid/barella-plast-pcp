const path = require('path');
const express = require('express');
const app = require('./app');

const PORT = process.env.PORT || 3000;

// Serve the built frontend (web/dist), produced by `npm run build:web`.
// Só é usado para rodar local/LAN/VPS — na Vercel o estático é servido
// direto pela plataforma e este arquivo nem é chamado (ver api/index.js).
const webDist = path.join(__dirname, '..', 'web', 'dist');
app.use(express.static(webDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(webDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Barella Plast PCP rodando em http://0.0.0.0:${PORT}`);
  console.log('Acesse de outras máquinas da rede pelo IP local deste computador, ex: http://192.168.X.X:' + PORT);
});
