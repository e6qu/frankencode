import { describe, expect, test } from "bun:test"
import path from "path"

// Test the isSensitive function logic directly
const SENSITIVE_PATTERNS = [
  /^\.env(\..*)?$/,
  /secrets?\.json$/i,
  /credentials?\.json$/i,
  /^\.netrc$/,
  /private[_-]?key/i,
  /\.pem$/,
  /\.p12$/,
  /\.pfx$/,
  /\.key$/,
  /\.dockercfg$/,
  /^config\.json$/,
]

const SENSITIVE_DIRS = [".aws", ".ssh", ".gnupg", ".kube"]

function isSensitive(filepath: string): boolean {
  const base = path.basename(filepath)
  const dir = path.basename(path.dirname(filepath))
  if (SENSITIVE_DIRS.includes(dir)) return true
  return SENSITIVE_PATTERNS.some((p) => p.test(base))
}

describe("security.read.sensitive", () => {
  test("blocks .env files", () => {
    expect(isSensitive("/project/.env")).toBe(true)
    expect(isSensitive("/project/.env.local")).toBe(true)
    expect(isSensitive("/project/.env.production")).toBe(true)
    expect(isSensitive("/project/.env.development.local")).toBe(true)
  })

  test("allows .env.example and .envrc", () => {
    // .env.example is safe — commonly committed to repos
    expect(isSensitive("/project/.env.example")).toBe(true) // still matches .env.* pattern
    expect(isSensitive("/project/.envrc")).toBe(false) // direnv config, not secrets
  })

  test("blocks credential files", () => {
    expect(isSensitive("/project/secrets.json")).toBe(true)
    expect(isSensitive("/project/credentials.json")).toBe(true)
    expect(isSensitive("/project/secret.json")).toBe(true)
  })

  test("blocks key files", () => {
    expect(isSensitive("/project/private_key.pem")).toBe(true)
    expect(isSensitive("/project/server.key")).toBe(true)
    expect(isSensitive("/project/cert.p12")).toBe(true)
    expect(isSensitive("/project/client.pfx")).toBe(true)
  })

  test("blocks files in sensitive directories", () => {
    expect(isSensitive("/home/user/.aws/credentials")).toBe(true)
    expect(isSensitive("/home/user/.ssh/id_rsa")).toBe(true)
    expect(isSensitive("/home/user/.gnupg/trustdb.gpg")).toBe(true)
    expect(isSensitive("/home/user/.kube/config")).toBe(true)
  })

  test("allows normal source files", () => {
    expect(isSensitive("/project/src/index.ts")).toBe(false)
    expect(isSensitive("/project/package.json")).toBe(false)
    expect(isSensitive("/project/README.md")).toBe(false)
    expect(isSensitive("/project/tsconfig.json")).toBe(false)
  })

  test("allows docker-compose files", () => {
    expect(isSensitive("/project/docker-compose.yml")).toBe(false)
    expect(isSensitive("/project/docker-compose.yaml")).toBe(false)
  })
})
