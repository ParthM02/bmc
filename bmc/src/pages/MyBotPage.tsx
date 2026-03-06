import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

type UserSettingsRow = {
  tiktok_investment_amount: number | string | null
  twitter_investment_amount: number | string | null
  aggressiveness: string | null
  public_wallet_key: string | null
  bot_on: boolean
}

const formatUsd = (value: number | string | null) => {
  const numeric = Number(value ?? 0)

  if (Number.isNaN(numeric)) {
    return '$0.00'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)
}

export const MyBotPage = () => {
  const [settings, setSettings] = useState<UserSettingsRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchSettings = async () => {
      setLoading(true)
      setError(null)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        if (!user) {
          throw new Error('No authenticated user found.')
        }

        const { data, error: settingsError } = await supabase
          .from('user_settings')
          .select(
            'tiktok_investment_amount, twitter_investment_amount, aggressiveness, public_wallet_key, bot_on'
          )
          .eq('id', user.id)
          .maybeSingle()

        if (settingsError) {
          throw settingsError
        }

        if (mounted) {
          setSettings(data)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load user settings.')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void fetchSettings()

    return () => {
      mounted = false
    }
  }, [])

  const formattedMode = useMemo(() => {
    if (!settings?.aggressiveness) {
      return 'balanced'
    }

    return settings.aggressiveness
  }, [settings?.aggressiveness])

  return (
    <section className="placeholder-card" aria-label="My Bot settings">
      <h2 className="page-title">My Bot</h2>

      {loading && <p className="status">Loading your bot settings...</p>}

      {!loading && error && <p className="status error">{error}</p>}

      {!loading && !error && !settings && (
        <p className="status">No settings found yet for your account.</p>
      )}

      {!loading && !error && settings && (
        <div className="summary-grid" aria-label="User bot settings">
          <article className="summary-card">
            <span className="summary-label">TikTok Investment</span>
            <span className="summary-value">{formatUsd(settings.tiktok_investment_amount)}</span>
          </article>

          <article className="summary-card">
            <span className="summary-label">Twitter Investment</span>
            <span className="summary-value">{formatUsd(settings.twitter_investment_amount)}</span>
          </article>

          <article className="summary-card">
            <span className="summary-label">Aggressiveness</span>
            <span className="summary-value">{formattedMode}</span>
          </article>

          <article className="summary-card">
            <span className="summary-label">Bot Status</span>
            <span className="summary-value">{settings.bot_on ? 'On' : 'Off'}</span>
          </article>

          <article className="summary-card">
            <span className="summary-label">Public Wallet Key</span>
            <span className="summary-value mono-value">{settings.public_wallet_key || 'Not set'}</span>
          </article>
        </div>
      )}
    </section>
  )
}
