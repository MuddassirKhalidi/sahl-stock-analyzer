import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"

export function LandingPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)

    try {
      const { data: existing } = await supabase
        .from("portfolios")
        .select("id")
        .eq("email", trimmed)
        .maybeSingle()

      let portfolioId: string

      if (existing) {
        portfolioId = existing.id
      } else {
        const { data: created, error: insertError } = await supabase
          .from("portfolios")
          .insert({ email: trimmed })
          .select("id")
          .single()

        if (insertError) throw insertError
        portfolioId = created.id
      }

      navigate("/dashboard", { state: { portfolioId } })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{
        background:
          "linear-gradient(135deg, #1a0a2e 0%, #1E003D 25%, #2D1B4E 50%, #1E003D 75%, #1a0a2e 100%)",
      }}
    >
      <div className="w-full max-w-xl flex flex-col items-center gap-8">
        <header className="text-center space-y-3">
          <h1 className="text-5xl md:text-6xl font-semibold text-white tracking-tight">
            Sahl
          </h1>
          <p className="text-lg md:text-xl font-light text-[#B8B8D0]">
            Understand your portfolio before the market does.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md flex flex-col items-center gap-4"
        >
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 px-4 text-base bg-[#2D1B4E]/80 border-[#4B3A6B] text-white placeholder:text-[#B8B8D0] focus-visible:ring-[#8B7EC8]/50"
          />
          {error && (
            <p className="text-sm text-rose-400">{error}</p>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full h-12 text-base font-medium bg-[#8B7EC8] text-white hover:bg-[#9D8FD4] disabled:opacity-50"
          >
            {loading ? "Entering…" : "Enter Sahl"}
          </Button>
        </form>
      </div>
    </div>
  )
}
