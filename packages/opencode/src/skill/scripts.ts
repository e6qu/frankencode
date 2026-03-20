import z from "zod"
import { Skill } from "../skill"
import { Tool } from "@/tool/tool"
import { Process } from "@/util/process"
import path from "path"
import { Glob } from "../util/glob"

const ScriptInfo = z.object({
  name: z.string(),
  skill: z.string(),
  path: z.string(),
  description: z.string().optional(),
})

export type ScriptInfo = z.infer<typeof ScriptInfo>

export namespace Scripts {
  const SCRIPT_PATTERNS = ["scripts/*.{sh,ts,js,py}"]

  export async function discover(skillName: string): Promise<ScriptInfo[]> {
    const skill = await Skill.meta(skillName)
    if (!skill) return []

    const skillDir = path.dirname(skill.location)
    const scripts: ScriptInfo[] = []

    for (const pattern of SCRIPT_PATTERNS) {
      const matches = await Glob.scan(pattern, {
        cwd: skillDir,
        absolute: true,
        include: "file",
      })

      for (const match of matches) {
        const name = path.basename(match, path.extname(match))
        scripts.push({
          name,
          skill: skillName,
          path: match,
          description: `Script from ${skillName} skill`,
        })
      }
    }

    return scripts
  }

  export async function discoverAll(): Promise<ScriptInfo[]> {
    const skills = await Skill.all()
    const results = await Promise.all(skills.map((s) => discover(s.name)))
    return results.flat()
  }

  export async function asTools(): Promise<Tool.Info[]> {
    const scripts = await discoverAll()
    return scripts.map((script) => createScriptTool(script))
  }

  function createScriptTool(script: ScriptInfo): Tool.Info {
    return {
      id: `script::${script.skill}/${script.name}`,
      init: async () => ({
        description: script.description ?? `Run ${script.name} script from ${script.skill} skill`,
        parameters: z.object({
          args: z.array(z.string()).optional().describe("Arguments to pass to the script"),
        }),
        async execute(params: { args?: string[] }, ctx) {
          const ext = path.extname(script.path)

          const userArgs = params.args?.length ? ["--", ...params.args] : []
          let cmd: string[]
          switch (ext) {
            case ".ts":
              cmd = ["bun", "run", script.path, ...userArgs]
              break
            case ".js":
              cmd = ["node", script.path, ...userArgs]
              break
            case ".py":
              cmd = ["python3", script.path, ...userArgs]
              break
            case ".sh":
              cmd = ["bash", script.path, ...userArgs]
              break
            default:
              cmd = [script.path, ...userArgs]
          }

          const result = await Process.text(cmd, {
            cwd: ctx.directory,
            timeout: 60000,
            nothrow: true,
          })

          return {
            title: `${script.skill}/${script.name}`,
            output: result.text,
            metadata: {
              exitCode: result.code,
              script: script.path,
            },
          }
        },
      }),
    }
  }
}
