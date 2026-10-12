export type AccountType = "checking" | "savings" | "credit_card" | "cash" | "investment"
export type CategoryType = "income" | "expense"
export type TransactionType = "income" | "expense"
export type RecurringFrequency = "weekly" | "monthly" | "yearly"
export type PlaylistKind = "group" | "asset"
export type ExpectationStatus = "pending" | "received" | "cancelled"
export type ShoppingPriority = "low" | "medium" | "high"

export interface User {
  id: string
  username: string
  hidden_tabs: string[]
  settings: Settings
}

/** Padrões de mercado: o que já vem preenchido e como avaliar o que varia. */
export interface Settings {
  /** Empréstimos: % ao mês, meses e jeito de pagar que vêm no cadastro. */
  loan_rate: number
  loan_months: number
  loan_schedule: LoanSchedule
  /** % de multa e % ao mês de juros de mora (por dia) sobre o atrasado. */
  late_fine: number
  late_interest: number
  /** Dias de tolerância antes de cobrar atraso. */
  grace_days: number
  /** Adiar cobra os juros do mês. */
  postpone_charges: boolean
  /** Vencimento em fim de semana ou feriado: avisa e sugere o próximo dia útil. */
  business_days: boolean
  /** R$ por ordem e % sobre a ordem em ações da B3. */
  order_fee: number
  b3_fee: number
  /** IR estimado: % sobre o lucro e vendas no mês isentas até. */
  stock_tax: number
  stock_exempt: number
  crypto_tax: number
  crypto_exempt: number
}

export type ShareSection = "contas" | "patrimonio" | "emprestimos" | "mercado" | "calculos"

export interface Share {
  id: number
  status: "active" | "incoming" | "outgoing"
  user: { id: string; username: string }
  i_share: ShareSection[]
  they_share: ShareSection[]
}

export interface Account {
  id: number
  name: string
  type: AccountType
  initial_balance: number
  balance: number
  color: string
  created_at: string
}

export interface Category {
  id: number
  name: string
  type: CategoryType
  color: string
  icon: string
  created_at: string
}

export type AssetType =
  | "investment"
  | "loan"
  | "construction"
  | "debt"
  | "vehicle"
  | "property"
  | "other"

export type Currency = "BRL" | "USD" | "EUR" | "BTC"

export interface Playlist {
  id: number
  name: string
  description: string | null
  color: string
  icon: string
  kind: PlaylistKind
  counts_in_net_worth: boolean
  /** Sempre em reais (convertido pela cotação de agora). */
  opening_value: number
  /** Moeda em que você acompanha a posição. */
  currency: Currency
  /** O valor na moeda da posição (ex: US$ 200). Igual a opening_value em BRL. */
  native_value: number
  /** Reais por unidade da moeda; null = nunca houve cotação (sem internet). */
  rate: number | null
  /** De onde vem o valor: "loans" (Empréstimos), "market" (tudo do Mercado, pela cotação) ou null (digitado). */
  auto_source: "loans" | "market" | null
  asset_type: AssetType
  /** "capital" = lançamento vira valor; "declarado" = valor é cotação sua. */
  value_mode: "capital" | "declarado"
  total_in: number | null
  total_out: number | null
  balance: number | null
  outstanding: number | null
  created_at: string
}

export interface PlaylistSummaryRef {
  id: number
  name: string
  icon: string
  color: string
}

export interface PlaylistExpectation {
  id: number
  playlist_id: number
  description: string
  amount: number
  expected_date: string
  account_id: number | null
  status: ExpectationStatus
  transaction_id: number | null
  is_overdue: boolean
  playlist: PlaylistSummaryRef
  created_at: string
}

export interface ShoppingItem {
  id: number
  description: string
  amount: number | null
  playlist_id: number | null
  priority: ShoppingPriority
  notes: string | null
  purchased: boolean
  /** O gasto lançado no caixa quando marcou como comprado. */
  transaction_id: number | null
  created_at: string
}

export interface Transaction {
  id: number
  account_id: number
  category_id: number | null
  playlist_id: number | null
  description: string
  amount: number
  type: TransactionType
  date: string
  notes: string | null
  category: Category | null
  account_name: string
  playlist: Playlist | null
  /** Criado por outra tela (empréstimo, Mercado): o valor só muda por lá. Só vem na lista de Transações. */
  origin?: { kind: "loan" | "market"; label: string; link: string } | null
  created_at: string
}

export interface Budget {
  id: number
  category_id: number
  month: string
  limit_amount: number
  spent: number
  category: Category | null
  created_at: string
}

export interface RecurringTransaction {
  id: number
  description: string
  amount: number
  type: TransactionType
  category_id: number | null
  account_id: number
  playlist_id: number | null
  frequency: RecurringFrequency
  next_due_date: string
  /** Adiamento só da ocorrência atual; null = sem adiamento. */
  postponed_until: string | null
  /** Vencimento efetivo: o adiado, se houver, senão next_due_date. */
  due_date: string
  /** Pausada por completo: não gera nem aparece para lançar. */
  active: boolean
  /** true = lança sozinha no vencimento; false = você lança o valor do mês. */
  auto: boolean
  category: Category | null
  account_name: string
  created_at: string
}

export interface AccountBalance {
  id: number
  name: string
  color: string
  type: AccountType
  balance: number
}

export interface CategoryExpense {
  category_id: number
  name: string
  color: string
  icon: string
  total: number
}

export type Granularity = "monthly" | "weekly"

export interface CashflowPoint {
  period: string
  income: number
  expense: number
}

export interface NetWorthPoint {
  period: string
  cash: number
  net_worth: number
  assets: Record<string, number>
}

export interface NetWorthSeries {
  series: NetWorthPoint[]
  assets: { id: number; name: string; color: string; icon: string }[]
  /** "snapshots" quando vem do histórico real de registros. */
  source?: string
}

export interface Snapshot {
  id: number
  date: string
  inflow: number
  notes: string | null
  /** playlist_id (string) -> valor em reais na data do registro */
  positions: Record<string, number>
  /** Só posições em outra moeda: playlist_id -> valor na moeda dela */
  native: Record<string, number>
  /** account_id (string) -> valor */
  cash: Record<string, number>
  invested: number
  cash_total: number
  net_worth: number
  created_at: string
}

export interface SnapshotEntryInput {
  playlist_id?: number
  account_id?: number
  value: number
}

/** Envelope de paginação usado pelas listas grandes. */
export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface CategoryBreakdown {
  category_id: number | null
  name: string
  icon: string
  color: string
  total: number
  count: number
}

export interface TransactionPage extends Paginated<Transaction> {
  /** Somas de todas as linhas do filtro, não só da página atual. */
  totals: { income: number; expense: number }
  by_category: CategoryBreakdown[]
}

/** "cash" = gasto/receita real; "transfers" = movimentação de patrimônio. */
export type TransactionScope = "cash" | "transfers"

export type LoanStatus = "active" | "paid" | "late"

export interface LoanParticipant {
  id: number
  loan_id: number
  name: string
  contributed: number
  /** Principal mais o ganho de todos os meses (sem a comissão). */
  to_receive: number
  /** Por mês: ganho de juros e comissão por cima. */
  gain: number
  commission: number
  is_me: boolean
}

export type LoanSchedule = "interest_only" | "installments"

/** Um passo na vida do empréstimo: recebimento ou adiamento. Só o último pode ser desfeito. */
export interface LoanEvent {
  id: number
  kind: "receipt" | "postpone"
  date: string
  due_before: string | null
  due_after: string | null
  /** Fechou um mês de juros. */
  charged: boolean
  notes: string | null
  parts: LoanRepayment[]
  total: number
}

export interface LoanRepayment {
  id: number
  loan_id: number
  /** principal tira dinheiro da rua; interest é lucro; fee é multa ou juros de atraso. */
  kind: "principal" | "interest" | "fee"
  event_id: number | null
  date: string
  amount: number
  my_share: number
  partners_share: number
  account_id: number | null
  partners_settled: boolean
  notes: string | null
  created_at: string
}

export interface Loan {
  id: number
  borrower: string
  amount: number
  interest_rate: number | null
  months: number
  schedule: LoanSchedule
  /** Meses cujos juros já venceram (recebidos ou não). */
  months_charged: number
  /** Juros vencidos que não voltaram: adiamento com juros ou pagamento parcial. */
  interest_pending: number
  events: LoanEvent[]
  /** Juros de um mês: ganhos mais comissões. */
  monthly_interest: number
  my_monthly: number
  /** Comissões por mês. */
  commission: number
  my_interest_received: number
  principal_outstanding: number
  /** Sugestão do próximo recebimento. */
  next_payment: { month: number; principal: number; my_principal: number; interest: number; my_interest: number }
  /** Juros de todos os meses. */
  profit: number
  start_date: string
  due_date: string | null
  status: LoanStatus
  notes: string | null
  participants: LoanParticipant[]
  total_contributed: number
  total_to_receive: number
  my_contributed: number | null
  my_to_receive: number | null
  repayments: LoanRepayment[]
  /** Principal meu neste empréstimo (parte marcada como "eu"). */
  my_principal: number
  my_repaid: number
  /** Meu dinheiro ainda na rua. */
  my_outstanding: number
  total_repaid: number
  /** Dinheiro de sócio no meu caixa esperando repasse. */
  pending_to_partners: number
  /** A saída da minha conta quando emprestei. */
  outflow: { account_id: number; amount: number; date: string } | null
  created_at: string
}

/** Referência a uma posição (ativo/playlist) ou conta, para transferências. */
export interface TransferRef {
  type: "playlist" | "account"
  id: number
}

export interface AllocationItem {
  label: string
  value: number
  group: "Contas" | "Ativos" | "Grupos"
  icon: string
}

export interface AssetSummary {
  total_invested: number
  total_returned: number
  total_outstanding: number
}

export interface DashboardSummary {
  total_balance: number
  net_worth: number
  parked_in_assets: number
  parked_in_playlists: number
  /** Passivo: dinheiro de sócios que está na conta mas não é meu. */
  owed_to_partners: number
  accounts_balance: AccountBalance[]
  month_income: number
  month_expense: number
  month_savings: number
  previous_month: { income: number; expense: number; savings: number }
  expenses_by_category: CategoryExpense[]
  budgets_progress: Budget[]
  recent_transactions: Transaction[]
  playlists_summary: Playlist[]
  asset_summary: AssetSummary
  upcoming_expectations: PlaylistExpectation[]
  granularity: Granularity
  goals: Goal[]
  alerts: Alert[]
  // Ausentes quando a chamada é compacta (?compact=1).
  cashflow_series?: CashflowPoint[]
  net_worth_series?: NetWorthSeries
  allocation?: AllocationItem[]
}

export interface PositionHistoryPoint {
  date: string
  value: number
}

export interface PositionHistory {
  playlist: Playlist
  series: PositionHistoryPoint[]
  first_funded: string | null
  days_held: number | null
  peak: number
  transactions: Transaction[]
}

export interface Goal {
  id: number
  name: string
  icon: string
  target_amount: number
  deadline: string | null
  /** null = acompanha o patrimônio total */
  playlist_id: number | null
  playlist: { id: number; name: string; icon: string; kind: PlaylistKind } | null
  current: number
  remaining: number
  /** 0 a 1 */
  progress: number
  done: boolean
  overdue: boolean
  months_left: number | null
  monthly_needed: number | null
}

export interface Alert {
  level: "danger" | "warning" | "info"
  title: string
  detail: string
  link: string
}

export type Rates = Record<Currency, { rate: number; updated_at: string | null }>

export interface Sheet {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
}

export type MarketKind = "stock" | "crypto"
export type MarketRange = "1d" | "5d" | "1mo" | "6mo" | "1y" | "5y"

export interface MarketQuote {
  price: number
  previous_close: number | null
  change_pct: number | null
  day_high: number | null
  day_low: number | null
  year_high: number | null
  year_low: number | null
  updated_at: string | null
}

export interface MarketHolding {
  quantity: number
  /** Na moeda do código. */
  average_price: number
  cost_brl: number
  realized_brl: number
  value_brl: number | null
  gain_brl: number | null
  gain_pct: number | null
  day_change_brl: number | null
}

export interface MarketTrade {
  id: number
  symbol_id: number
  side: "buy" | "sell"
  date: string
  quantity: number
  price: number
  fx_rate: number
  /** Corretagem e taxas, em reais. */
  fees: number
  account_id: number | null
  notes: string | null
}

export interface MarketSymbol {
  id: number
  code: string
  kind: MarketKind
  name: string
  /** Moeda da cotação (BRL, USD). */
  currency: string
  /** Reais por unidade da moeda; null sem cotação. */
  rate: number | null
  quote: MarketQuote | null
  holding: MarketHolding | null
  trades: MarketTrade[]
}

export interface TaxLine {
  sales: number
  realized: number
  exempt_until: number
  rate: number
  tax: number
}

export interface MarketOverview {
  symbols: MarketSymbol[]
  portfolio: {
    value_brl: number
    cost_brl: number
    gain_brl: number
    gain_pct: number | null
    day_change_brl: number
    day_change_pct: number | null
    missing_quotes: boolean
  }
  /** IR estimado do mês (ações da B3 e cripto). */
  tax: { month: string; stock: TaxLine; crypto: TaxLine }
}

export interface PricePoint {
  t: number
  v: number
}

export interface PortfolioPoint {
  date: string
  value: number
  invested: number
}

export type CalendarKind = "bill" | "income" | "loan" | "expectation" | "goal" | "event"

export interface CalendarEvent {
  id: number
  title: string
  date: string
  amount: number | null
  /** "in" entra dinheiro, "out" sai; null é só lembrete. */
  direction: "in" | "out" | null
  color: string
  notes: string | null
}

export interface CalendarItem {
  key: string
  kind: CalendarKind
  date: string
  title: string
  amount: number | null
  direction: "in" | "out" | null
  /** done = já aconteceu (pago/recebido); overdue = passou e não foi lançado. */
  status: "done" | "overdue" | "postponed" | null
  link: string | null
  /** Só nos eventos livres: para editar. */
  event?: CalendarEvent
}
