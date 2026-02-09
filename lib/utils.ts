/**
 * Formatação e parsing de moeda (pt-BR), espelho da lógica do frontend V13.50
 */

export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCurrency(value: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Converte string de input (R$ 1.234,56 ou 1234.56 ou 1234,56) em número.
 * Convenção pt-BR: ponto = separador de milhar, vírgula = separador decimal.
 * Portanto SEMPRE removemos os pontos e tratamos a vírgula como decimal.
 */
export function parseCurrencyInput(str: string | undefined | null): number {
  if (str == null || str === '') return 0
  // Remover tudo que não é dígito, vírgula ou ponto
  let s = String(str).replace(/[^0-9,.]/g, '')
  // pt-BR: ponto é milhar, vírgula é decimal
  // Remove TODOS os pontos (milhares)
  s = s.replace(/\./g, '')
  // Troca vírgula por ponto (decimal)
  s = s.replace(',', '.')
  const value = parseFloat(s)
  return Number.isNaN(value) ? 0 : value
}

/**
 * Valor exibido no input (para blur: formata como moeda; para focus: só números)
 */
export function formatCurrencyForInput(value: number): string {
  if (value <= 0) return ''
  return value.toFixed(2)
}

export function formatCurrencyDisplay(value: number): string {
  return formatCurrency(value)
}
