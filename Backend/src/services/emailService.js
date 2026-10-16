export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('Email delivery is not configured.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Seafudz ng Bayan <noreply@seafudzngbayan.app>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) throw new Error('Email provider rejected the message.');
}
