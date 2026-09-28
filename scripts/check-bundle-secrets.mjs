import { readdirSync, readFileSync } from 'fs'

function loadEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) out[m[1].trim()] = m[2].trim()
  }
  return out
}

const env = loadEnv('.env.local')
const key = env.VITE_SUPABASE_ANON_KEY
let js = ''
for (const f of readdirSync('dist/assets')) {
  if (f.endsWith('.js')) js += readFileSync(`dist/assets/${f}`, 'utf8')
}

function contexts(needle) {
  const out = []
  let i = 0
  while ((i = js.indexOf(needle, i)) !== -1 && out.length < 3) {
    out.push(js.slice(Math.max(0, i - 50), i + needle.length + 50).replaceAll(key, '[REDACTED]'))
    i += needle.length
  }
  return out
}

const report = {
  exactPublishableKeyEmbedded: js.includes(key),
  jwtServiceRoleClaimLiteral: js.includes('role":"service_role') || js.includes("role:'service_role'"),
  looksLikeServiceRoleKeyValue: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(js) && js.includes('service_role'),
  service_role_contexts: contexts('service_role'),
  sb_secret_contexts: contexts('sb_secret_'),
}

console.log(JSON.stringify(report, null, 2))
