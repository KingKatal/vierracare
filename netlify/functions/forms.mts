// Public form endpoints: contact message, care request, job application.
import type { Config, Context } from "@netlify/functions";
import * as store from "../../db/store.js";
import { notify } from "../../server/mailer.js";
import { badRequest, clean, EMAIL, PHONE, readJson } from "../../server/validate.js";

const SERVICES = ['Nursing care (RN / LPN)', 'Personal care & daily living', 'Companionship', 'Respite for family', 'Post-hospital transition', 'Private nursing support', 'Not sure yet'];
const ROLES = ['Registered Nurse (RN)', 'Licensed Practical Nurse (LPN)', 'Health Care Aide (HCA)', 'Personal support worker', 'Companion / caregiver', 'Other'];

type Built = { name: string; email: string; phone: string; payload: Record<string, unknown> };

const FORMS: Record<string, { type: store.InquiryType; build: (b: any) => Built }> = {
  "/api/contact": {
    type: "contact",
    build: b => ({
      name: clean(b.name, 100), email: clean(b.email, 150), phone: clean(b.phone, 25),
      payload: { subject: clean(b.subject, 120), message: clean(b.message, 3000) }
    })
  },
  "/api/care-request": {
    type: "care_request",
    build: b => {
      if (!b.consent) throw badRequest('Please tick the box so we can contact you about your request.');
      return {
        name: clean(b.name, 100), email: clean(b.email, 150), phone: clean(b.phone, 25),
        payload: {
          relationship: clean(b.relationship, 60), careFor: clean(b.careFor, 100),
          location: clean(b.location, 150),
          services: (Array.isArray(b.services) ? b.services : []).map((s: unknown) => clean(s, 60)).filter((s: string) => SERVICES.includes(s)),
          schedule: clean(b.schedule, 60), startDate: clean(b.startDate, 40),
          contactPreference: clean(b.contactPreference, 30), notes: clean(b.notes, 3000)
        }
      };
    }
  },
  "/api/apply": {
    type: "application",
    build: b => {
      if (!b.consent) throw badRequest('Please confirm that you agree to us storing your application.');
      const role = clean(b.role, 60);
      if (!ROLES.includes(role)) throw badRequest('Please choose the role you are applying for.');
      return {
        name: clean(b.name, 100), email: clean(b.email, 150), phone: clean(b.phone, 25),
        payload: { role, experience: clean(b.experience, 40), licence: clean(b.licence, 120),
          availability: clean(b.availability, 80), message: clean(b.message, 3000) }
      };
    }
  }
};

export default async (req: Request, context: Context) => {
  const form = FORMS[new URL(req.url).pathname];
  if (!form) return Response.json({ error: 'Not found' }, { status: 404 });

  const b = await readJson(req);
  if (b.website) return Response.json({ ok: true }); // honeypot — silently drop bots
  try {
    const { name, email, phone, payload } = form.build(b);
    if (name.length < 2) throw badRequest('Please enter your name.');
    if (!email && !phone) throw badRequest('Please give us an email address or phone number.');
    if (email && !EMAIL.test(email)) throw badRequest('That email address doesn’t look right.');
    if (phone && !PHONE.test(phone)) throw badRequest('That phone number doesn’t look right.');
    const id = await store.add({ type: form.type, name, email, phone, payload, ip: context.ip });
    // Awaited so the email is not lost when the invocation ends.
    await notify({ id, type: form.type, name, email, phone, payload });
    return Response.json({ ok: true, id });
  } catch (e: any) {
    if (e.status === 400) return Response.json({ error: e.message }, { status: 400 });
    console.error('[form]', form.type, e);
    return Response.json({ error: 'We could not save your message. Please try again or call us.' }, { status: 500 });
  }
};

export const config: Config = {
  path: ["/api/contact", "/api/care-request", "/api/apply"],
  method: "POST",
  rateLimit: { windowSize: 60, windowLimit: 5, aggregateBy: ["ip", "domain"] },
};
