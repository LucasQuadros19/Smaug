/**
 * Calculadora das folhas: uma conta por linha, resultado na lateral.
 *
 *   capital = 10.000            → variável (usa depois como `capital`)
 *   juros: capital * 10%        → antes do ":" é só rótulo
 *   aluguel 1.200 + luz 237,50  → palavras soltas são ignoradas
 *   @emprestimo.pedro.lucas     → valor puxado do sistema
 *   soma                        → soma tudo com resultado desde a última soma
 */

export type LineResult =
  | { kind: "empty" }
  | { kind: "value"; value: number }
  | { kind: "error"; message: string }

/** "Empréstimo João" → "emprestimo_joao": como nomes viram chaves de @. */
export function slug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

/** "@Emprestimo.Pedro" → "emprestimo.pedro" */
export function refKey(raw: string): string {
  return raw.replace(/^@/, "").split(".").map(slug).join(".")
}

/** pt-BR primeiro: "10.000,50", "10.000" (mil). Ponto sem grupo de 3 é decimal: "4.99". */
function parseNumber(raw: string): number {
  if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", "."))
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ""))
  return Number(raw)
}

type Token =
  | { t: "num"; v: number }
  | { t: "op"; v: string }
  | { t: "ref"; v: string }
  | { t: "name"; v: string }

const TOKEN = /(@[\p{L}\p{N}_.]+)|(\d[\d.]*(?:,\d+)?)|([\p{L}_][\p{L}\p{N}_]*)|([-+*/×÷%()])/uy
const SUM_WORDS = new Set(["soma", "total"])

function tokenize(text: string, vars: Record<string, number>): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    TOKEN.lastIndex = i
    const m = TOKEN.exec(text)
    if (!m) {
      i++ // espaço, "R$", ":" etc. — não é conta
      continue
    }
    i = TOKEN.lastIndex
    if (m[1]) tokens.push({ t: "ref", v: refKey(m[1].replace(/\.+$/, "")) })
    else if (m[2]) tokens.push({ t: "num", v: parseNumber(m[2].replace(/\.$/, "")) })
    else if (m[3]) {
      const name = slug(m[3])
      // Palavra que não é variável nem "soma" é texto: fica de fora da conta.
      if (name in vars || SUM_WORDS.has(name)) tokens.push({ t: "name", v: name })
    } else tokens.push({ t: "op", v: m[4] === "×" ? "*" : m[4] === "÷" ? "/" : m[4] })
  }
  return tokens
}

function parse(tokens: Token[], lookup: (token: Token) => number): number {
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v

  function expr(): number {
    let value = term()
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].v
      value = op === "+" ? value + term() : value - term()
    }
    return value
  }
  function term(): number {
    let value = unary()
    while (isOp("*") || isOp("/")) {
      const op = tokens[pos++].v
      const right = unary()
      if (op === "/" && right === 0) throw new Error("divisão por zero")
      value = op === "*" ? value * right : value / right
    }
    return value
  }
  function unary(): number {
    if (isOp("-")) {
      pos++
      return -unary()
    }
    if (isOp("+")) {
      pos++
      return unary()
    }
    let value = primary()
    if (isOp("%")) {
      pos++
      value /= 100
    }
    return value
  }
  function primary(): number {
    const token = tokens[pos++]
    if (!token) throw new Error("conta incompleta")
    if (token.t === "op" && token.v === "(") {
      const value = expr()
      if (!isOp(")")) throw new Error("falta fechar o parêntese")
      pos++
      return value
    }
    if (token.t === "op") throw new Error(`"${token.v}" fora do lugar`)
    return lookup(token)
  }

  const value = expr()
  if (pos < tokens.length) throw new Error("dois valores sem conta entre eles")
  return value
}

export function evaluateSheet(text: string, refs: Record<string, number>): LineResult[] {
  const vars: Record<string, number> = {}
  let subtotal = 0

  return text.split("\n").map((line): LineResult => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return { kind: "empty" }

    let body = line
    let variable: string | undefined
    const assign = line.match(/^\s*([\p{L}_][\p{L}\p{N}_]*)\s*=(.*)$/u)
    if (assign) {
      variable = slug(assign[1])
      body = assign[2]
    } else if (line.includes(":")) {
      body = line.slice(line.indexOf(":") + 1) // "juros 10%: capital * 10%"
    }

    const tokens = tokenize(body, vars)
    if (!tokens.some((t) => t.t !== "op")) return { kind: "empty" }

    let usedSum = false
    try {
      const value = parse(tokens, (token) => {
        if (token.t === "num") return token.v
        if (token.t === "ref") {
          if (!(token.v in refs)) throw new Error(`@${token.v} não existe`)
          return refs[token.v]
        }
        if (SUM_WORDS.has(token.v) && !(token.v in vars)) {
          usedSum = true
          return subtotal
        }
        return vars[token.v]
      })
      if (!Number.isFinite(value)) throw new Error("resultado inválido")

      if (variable) vars[variable] = value
      // A soma fecha um bloco: a próxima começa do zero e não conta esta.
      subtotal = usedSum ? 0 : subtotal + value
      return { kind: "value", value }
    } catch (error) {
      return { kind: "error", message: (error as Error).message }
    }
  })
}
