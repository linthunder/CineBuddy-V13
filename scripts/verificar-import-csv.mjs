/**
 * Verificação: aplica a MESMA lógica de parsing do ViewConfig aos CSVs
 * para conferir se os valores que o sistema usa batem com o arquivo.
 * Uso: node scripts/verificar-import-csv.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TABELAS_DIR = path.join(__dirname, '..', 'files', 'Tabelas')

const CSV_QUOTE_REGEX = /["\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB\u2039\u203A\uFF02\u275D\u275E]/

function parseBrCurrency(val) {
  if (!val || typeof val !== 'string') return 0
  let clean = val.replace(/[\s\u00A0\uFEFF]/g, '').replace(/^R\$\s*/i, '')
  clean = clean.replace(/\u201A/g, ',')
  const lastComma = clean.lastIndexOf(',')
  if (lastComma >= 0) {
    const before = clean.slice(0, lastComma).replace(/\./g, '')
    const after = clean.slice(lastComma + 1)
    clean = before + '.' + after
  }
  return parseFloat(clean) || 0
}

function parseCsvLine(line) {
  const result = []
  const s = line.replace(/\r$/, '')
  let i = 0
  while (i < s.length) {
    if (CSV_QUOTE_REGEX.test(s[i])) {
      i++
      let field = ''
      while (i < s.length) {
        if (CSV_QUOTE_REGEX.test(s[i])) {
          i++
          if (i < s.length && CSV_QUOTE_REGEX.test(s[i])) {
            field += '"'
            i++
          } else break
        } else {
          field += s[i]
          i++
        }
      }
      result.push(field.trim())
      if (i < s.length && s[i] === ',') i++
    } else {
      let field = ''
      while (i < s.length && s[i] !== ',') {
        field += s[i]
        i++
      }
      result.push(field.trim())
      if (i < s.length) i++
    }
  }
  return result
}

function parseCachesLine(line) {
  const cols = parseCsvLine(line)
  return {
    funcao: (cols[0] ?? '').trim(),
    cache_dia: parseBrCurrency(cols[1] ?? '0'),
    cache_semana: parseBrCurrency(cols[2] ?? '0'),
  }
}

function formatNum(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const arquivos = [
  'Sindicine Cinema 2025.csv',
  'Sindicine Publi 2025.csv',
  'Sindicine Séries 2025.csv',
]

console.log('=== Verificação dos CSVs (mesma lógica do sistema) ===\n')

for (const nome of arquivos) {
  const filePath = path.join(TABELAS_DIR, nome)
  if (!fs.existsSync(filePath)) {
    console.log(`Arquivo não encontrado: ${nome}\n`)
    continue
  }
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\n/).filter((l) => l.trim())
  const header = lines[0]
  const dataLines = lines.slice(1)

  console.log(`--- ${nome} ---`)
  console.log(`Cabeçalho: ${header}`)
  console.log('Primeiras 8 linhas parseadas (como o sistema usa):\n')

  for (let i = 0; i < Math.min(8, dataLines.length); i++) {
    const parsed = parseCachesLine(dataLines[i])
    const diaStr = parsed.cache_dia ? `R$ ${formatNum(parsed.cache_dia)}` : '(vazio)'
    const semanaStr = parsed.cache_semana ? `R$ ${formatNum(parsed.cache_semana)}` : '(vazio)'
    console.log(`  ${i + 1}. ${parsed.funcao}`)
    console.log(`     Cachê dia: ${diaStr}  |  Cachê semana: ${semanaStr}`)
  }
  console.log('')
}

console.log('Conferir no app: Configurações → Funções e Cachês → selecione a tabela e compare as linhas acima.')
