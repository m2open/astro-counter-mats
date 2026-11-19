import {
  escapeHtml,
  methodNotAllowed,
  oneLine,
  readAndValidateSubmission,
  sendEmail,
  sendNotification,
  verifyTurnstile,
  type FieldDefinition,
} from '../_lib/forms';

interface Env {
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

interface PagesFunctionContext {
  request: Request;
  env: Env;
}

const PRODUCT_TYPES = [
  'Hard Surface Counter Mat', 'Fabric Counter Mat', 'Changeable Insert Counter Mat',
  'Premium Bar Counter Mat', 'Eco-Friendly Counter Mat', 'Custom Shape Counter Mat',
  'Duraframe Window Poster Frame',
] as const;
const QUANTITIES = ['500 pcs', '750 pcs', '1,000 pcs', '1,500 pcs', '2,000 pcs', '2,500 pcs', '5,000+ pcs'] as const;
const LOGO_METHODS = ['Full Color Printing', 'Screen Printing', 'Embossed Logo', 'Custom Requirement'] as const;

const fields: readonly FieldDefinition[] = [
  { name: 'productType', label: 'Product Type', required: true, allowedValues: PRODUCT_TYPES },
  { name: 'quantity', label: 'Quantity', required: true, allowedValues: QUANTITIES },
  { name: 'dimension', label: 'Size / Dimension', maxLength: 200 },
  { name: 'logoMethod', label: 'Logo / Decoration Method', required: true, allowedValues: LOGO_METHODS },
  { name: 'company', label: 'Your Company', maxLength: 200 },
  { name: 'email', label: 'Email', required: true, maxLength: 254 },
  { name: 'whatsapp', label: 'WhatsApp', maxLength: 80 },
  { name: 'details', label: 'Project Details', maxLength: 5000 },
];

export async function onRequest(context: PagesFunctionContext) {
  if (context.request.method !== 'POST') return methodNotAllowed();

  const result = await readAndValidateSubmission(context.request, fields);
  if ('response' in result) return result.response;
  if (!await verifyTurnstile(context, result.submission.turnstileToken)) {
    return Response.json({ error: 'Security check failed. Please try again.' }, { status: 400 });
  }

  const submission = result.submission;
  const company = oneLine(submission.company, 60);

  // 1. Internal notification to sales, with a descriptive subject.
  const subject = oneLine(
    `New quote request: ${company || submission.email} – ${submission.productType} – ${submission.quantity}`,
    150,
  );
  const sent = await sendNotification(
    context.env.RESEND_API_KEY,
    'sales@customcountermat.com',
    subject,
    submission.email,
    fields,
    submission,
  );
  if (!sent) return Response.json({ error: 'Unable to send your quote request. Please try again.' }, { status: 502 });

  // 2. Confirmation to the customer. A failure here must not fail the request:
  //    the lead has already reached sales.
  try {
    await sendEmail(context.env.RESEND_API_KEY, customerConfirmation(submission, company));
  } catch {
    // ignore
  }

  return Response.json({ ok: true });
}

function customerConfirmation(submission: Record<string, string>, company: string) {
  // Only use the company name in the greeting when it looks like a plain name (no links).
  const safeCompany = company && !/https?:|www\.|[<>]/i.test(company) ? company : '';
  const greeting = safeCompany ? `Dear ${safeCompany},` : 'Dear Customer,';
  const request = `${submission.productType} – ${submission.quantity}`;

  const text = [
    greeting,
    '',
    `Thank you for your inquiry. We have received your request for ${request} and will send your quotation within 24 hours.`,
    '',
    'If you have artwork or reference images, simply reply to this email with the files attached.',
    '',
    'Best regards,',
    'Joe',
    'Custom Counter Mats | GIFT IDEA LIMITED',
    'WhatsApp: +86 131 6878 7818',
    'Website: https://customcountermat.com',
  ].join('\n');

  const html = `<p>${escapeHtml(greeting)}</p>
<p>Thank you for your inquiry. We have received your request for <strong>${escapeHtml(request)}</strong> and will send your quotation within 24 hours.</p>
<p>If you have artwork or reference images, simply reply to this email with the files attached.</p>
<p>Best regards,<br>Joe<br>Custom Counter Mats | GIFT IDEA LIMITED<br>WhatsApp: +86 131 6878 7818<br><a href="https://customcountermat.com">customcountermat.com</a></p>`;

  return {
    to: submission.email,
    subject: 'We received your quote request – Custom Counter Mats',
    html,
    text,
  };
}
