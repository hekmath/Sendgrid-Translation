import { NextRequest, NextResponse } from "next/server"

const DEFAULT_ALLOWED_PREFIX = "NEXT_PUBLIC_"

const configuredAllowlist = new Set(
  (process.env.SENDGRID_TEMPLATE_ENV_ALLOWLIST || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
)

const isAllowedKey = (key: string) => {
  if (!key) return false
  if (key.startsWith(DEFAULT_ALLOWED_PREFIX)) {
    return true
  }

  return configuredAllowlist.has(key)
}

export async function POST(request: NextRequest) {
  try {
    const { keys } = await request.json()

    if (!Array.isArray(keys)) {
      return NextResponse.json({ error: "Request body must include a keys array" }, { status: 400 })
    }

    const result: Record<string, string> = {}
    const rejected: string[] = []

    keys.forEach((incoming) => {
      if (typeof incoming !== "string") {
        return
      }

      const key = incoming.trim()
      if (!key) {
        return
      }

      if (!isAllowedKey(key)) {
        rejected.push(key)
        return
      }

      const value = process.env[key]
      if (value !== undefined) {
        result[key] = value
      }
    })

    return NextResponse.json({ result, rejected })
  } catch (error) {
    console.error("[Env API] Failed to resolve template env keys", error)
    return NextResponse.json({ error: "Failed to resolve environment variables" }, { status: 500 })
  }
}
