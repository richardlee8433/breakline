const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) }
}

function cleanName(input) {
  return String(input ?? '')
    .trim()
    .replace(/[^\p{L}\p{N}_\- .]/gu, '')
    .slice(0, 10)
}

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Leaderboard is not configured')
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const rows = await supabase(
        'leaderboard?select=player_name,score,stage,loop,created_at&order=score.desc,created_at.asc&limit=10',
      )
      return json(200, { entries: rows || [] })
    }

    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

    const body = JSON.parse(event.body || '{}')
    const playerName = cleanName(body.playerName)
    const score = Number(body.score)
    const stage = Number(body.stage)
    const loop = Number(body.loop)
    const gameDuration = Number(body.gameDuration || 0)
    const gameVersion = String(body.gameVersion || 'web').slice(0, 32)

    if (playerName.length < 2) return json(400, { error: 'Name must be at least 2 characters' })
    if (!Number.isInteger(score) || score < 0 || score > 100000000) return json(400, { error: 'Invalid score' })
    if (!Number.isInteger(stage) || stage < 1 || stage > 3) return json(400, { error: 'Invalid stage' })
    if (!Number.isInteger(loop) || loop < 1 || loop > 99) return json(400, { error: 'Invalid loop' })
    if (!Number.isFinite(gameDuration) || gameDuration < 0 || gameDuration > 86400) return json(400, { error: 'Invalid duration' })

    // Lightweight sanity guard. It is intentionally generous: this blocks
    // obvious forged submissions without rejecting unusually strong real runs.
    const maxPlausible = 250000 + Math.max(0, loop - 1) * 750000 + stage * 250000
    if (score > maxPlausible * 20) return json(400, { error: 'Score failed validation' })

    await supabase('leaderboard', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        player_name: playerName,
        score,
        stage,
        loop,
        game_duration: Math.round(gameDuration),
        game_version: gameVersion,
      }),
    })

    const rows = await supabase(
      'leaderboard?select=player_name,score,stage,loop,created_at&order=score.desc,created_at.asc&limit=10',
    )
    return json(201, { entries: rows || [] })
  } catch (err) {
    console.error(err)
    return json(503, { error: 'Leaderboard unavailable' })
  }
}
