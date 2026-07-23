// Interface translations, split into per-area locale modules under ./locales and merged here.
// To translate a screen: add its keys to the matching locale file (both `en` and `ar`) and use
// them via `t('namespace.key')` from `useI18n()`. Missing keys fall back to English, then to the
// raw key — so partially-translated screens degrade gracefully.
import common from './locales/common'
import register from './locales/register'
import dashboard from './locales/dashboard'
import tickets from './locales/tickets'
import customers from './locales/customers'
import agents from './locales/agents'
import settings from './locales/settings'
import reports from './locales/reports'
import projects from './locales/projects'
import guest from './locales/guest'

export const LANGUAGES = {
  en: { label: 'English', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },
}

const MODULES = [common, register, dashboard, tickets, customers, agents, settings, reports, projects, guest]

function mergeLang(lang) {
  return Object.assign({}, ...MODULES.map((m) => m[lang] || {}))
}

export const translations = {
  en: mergeLang('en'),
  ar: mergeLang('ar'),
}
