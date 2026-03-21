import z from "zod"

/**
 * JSON-serializable value type and Zod schema.
 *
 * Defined in its own module to avoid circular imports when used in
 * module-level Zod schemas across the codebase (Bun's module evaluation
 * order causes circular deps at schema construction time).
 *
 * The Zod schema uses z.any() with a named ref to avoid generating
 * anonymous $ref pointers that break OpenAPI SDK generation.
 * The TypeScript type provides the actual constraint.
 */
export type JsonValueType = string | number | boolean | null | { [key: string]: JsonValueType } | JsonValueType[]

// Zod schema uses z.any() at runtime (accepts all JSON) but the TypeScript type
// constrains it. This avoids both z.lazy() anonymous $ref issues and the
// non-recursive 3-level approximation that diverges from JsonValueType.
// biome-ignore lint: z.any() needed here — z.lazy() breaks OpenAPI, non-recursive approximation breaks tsgo
export const JsonValue: z.ZodType<JsonValueType> = z.any().meta({ ref: "JsonValue" })
