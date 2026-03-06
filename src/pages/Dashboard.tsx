import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/types/supabase"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TransactionType = "Deposit" | "Withdraw" | "Buy" | "Sell"

interface Holding {
  symbol: string
  quantity: number
  averageCost: number
  marketValue: number
}

interface Transaction {
  id: string
  time: string
  type: TransactionType
  symbol: string
  quantity: number
  amount: number
  notes: string
}

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return "—"
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value)

export function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const portfolioId = (location.state as { portfolioId?: string })?.portfolioId

  const [holdings, setHoldings] = useState<Holding[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [netCash, setNetCash] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportMessage, setReportMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [email, setEmail] = useState<string | null>(null)

  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined

  const totalMarketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
  const netAssets = netCash + totalMarketValue

  const fetchData = useCallback(async () => {
    if (!portfolioId) return
    setLoading(true)
    setError(null)
    try {
      const [summaryRes, positionsRes, historyRes] = await Promise.all([
        supabase.from("portfolio_summary").select("*").eq("portfolio_id", portfolioId).single(),
        supabase.from("positions").select("*").eq("portfolio_id", portfolioId),
        supabase.from("transaction_history").select("*").eq("portfolio_id", portfolioId).order("created_at", { ascending: false }),
      ])

      if (summaryRes.error) throw summaryRes.error
      if (positionsRes.error) throw positionsRes.error
      if (historyRes.error) throw historyRes.error

      setNetCash(summaryRes.data?.net_cash ?? 0)
      setEmail(summaryRes.data?.email ?? null)

      setHoldings(
        (positionsRes.data ?? []).map((p: Tables<"positions">) => ({
          symbol: p.symbol,
          quantity: p.quantity ?? 0,
          averageCost: p.avg_cost ?? 0,
          marketValue: (p.quantity ?? 0) * (p.avg_cost ?? 0),
        }))
      )

      setTransactions(
        (historyRes.data ?? []).map((h: Tables<"transaction_history">) => {
          const dbType = (h.transaction_type ?? "DEPOSIT").toUpperCase()
          const typeMap: Record<string, TransactionType> = {
            DEPOSIT: "Deposit",
            WITHDRAW: "Withdraw",
            BUY: "Buy",
            SELL: "Sell",
          }
          const type = typeMap[dbType] ?? "Deposit"
          const rawAmount = h.amount ?? 0
          const amount =
            type === "Withdraw" || type === "Buy" ? -rawAmount : rawAmount
          return {
            id: h.created_at ?? crypto.randomUUID(),
            time: formatTime(h.created_at),
            type,
            symbol: "",
            quantity: 0,
            amount,
            notes: h.notes ?? "",
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load portfolio")
    } finally {
      setLoading(false)
    }
  }, [portfolioId])

  useEffect(() => {
    if (!portfolioId) {
      navigate("/", { replace: true })
      return
    }
    fetchData()
  }, [portfolioId, navigate, fetchData])

  const handleDeposit = async (amount: number) => {
    if (!portfolioId) return
    const { error: err } = await supabase.rpc("deposit_cash", {
      p_portfolio_id: portfolioId,
      p_amount: amount,
      p_notes: undefined,
    })
    if (err) {
      setError(err.message)
      return
    }
    await fetchData()
  }

  const handleWithdraw = async (amount: number) => {
    if (!portfolioId) return
    const { error: err } = await supabase.rpc("withdraw_cash", {
      p_portfolio_id: portfolioId,
      p_amount: amount,
      p_notes: undefined,
    })
    if (err) {
      setError(err.message)
      return
    }
    await fetchData()
  }

  const handleBuy = async (symbol: string, quantity: number, pricePerShare: number) => {
    if (!portfolioId) return
    const { error: err } = await supabase.rpc("buy_stock", {
      p_portfolio_id: portfolioId,
      p_symbol: symbol,
      p_quantity: quantity,
      p_price: pricePerShare,
      p_fees: 0,
      p_notes: `@ ${formatCurrency(pricePerShare)}/share`,
    })
    if (err) {
      setError(err.message)
      return
    }
    await fetchData()
  }

  const handleSell = async (symbol: string, quantity: number, pricePerShare: number) => {
    if (!portfolioId) return
    const { error: err } = await supabase.rpc("sell_stock", {
      p_portfolio_id: portfolioId,
      p_symbol: symbol,
      p_quantity: quantity,
      p_price: pricePerShare,
      p_fees: 0,
      p_notes: `@ ${formatCurrency(pricePerShare)}/share`,
    })
    if (err) {
      setError(err.message)
      return
    }
    await fetchData()
  }

  const SAMPLE_PORTFOLIO_ID = "9f8e7d66-1c2f-4c8c-8a7a-2e6a1b0d1111"

  const handleImportSample = async () => {
    if (!portfolioId) return
    try {
      setError(null)
      const [summaryRes, positionsRes] = await Promise.all([
        supabase
          .from("portfolio_summary")
          .select("*")
          .eq("portfolio_id", SAMPLE_PORTFOLIO_ID)
          .single(),
        supabase
          .from("positions")
          .select("*")
          .eq("portfolio_id", SAMPLE_PORTFOLIO_ID),
      ])

      if (summaryRes.error) throw summaryRes.error
      if (positionsRes.error) throw positionsRes.error

      const netCash = summaryRes.data?.net_cash ?? 0
      const positions = positionsRes.data ?? []

      const costOfPositions = positions.reduce(
        (sum, pos) => sum + (pos.quantity ?? 0) * (pos.avg_cost ?? 0),
        0
      )
      const depositAmount = netCash + costOfPositions

      if (depositAmount > 0) {
        const { error: depositErr } = await supabase.rpc("deposit_cash", {
          p_portfolio_id: portfolioId,
          p_amount: depositAmount,
          p_notes: "Sample portfolio import",
        })
        if (depositErr) throw depositErr
      }

      for (const pos of positions) {
        const qty = pos.quantity ?? 0
        const avgCost = pos.avg_cost ?? 0
        if (qty <= 0 || avgCost <= 0) continue
        const { error: buyErr } = await supabase.rpc("buy_stock", {
          p_portfolio_id: portfolioId,
          p_symbol: pos.symbol,
          p_quantity: qty,
          p_price: avgCost,
          p_fees: 0,
          p_notes: undefined,
        })
        if (buyErr) throw buyErr
      }

      await fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import sample")
    }
  }

  const handleSendAnalysisReport = async () => {
    if (!portfolioId || !webhookUrl?.trim()) {
      setReportMessage({ type: "error", text: "Webhook URL not configured." })
      return
    }
    setReportLoading(true)
    setReportMessage(null)
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId,
          email: email ?? undefined,
          netCash,
          totalMarketValue,
          netAssets,
          holdings,
        }),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      setReportMessage({ type: "success", text: "Analysis report sent." })
    } catch (err) {
      setReportMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to send report",
      })
    } finally {
      setReportLoading(false)
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#1a0a2e" }}
      >
        <p className="text-[#B8B8D0]">Loading portfolio…</p>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "#1a0a2e" }}
    >
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
        {error && (
          <div className="rounded-lg bg-rose-500/20 border border-rose-500/50 px-4 py-3 text-rose-400 text-sm">
            {error}
          </div>
        )}
        {/* Portfolio Summary Card */}
        <Card className="border-[#4B3A6B] bg-[#2D1B4E]/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[#B8B8D0]">
              Portfolio Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
                {formatCurrency(netAssets)}
              </p>
              <p className="text-sm text-[#B8B8D0] mt-1">
                Net Assets
              </p>
            </div>
            <div className="flex gap-8 text-sm">
              <div>
                <span className="text-[#B8B8D0]">Net Cash: </span>
                <span className="font-medium text-white">{formatCurrency(netCash)}</span>
              </div>
              <div>
                <span className="text-[#B8B8D0]">Market Value: </span>
                <span className="font-medium text-white">
                  {formatCurrency(totalMarketValue)}
                </span>
              </div>
            </div>
            {reportMessage && (
              <p
                className={
                  reportMessage.type === "success"
                    ? "text-sm text-emerald-400"
                    : "text-sm text-rose-400"
                }
              >
                {reportMessage.text}
              </p>
            )}
            <Button
              size="lg"
              onClick={handleSendAnalysisReport}
              disabled={reportLoading}
              className="w-full sm:w-auto bg-[#8B7EC8] text-white hover:bg-[#9D8FD4] disabled:opacity-50"
            >
              {reportLoading ? "Sending…" : "Send Analysis Report"}
            </Button>
          </CardContent>
        </Card>

        {/* Holdings Section */}
        <section>
          <h2 className="text-lg font-medium mb-4 text-white">Holdings</h2>
          {holdings.length === 0 ? (
            <Card className="border-[#4B3A6B] bg-[#2D1B4E]/80">
              <CardContent className="py-12 text-center">
                <p className="text-[#B8B8D0] mb-4">
                  No holdings yet. Import a sample portfolio to begin analysis.
                </p>
                <Button
                  variant="outline"
                  onClick={handleImportSample}
                  className="border-[#4B3A6B] text-[#8B7EC8] hover:bg-[#8B7EC8]/20"
                >
                  Import Sample Portfolio
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-[#4B3A6B] bg-[#2D1B4E]/80">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#4B3A6B]">
                    <TableHead className="text-[#B8B8D0]">Symbol</TableHead>
                    <TableHead className="text-[#B8B8D0]">Quantity</TableHead>
                    <TableHead className="text-[#B8B8D0]">Average Cost</TableHead>
                    <TableHead className="text-[#B8B8D0]">Market Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={h.symbol} className="border-[#4B3A6B]">
                      <TableCell className="font-medium text-white">{h.symbol}</TableCell>
                      <TableCell className="text-white">{h.quantity}</TableCell>
                      <TableCell className="text-white">{formatCurrency(h.averageCost)}</TableCell>
                      <TableCell className="text-white">{formatCurrency(h.marketValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </section>

        {/* Transaction Controls */}
        <section>
          <h2 className="text-lg font-medium mb-4 text-white">Portfolio Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DepositDialog onDeposit={handleDeposit} />
            <WithdrawDialog onWithdraw={handleWithdraw} />
            <BuyDialog onBuy={handleBuy} />
            <SellDialog onSell={handleSell} holdings={holdings} />
          </div>
        </section>

        {/* Transaction History */}
        <section>
          <h2 className="text-lg font-medium mb-4 text-white">Transaction History</h2>
          <Card className="border-[#4B3A6B] bg-[#2D1B4E]/80">
            {transactions.length === 0 ? (
              <CardContent className="py-12 text-center text-[#B8B8D0] text-sm">
                No transactions yet.
              </CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#4B3A6B]">
                    <TableHead className="text-[#B8B8D0]">Time</TableHead>
                    <TableHead className="text-[#B8B8D0]">Type</TableHead>
                    <TableHead className="text-[#B8B8D0]">Symbol</TableHead>
                    <TableHead className="text-[#B8B8D0]">Quantity</TableHead>
                    <TableHead className="text-[#B8B8D0]">Amount</TableHead>
                    <TableHead className="text-[#B8B8D0]">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id} className="border-[#4B3A6B]">
                      <TableCell className="text-[#B8B8D0] text-xs">
                        {tx.time}
                      </TableCell>
                      <TableCell className="text-white">{tx.type}</TableCell>
                      <TableCell className="text-white">{tx.symbol || "—"}</TableCell>
                      <TableCell className="text-white">{tx.quantity || "—"}</TableCell>
                      <TableCell
                        className={
                          tx.amount >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-[#B8B8D0] text-xs">
                        {tx.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </section>
      </div>
    </div>
  )
}

function DepositDialog({
  onDeposit,
}: {
  onDeposit: (amount: number) => void
}) {
  const [amount, setAmount] = useState("")
  const [open, setOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (!isNaN(val) && val > 0) {
      onDeposit(val)
      setAmount("")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full border-[#4B3A6B] text-[#8B7EC8] hover:bg-[#8B7EC8]/20">Deposit Cash</Button>} />
      <DialogContent className="bg-[#2D1B4E] border-[#4B3A6B] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Deposit Cash</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deposit-amount" className="text-[#B8B8D0]">Amount</Label>
            <Input
              id="deposit-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <DialogFooter className="border-[#4B3A6B] bg-[#1E003D]/50">
            <Button type="submit" className="bg-[#8B7EC8] text-white hover:bg-[#9D8FD4]">Deposit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function WithdrawDialog({
  onWithdraw,
}: {
  onWithdraw: (amount: number) => void
}) {
  const [amount, setAmount] = useState("")
  const [open, setOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const val = parseFloat(amount)
    if (!isNaN(val) && val > 0) {
      onWithdraw(val)
      setAmount("")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full border-[#4B3A6B] text-[#8B7EC8] hover:bg-[#8B7EC8]/20">Withdraw Cash</Button>} />
      <DialogContent className="bg-[#2D1B4E] border-[#4B3A6B] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Withdraw Cash</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="withdraw-amount" className="text-[#B8B8D0]">Amount</Label>
            <Input
              id="withdraw-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <DialogFooter className="border-[#4B3A6B] bg-[#1E003D]/50">
            <Button type="submit" className="bg-[#8B7EC8] text-white hover:bg-[#9D8FD4]">Withdraw</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function BuyDialog({ onBuy }: { onBuy: (s: string, q: number, p: number) => void }) {
  const [symbol, setSymbol] = useState("")
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState("")
  const [open, setOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = parseInt(quantity, 10)
    const p = parseFloat(price)
    if (symbol.trim() && !isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      onBuy(symbol.trim().toUpperCase(), q, p)
      setSymbol("")
      setQuantity("")
      setPrice("")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full border-[#4B3A6B] text-[#8B7EC8] hover:bg-[#8B7EC8]/20">Buy Stock</Button>} />
      <DialogContent className="bg-[#2D1B4E] border-[#4B3A6B] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Buy Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buy-symbol" className="text-[#B8B8D0]">Stock Symbol</Label>
            <Input
              id="buy-symbol"
              placeholder="e.g. AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buy-quantity" className="text-[#B8B8D0]">Quantity</Label>
            <Input
              id="buy-quantity"
              type="number"
              min="1"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buy-price" className="text-[#B8B8D0]">Price per share</Label>
            <Input
              id="buy-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <DialogFooter className="border-[#4B3A6B] bg-[#1E003D]/50">
            <Button type="submit" className="bg-[#8B7EC8] text-white hover:bg-[#9D8FD4]">Buy</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SellDialog({
  onSell,
}: {
  onSell: (s: string, q: number, p: number) => void
  holdings?: Holding[]
}) {
  const [symbol, setSymbol] = useState("")
  const [quantity, setQuantity] = useState("")
  const [price, setPrice] = useState("")
  const [open, setOpen] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = parseInt(quantity, 10)
    const p = parseFloat(price)
    if (symbol.trim() && !isNaN(q) && q > 0 && !isNaN(p) && p > 0) {
      onSell(symbol.trim().toUpperCase(), q, p)
      setSymbol("")
      setQuantity("")
      setPrice("")
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full border-[#4B3A6B] text-[#8B7EC8] hover:bg-[#8B7EC8]/20">Sell Stock</Button>} />
      <DialogContent className="bg-[#2D1B4E] border-[#4B3A6B] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Sell Stock</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sell-symbol" className="text-[#B8B8D0]">Stock Symbol</Label>
            <Input
              id="sell-symbol"
              placeholder="e.g. AAPL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sell-quantity" className="text-[#B8B8D0]">Quantity</Label>
            <Input
              id="sell-quantity"
              type="number"
              min="1"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sell-price" className="text-[#B8B8D0]">Price per share</Label>
            <Input
              id="sell-price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="bg-[#1E003D] border-[#4B3A6B] text-white placeholder:text-[#B8B8D0]"
            />
          </div>
          <DialogFooter className="border-[#4B3A6B] bg-[#1E003D]/50">
            <Button type="submit" className="bg-[#8B7EC8] text-white hover:bg-[#9D8FD4]">Sell</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
