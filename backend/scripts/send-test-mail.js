const nodemailer = require('nodemailer');

const port = Number(process.env.SMTP_PORT || 587);
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

const to = process.argv[2] || 'ronnycorreaunity@gmail.com';

transport
  .sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'Prueba Music Mundial',
    text: 'Correo de prueba desde produccion. SMTP BillionMail OK.',
    html: '<p>Correo de prueba desde produccion. <strong>SMTP BillionMail OK.</strong></p>',
  })
  .then((result) => {
    console.log('SENT', result.messageId);
    process.exit(0);
  })
  .catch((error) => {
    console.log('FAIL', error.message);
    process.exit(1);
  });
