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

type CopyToast = {
  kind: 'success' | 'error' | 'info'
  message: string
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
  const [copyToast, setCopyToast] = useState<CopyToast | null>(null)

  useEffect(() => {
    if (!copyToast) {
      return
    }

    const timer = window.setTimeout(() => {
      setCopyToast(null)
    }, 2600)

    return () => {
      window.clearTimeout(timer)
    }
  }, [copyToast])

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

        if (data) {
          if (mounted) {
            setSettings(data)
            setForm(toFormState(data))
          }
          return
        }

        const { data: initializedData, error: initializeError } = await supabase
          .from('user_settings')
          .upsert({ id: user.id }, { onConflict: 'id' })
          .select(
            'tiktok_investment_amount, twitter_investment_amount, aggressiveness, public_wallet_key, bot_on'
          )
          .single()

        if (initializeError) {
          throw initializeError
        }

        if (mounted) {
          setSettings(initializedData)
          setForm(toFormState(initializedData))
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

  const onCopyWallet = async () => {
    const wallet = settings?.public_wallet_key?.trim()

    if (!wallet) {
      setCopyToast({ kind: 'info', message: 'Wallet address is not set.' })
      return
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(wallet)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = wallet
        textArea.setAttribute('readonly', '')
        textArea.style.position = 'absolute'
        textArea.style.left = '-9999px'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }

      setCopyToast({ kind: 'success', message: 'Wallet address copied.' })
    } catch {
      setCopyToast({ kind: 'error', message: 'Failed to copy wallet address.' })
    }
  }

  return (
    <section className="placeholder-card" aria-label="My Bot settings">
      {copyToast && (
        <div className={`copy-toast ${copyToast.kind}`} role="status" aria-live="polite">
          {copyToast.message}
        </div>
      )}

      <h2 className="page-title">My Bot</h2>

      <section className="warning-banner" role="note" aria-live="polite">
        <p>⚠️ Security Reminder: Save your wallet keys externally as soon as possible.</p>
        <p>
          It is highly recommended that you use an additional wallet tracking app (for example, Phantom)
          as a backup view for your wallet activity. You can find your important keys in your profile.
        </p>
      </section>

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
          <div className="wallet-copy-row">
            <p className="status wallet-copy-text">
              Send your Solana to this wallet address:{' '}
              <strong className="mono-value">{settings.public_wallet_key || 'Not set'}</strong>
            </p>

            <button
              className="nav-btn"
              type="button"
              onClick={() => {
                void onCopyWallet()
              }}
              disabled={!settings.public_wallet_key}
            >
              Copy
            </button>
          </div>

          <div className="table-wrap settings-table-wrap">
            <table className="bot-settings-table">
              <thead>
                <tr>
                  <th scope="col">TikTok Amount (SOL)</th>
                  <th scope="col">Twitter Amount (SOL)</th>
                  <th scope="col">Aggressiveness</th>
                  <th scope="col">Bot</th>
                  <th scope="col">Apply</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td>
                    <input
                      id="tiktok-amount"
                      className="auth-input compact-input no-spin"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.tiktokAmount}
                      onChange={(event) => {
                        setForm((prev) => (prev ? { ...prev, tiktokAmount: event.target.value } : prev))
                      }}
                    />
                  </td>

                  <td>
                    <input
                      id="twitter-amount"
                      className="auth-input compact-input no-spin"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={form.twitterAmount}
                      onChange={(event) => {
                        setForm((prev) => (prev ? { ...prev, twitterAmount: event.target.value } : prev))
                      }}
                    />
                  </td>

                  <td>
                    <div className="mode-switch-group compact" role="radiogroup" aria-label="Bot aggressiveness">
                      {BOT_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          role="radio"
                          aria-checked={form.aggressiveness === mode.value}
                          className={`mode-option compact ${form.aggressiveness === mode.value ? 'active' : ''}`}
                          onClick={() => {
                            setForm((prev) => (prev ? { ...prev, aggressiveness: mode.value } : prev))
                          }}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </td>

                  <td>
                    <label className="toggle-switch" htmlFor="bot-on-switch" aria-label="Bot status">
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
                  </td>

                  <td>
                    <button className="nav-btn" type="submit" disabled={!hasChanges || saving}>
                      {saving ? 'Applying...' : 'Apply'}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {saveError && <p className="status error">{saveError}</p>}
          {saveMessage && <p className="status">{saveMessage}</p>}
        </form>
      )}
    </section>
  )
}
