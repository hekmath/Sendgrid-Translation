import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { apiKey: incomingKey } = await request.json()
    const resolvedApiKey = (incomingKey as string | undefined)?.trim() || process.env.SENDGRID_API_KEY || process.env.NEXT_PUBLIC_SENDGRID_API_KEY

    if (!resolvedApiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    console.log("[v0] Making request to SendGrid API...")

    // Fetch templates from SendGrid
    const response = await fetch("https://api.sendgrid.com/v3/templates?generations=dynamic", {
      headers: {
        Authorization: `Bearer ${resolvedApiKey}`,
        "Content-Type": "application/json",
      },
    })

    console.log("[v0] SendGrid API response status:", response.status)

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      console.error("[v0] SendGrid API error response:", errorData)
      return NextResponse.json(
        { error: errorData.errors?.[0]?.message || `SendGrid API error: ${response.status}` },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("[v0] SendGrid API response:", JSON.stringify(data).substring(0, 200) + "...")

    let templates = []

    if (data && Array.isArray(data.templates)) {
      templates = data.templates
      console.log("[v0] Using data.templates array")
    } else if (data && Array.isArray(data.result)) {
      templates = data.result
      console.log("[v0] Using data.result array")
    } else if (Array.isArray(data)) {
      templates = data
      console.log("[v0] Using direct array")
    } else {
      console.error("[v0] Unexpected API response structure:", JSON.stringify(data).substring(0, 200))
      return NextResponse.json(
        {
          error: "Unexpected response format from SendGrid API",
          debug: { receivedData: data },
        },
        { status: 500 },
      )
    }

    console.log("[v0] Found templates:", templates.length)

    if (templates.length === 0) {
      return NextResponse.json({ result: [] })
    }

    // Fetch detailed information for each template including versions
    const templatesWithVersions = await Promise.all(
      templates.map(async (template: any) => {
        try {
          const versionResponse = await fetch(`https://api.sendgrid.com/v3/templates/${template.id}`, {
            headers: {
              Authorization: `Bearer ${resolvedApiKey}`,
              "Content-Type": "application/json",
            },
          })

          if (versionResponse.ok) {
            const versionData = await versionResponse.json()
            return {
              ...template,
              versions: versionData.versions || [],
            }
          }

          return {
            ...template,
            versions: [],
          }
        } catch (error) {
          console.error(`[v0] Error fetching versions for template ${template.id}:`, error)
          return {
            ...template,
            versions: [],
          }
        }
      }),
    )

    console.log("[v0] Successfully processed templates with versions")
    return NextResponse.json({ result: templatesWithVersions })
  } catch (error) {
    console.error("[v0] SendGrid API error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        debug: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
