// Envio de e-mail via API HTTP do Resend (sem SDK — é só um POST simples).
// Nunca deixa uma falha de e-mail derrubar a operação que o chamou: quem usa
// isso sempre envolve a chamada num try/catch e segue o fluxo normalmente.
async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY não configurada — e-mail não enviado:', subject);
    return { skipped: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || 'Barella Plast PCP <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Resend respondeu ${res.status}: ${data?.message || JSON.stringify(data)}`);
  }
  return data;
}

module.exports = { sendEmail };
