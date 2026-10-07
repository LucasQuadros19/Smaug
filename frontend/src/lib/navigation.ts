import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  Tags,
  PiggyBank,
  Repeat,
  FolderKanban,
  Target,
  Calculator,
  CandlestickChart,
  Bot,
  Landmark,
  ShoppingCart,
  Table2,
  HandCoins,
  type LucideIcon,
} from "lucide-react"
import type { ShareSection } from "../types"

export const SHARE_SECTIONS: { key: ShareSection; label: string; hint: string }[] = [
  { key: "contas", label: "Contas e lançamentos", hint: "Contas, transações, recorrentes, orçamentos, lista de compras e categorias" },
  { key: "patrimonio", label: "Patrimônio e metas", hint: "Evolução, ativos, grupos e metas" },
  { key: "emprestimos", label: "Empréstimos", hint: "Inclusive registrar recebimentos nas contas de quem compartilhou" },
  { key: "mercado", label: "Mercado", hint: "Códigos acompanhados e compras" },
  { key: "calculos", label: "Cálculos", hint: "As folhas de cálculo" },
]

/** "tudo": só com todas as partes compartilhadas. null: nunca aparece nos dados de outra pessoa. */
type TabSection = ShareSection | "tudo" | null

/** As abas da barra lateral. Todas podem ser escondidas em Configurações, menos o Dashboard. */
export const navSections: { title: string | null; links: { to: string; label: string; icon: LucideIcon; section: TabSection }[] }[] = [
  {
    title: null,
    links: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, section: "tudo" }],
  },
  {
    title: "Dia a dia",
    links: [
      { to: "/transacoes", label: "Transações", icon: ArrowLeftRight, section: "contas" },
      { to: "/recorrentes", label: "Recorrentes", icon: Repeat, section: "contas" },
      { to: "/orcamentos", label: "Orçamentos", icon: PiggyBank, section: "contas" },
      { to: "/lista-compras", label: "Lista de compras", icon: ShoppingCart, section: "contas" },
    ],
  },
  {
    title: "Patrimônio",
    links: [
      { to: "/patrimonio", label: "Evolução", icon: Table2, section: "patrimonio" },
      { to: "/ativos", label: "Ativos", icon: Landmark, section: "patrimonio" },
      { to: "/emprestimos", label: "Empréstimos", icon: HandCoins, section: "emprestimos" },
      { to: "/metas", label: "Metas", icon: Target, section: "patrimonio" },
      { to: "/mercado", label: "Mercado", icon: CandlestickChart, section: "mercado" },
      { to: "/bot", label: "Bot", icon: Bot, section: null },
    ],
  },
  {
    title: "Organização",
    links: [
      { to: "/grupos", label: "Grupos", icon: FolderKanban, section: "patrimonio" },
      { to: "/contas", label: "Contas", icon: Wallet, section: "contas" },
      { to: "/categorias", label: "Categorias", icon: Tags, section: "contas" },
      { to: "/calculos", label: "Cálculos", icon: Calculator, section: "calculos" },
    ],
  },
]

export function canSee(section: TabSection, shared: ShareSection[]) {
  if (section === "tudo") return SHARE_SECTIONS.every(({ key }) => shared.includes(key))
  return section !== null && shared.includes(section)
}

/** A parte de um endereço; undefined para telas da própria conta (Configurações, Usuário). */
export function sectionOfPath(path: string): TabSection | undefined {
  const first = "/" + (path.split("/")[1] ?? "")
  return navSections.flatMap((s) => s.links).find((link) => link.to === first)?.section
}

/** Para onde ir ao abrir os dados de alguém: a primeira aba que a pessoa mostrou. */
export function firstTab(shared: ShareSection[]) {
  return navSections.flatMap((s) => s.links).find((link) => canSee(link.section, shared))?.to ?? "/"
}
