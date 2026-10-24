// ─────────────────────────────────────────────────────────────
//  Vierra Care Services — business details
//  Edit this ONE file to update phone, email, address, hours,
//  social links, etc. across every page of the website.
//  Anything marked  ⚠ CONFIRM  is a placeholder to replace.
// ─────────────────────────────────────────────────────────────
export default {
  name: 'Vierra Care Services',
  short: 'Vierra',
  tagline: 'Care that feels like home.',
  motto: 'Compassionate Care. Dignified Living. Peace of Mind.',
  founder: 'Agatha Gondwe, RN',
  founderRole: 'Founder & Owner',

  // SITE_URL wins. Otherwise use Netlify's production URL, then localhost.
  url: (() => {
    const raw = process.env.SITE_URL
      || process.env.URL
      || 'http://localhost:8888';
    const withProto = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    return withProto.replace(/\/+$/, '');
  })(),

  phone: '+1 (403) 877-9886',       // shown on site, used for tap-to-call
  phoneHref: '+14038779886',        // digits only, with country code
  whatsapp: '14038779886',          // digits only, no "+"; leave '' to hide WhatsApp button
  email: 'hello@vierracare.com',      // ⚠ CONFIRM
  address: 'Your street address, City', // ⚠ CONFIRM
  serviceArea: 'Home visits across your city and surrounding areas', // ⚠ CONFIRM
  hours: 'Mon – Sun · Care available around the clock by arrangement', // ⚠ CONFIRM

  social: {
    facebook: '',   // e.g. https://facebook.com/vierracare
    instagram: '',
    linkedin: ''
  },

  year: new Date().getFullYear()
};
