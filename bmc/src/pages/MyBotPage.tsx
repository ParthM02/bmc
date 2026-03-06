import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabaseClient'

type BotMode = 'aggressive' | 'balanced' | 'chill'

type UserSettingsRow = {
  tiktok_investment_amount: number | string | null
  twitter_investment_amount: number | string | null
  aggressiveness: BotMode | null
  public_wallet_key: string | null
  bot_on: boolean
}

const toSolNumber = (value: number | string | null) => {
  const numeric = Number(value ?? 0)
  return Number.isNaN(numeric) ? 0 : numeric
}

const formatSol = (value: number | string | null) => {
  const numeric = toSolNumber(value)

  return `${numeric.toFixed(2)} SOL`
}

const sanitizeMode = (value: string | null | undefined): BotMode => {
  if (value === 'aggressive' || value === 'balanced' || value === 'chill') {
    return value
  }

  return 'balanced'
}

const BOT_MODES: Array<{ label: string; value: BotMode }> = [
  { label: 'Aggressive', value: 'aggressive' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'Chill', value: 'chill' },
]

type FormState = {
  tiktokAmount: string
  twitterAmount: string
  aggressiveness: BotMode
  botOn: boolean
}

const toFormState = (settings: UserSettingsRow): FormState => ({
  tiktokAmount: toSolNumber(settings.tiktok_investment_amount).toString(),
  twitterAmount: toSolNumber(settings.twitter_investment_amount).toString(),
  aggressiveness: sanitizeMode(settings.aggressiveness),
  botOn: settings.bot_on,
})

export const MyBotPage = () => {
  const [userId, setUserId] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettingsRow | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

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

        if (mounted) {
          setUserId(user.id)
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
          if (data) {
            setSettings(data)
            setForm(toFormState(data))
          } else {
            const defaultSettings: UserSettingsRow = {
              tiktok_investment_amount: 0,
              twitter_investment_amount: 0,
              aggressiveness: 'balanced',
              public_wallet_key: null,
              bot_on: false,
            }
            setSettings(defaultSettings)
            setForm(toFormState(defaultSettings))
          }
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

  const hasChanges = useMemo(() => {
    if (!settings || !form) {
      return false
    }

    return (
      toSolNumber(form.tiktokAmount) !== toSolNumber(settings.tiktok_investment_amount) ||
      toSolNumber(form.twitterAmount) !== toSolNumber(settings.twitter_investment_amount) ||
      form.aggressiveness !== sanitizeMode(settings.aggressiveness) ||
      form.botOn !== settings.bot_on
    )
  }, [form, settings])

  const onApply = async () => {
    if (!userId || !form || !settings) {
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    const tiktokAmount = Math.max(0, toSolNumber(form.tiktokAmount))
    const twitterAmount = Math.max(0, toSolNumber(form.twitterAmount))

    try {
      const payload = {
        id: userId,
        tiktok_investment_amount: tiktokAmount,
        twitter_investment_amount: twitterAmount,
        aggressiveness: form.aggressiveness,
        public_wallet_key: settings.public_wallet_key,
        bot_on: form.botOn,
      }

      const { data, error: upsertError } = await supabase
        .from('user_settings')
        .upsert(payload, { onConflict: 'id' })
        .select(
          'tiktok_investment_amount, twitter_investment_amount, aggressiveness, public_wallet_key, bot_on'
        )
        .single()

      if (upsertError) {
        throw upsertError
      }

      setSettings(data)
      setForm(toFormState(data))
      setSaveMessage('Settings applied.')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to apply settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="placeholder-card" aria-label="My Bot settings">
      <h2 className="page-title">My Bot</h2>

      {loading && <p className="status">Loading your bot settings...</p>}

      {!loading && error && <p className="status error">{error}</p>}

      {!loading && !error && settings && form && (
        <form
          className="settings-form"
          aria-label="Edit bot settings"
          onSubmit={(event) => {
            event.preventDefault()
            void onApply()
          }}
        >
          <div className="form-grid">
            <label className="field-group" htmlFor="tiktok-amount">
              <span className="summary-label">TikTok Investment Amount</span>
              <span className="amount-input-wrap">
                <input
                  id="tiktok-amount"
                  className="auth-input"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.tiktokAmount}
                  onChange={(event) => {
                    setForm((prev) => (prev ? { ...prev, tiktokAmount: event.target.value } : prev))
                  }}
                />
                <span className="amount-suffix">SOL</span>
              </span>
            </label>

            <label className="field-group" htmlFor="twitter-amount">
              <span className="summary-label">Twitter Investment Amount</span>
              <span className="amount-input-wrap">
                <input
                  id="twitter-amount"
                  className="auth-input"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.twitterAmount}
                  onChange={(event) => {
                    setForm((prev) => (prev ? { ...prev, twitterAmount: event.target.value } : prev))
                  }}
                />
                <span className="amount-suffix">SOL</span>
              </span>
            </label>
          </div>

          <div className="field-group">
            <span className="summary-label">Bot Aggressiveness</span>
            <div className="mode-switch-group" role="radiogroup" aria-label="Bot aggressiveness">
              {BOT_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={form.aggressiveness === mode.value}
                  className={`mode-option ${form.aggressiveness === mode.value ? 'active' : ''}`}
                  onClick={() => {
                    setForm((prev) => (prev ? { ...prev, aggressiveness: mode.value } : prev))
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="toggle-row">
            <div>
              <span className="summary-label">Bot Status</span>
              <p className="status">{form.botOn ? 'Bot is On' : 'Bot is Off'}</p>
            </div>

            <label className="toggle-switch" htmlFor="bot-on-switch">
              <input
                id="bot-on-switch"
                type="checkbox"
                checked={form.botOn}
                onChange={(event) => {
                  setForm((prev) => (prev ? { ...prev, botOn: event.target.checked } : prev))
                }}
              />
              <span className="toggle-slider" aria-hidden="true" />
            </label>
          </div>

          <article className="summary-card">
            <span className="summary-label">Current Public Wallet Key</span>
            <span className="summary-value mono-value">{settings.public_wallet_key || 'Not set'}</span>
          </article>

          <article className="summary-card">
            <span className="summary-label">Preview</span>
            <span className="summary-value">TikTok: {formatSol(form.tiktokAmount)}</span>
            <span className="summary-value">Twitter: {formatSol(form.twitterAmount)}</span>
          </article>

          {saveError && <p className="status error">{saveError}</p>}
          {saveMessage && <p className="status">{saveMessage}</p>}

          <div className="form-actions">
            <button className="nav-btn" type="submit" disabled={!hasChanges || saving}>
              {saving ? 'Applying...' : 'Apply'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
