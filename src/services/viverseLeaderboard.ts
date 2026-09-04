const VIVERSE_SDK_URL = 'https://www.viverse.com/static-assets/viverse-sdk/1.3.3/index.umd.cjs'
export const VIVERSE_APP_ID = 'jpr6pvkrcm'
export const LEADERBOARD_NAME = 'highest-score'

const PENDING_SCORE_KEY = 'raiden.viversePendingScore'
const SDK_LOAD_TIMEOUT_MS = 5000
const API_TIMEOUT_MS = 5000
const AUTH_TIMEOUT_MS = 1800

type AuthResult = {
  access_token: string
  account_id: string
  expires_in: number
  state?: string
}

type ViverseClient = {
  checkAuth: () => Promise<AuthResult | undefined>
  getToken: () => Promise<string | undefined>
  loginWithWorlds: (options?: { state?: string }) => void
}

type LeaderboardConfig = {
  name: string
  range_start: number
  range_end: number
  region: 'global' | 'local'
  time_range: 'alltime' | 'daily' | 'weekly' | 'monthly'
  around_user?: boolean
  country_code?: string
}

export type ViverseRankingEntry = {
  uid: string
  name: string
  value: number
  rank: number
}

type LeaderboardResponse = {
  ranking?: ViverseRankingEntry[]
  total_count?: number
}

type GameDashboardClient = {
  getLeaderboard: (appID: string, config: LeaderboardConfig) => Promise<LeaderboardResponse>
  getGuestLeaderboard: (appID: string, config: LeaderboardConfig) => Promise<LeaderboardResponse>
  uploadLeaderboardScore: (appID: string, scores: { name: string; value: string }[]) => Promise<unknown>
}

type ViverseSdk = {
  client: new (options: { clientId: string; domain: string; cookieDomain?: string }) => ViverseClient
  gameDashboard: new (options: { baseURL: string; communityBaseURL: string; token?: string }) => GameDashboardClient
}

declare global {
  interface Window {
    viverse?: ViverseSdk
  }
}

let sdkPromise: Promise<ViverseSdk> | null = null
let clientPromise: Promise<ViverseClient> | null = null

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => { window.clearTimeout(id); resolve(value) },
      (error) => { window.clearTimeout(id); reject(error) },
    )
  })
}

function loadSdk(): Promise<ViverseSdk> {
  if (window.viverse) return Promise.resolve(window.viverse)
  if (sdkPromise) return sdkPromise

  sdkPromise = withTimeout(new Promise<ViverseSdk>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${VIVERSE_SDK_URL}"]`)
    const script = existing ?? document.createElement('script')

    const finish = () => {
      if (window.viverse) resolve(window.viverse)
      else reject(new Error('VIVERSE SDK loaded without global API'))
    }

    script.addEventListener('load', finish, { once: true })
    script.addEventListener('error', () => reject(new Error('Unable to load VIVERSE SDK')), { once: true })

    if (!existing) {
      script.src = VIVERSE_SDK_URL
      script.async = true
      document.head.appendChild(script)
    }
  }), SDK_LOAD_TIMEOUT_MS, 'VIVERSE SDK load timeout').catch((error) => {
    sdkPromise = null
    throw error
  })

  return sdkPromise
}

async function getClient(): Promise<ViverseClient> {
  if (clientPromise) return clientPromise
  clientPromise = loadSdk().then((sdk) => new sdk.client({
    clientId: VIVERSE_APP_ID,
    domain: 'account.htcvive.com',
  })).catch((error) => {
    clientPromise = null
    throw error
  })
  return clientPromise
}

function dashboard(sdk: ViverseSdk, token?: string) {
  return new sdk.gameDashboard({
    baseURL: 'https://www.viveport.com/',
    communityBaseURL: 'https://www.viverse.com/',
    token,
  })
}

const baseConfig: LeaderboardConfig = {
  name: LEADERBOARD_NAME,
  range_start: 0,
  range_end: 10,
  region: 'global',
  time_range: 'alltime',
  around_user: false,
}

async function tryAuth(): Promise<AuthResult | undefined> {
  try {
    const client = await getClient()
    return await withTimeout(client.checkAuth(), AUTH_TIMEOUT_MS, 'VIVERSE auth timeout')
  } catch {
    // Netlify/external hosting may not have a usable VIVERSE SSO context.
    // Leaderboard viewing must still work through the guest API.
    return undefined
  }
}

export async function getViverseAuth(): Promise<AuthResult | undefined> {
  return tryAuth()
}

export async function fetchGlobalTop10(): Promise<{ entries: ViverseRankingEntry[]; loggedIn: boolean }> {
  const sdk = await loadSdk()

  // Do not block the public leaderboard on authentication. VIVERSE exposes a
  // dedicated guest endpoint, so Netlify builds can show scores even when SSO
  // is unavailable outside a VIVERSE-hosted experience.
  const guestPromise = withTimeout(
    dashboard(sdk).getGuestLeaderboard(VIVERSE_APP_ID, {
      ...baseConfig,
      country_code: 'US',
    }),
    API_TIMEOUT_MS,
    'VIVERSE leaderboard timeout',
  )
  const authPromise = tryAuth()

  const [result, auth] = await Promise.all([guestPromise, authPromise])
  const entries = (result.ranking ?? [])
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 10)

  return { entries, loggedIn: Boolean(auth?.access_token) }
}

export async function submitViverseScore(score: number): Promise<boolean> {
  if (!Number.isFinite(score) || score < 0) return false
  const sdk = await loadSdk()
  const auth = await tryAuth()
  if (!auth?.access_token) return false

  await withTimeout(
    dashboard(sdk, auth.access_token).uploadLeaderboardScore(VIVERSE_APP_ID, [
      { name: LEADERBOARD_NAME, value: String(Math.floor(score)) },
    ]),
    API_TIMEOUT_MS,
    'VIVERSE score upload timeout',
  )
  return true
}

export async function loginToSubmitScore(score: number) {
  try {
    localStorage.setItem(PENDING_SCORE_KEY, String(Math.max(0, Math.floor(score))))
  } catch { /* localStorage may be unavailable in privacy modes */ }

  const client = await withTimeout(getClient(), SDK_LOAD_TIMEOUT_MS, 'VIVERSE login unavailable')
  client.loginWithWorlds({ state: 'neon-raiden-leaderboard' })
}

export async function submitPendingViverseScore(): Promise<boolean> {
  let pending: number | null = null
  try {
    const raw = localStorage.getItem(PENDING_SCORE_KEY)
    if (raw !== null) {
      const parsed = Number(raw)
      if (Number.isFinite(parsed) && parsed >= 0) pending = parsed
    }
  } catch { /* ignore */ }

  if (pending === null) return false

  const submitted = await submitViverseScore(pending)
  if (submitted) {
    try { localStorage.removeItem(PENDING_SCORE_KEY) } catch { /* ignore */ }
  }
  return submitted
}
