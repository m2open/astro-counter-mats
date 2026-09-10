interface Env {
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

interface FunctionContext {
  request: Request;
  env: Env;
}

export interface FieldDefinition {
  name: string;
  label: string;
  required?: boolean;
  allowedValues?: readonly string[];
  maxLength?: number;
}

type Submission = Record<string, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENDER = 'Custom Counter Mats <info@customcountermat.com>';

export function methodNotAllowed() {
  return Response.json({ error: 'Method not allowed.' }, {
    status: 405,
    headers: { Allow: 'POST' },
  });
}

export async function readAndValidateSubmission(
  request: Request,
  fields: readonly FieldDefinition[],
): Promise<{ submission: Submission } | { response: Response }> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
    return { response: Response.json({ error: 'Invalid form submission.' }, { status: 400 }) };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { response: Response.json({ error: 'Invalid form submission.' }, { status: 400 }) };
  }

  const submission: Submission = {};
  for (const field of fields) {
    const value = formData.get(field.name);
    if (typeof value !== 'string') {
      if (field.required) {
        return { response: Response.json({ error: `${field.label} is required.` }, { status: 400 }) };
      }
      submission[field.name] = '';
      continue;
    }

    const trimmed = value.trim();
    if (field.required && !trimmed) {
      return { response: Response.json({ error: `${field.label} is required.` }, { status: 400 }) };
    }
    if (field.maxLength && trimmed.length > field.maxLength) {
      return { response: Response.json({ error: `${field.label} is too long.` }, { status: 400 }) };
    }
    if (field.allowedValues && !field.allowedValues.includes(trimmed)) {
      return { response: Response.json({ error: `Invalid ${field.label.toLowerCase()}.` }, { status: 400 }) };
    }
    if (field.name === 'email' && trimmed && !EMAIL_PATTERN.test(trimmed)) {
      return { response: Response.json({ error: 'Please enter a valid email address.' }, { status: 400 }) };
    }
    submission[field.name] = trimmed;
  }

  const token = formData.get('cf-turnstile-response');
  if (typeof token !== 'string' || !token) {
    return { response: Response.json({ error: 'Please complete the security check.' }, { status: 400 }) };
  }
  submission.turnstileToken = token;

  return { submission };
}

export async function verifyTurnstile(context: FunctionContext, token: string) {
  const body = new URLSearchParams({
    secret: context.env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  const ip = context.request.headers.get('CF-Connecting-IP');
  if (ip) body.set('remoteip', ip);

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const result = await response.json() as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}

export async function sendNotification(
  apiKey: string,
  to: string,
  subject: string,
  replyTo: string,
  fields: readonly FieldDefinition[],
  submission: Submission,
) {
  const rows = fields.map(({ name, label }) => (
    `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(submission[name] || '—')}</td></tr>`
  )).join('');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SENDER,
      to: [to],
      reply_to: replyTo,
      subject,
      html: `<h1>${escapeHtml(subject)}</h1><table>${rows}</table>`,
      text: fields.map(({ name, label }) => `${label}: ${submission[name] || '—'}`).join('\n'),
    }),
  });

  return response.ok;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] || character);
}
