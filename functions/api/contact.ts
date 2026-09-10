import {
  methodNotAllowed,
  readAndValidateSubmission,
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
const QUANTITIES = ['100 pcs', '250 pcs', '500 pcs', '750 pcs', '1,000 pcs', '1,500 pcs', '2,000 pcs', '2,500 pcs', '5,000+ pcs'] as const;
const LOGO_METHODS = ['Full Color Printing', 'Screen Printing', 'Embossed Logo', 'Custom Requirement'] as const;

const fields: readonly FieldDefinition[] = [
  { name: 'product', label: 'Product Type', required: true, allowedValues: PRODUCT_TYPES },
  { name: 'quantity', label: 'Quantity', required: true, allowedValues: QUANTITIES },
  { name: 'size', label: 'Size / Dimension', maxLength: 200 },
  { name: 'logo', label: 'Logo / Decoration Method', required: true, allowedValues: LOGO_METHODS },
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

  const sent = await sendNotification(
    context.env.RESEND_API_KEY,
    'info@customcountermat.com',
    'New contact request',
    result.submission.email,
    fields,
    result.submission,
  );
  if (!sent) return Response.json({ error: 'Unable to send your request. Please try again.' }, { status: 502 });

  return Response.json({ ok: true });
}
