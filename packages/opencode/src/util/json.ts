import z from "zod"

/**
 * Recursive JSON-serializable value per JSON spec.
 * Primitives, objects, arrays. No undefined (not valid JSON).
 *
 * Defined in its own module to avoid circular imports when used in
 * Zod schemas across the codebase (module-level schema construction
 * runs at import time, so circular deps cause undefined references).
 */
export type JsonValueType = string | number | boolean | null | { [key: string]: JsonValueType } | JsonValueType[]

export const JsonValue: z.ZodType<JsonValueType> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.record(z.string(), JsonValue), z.array(JsonValue)]),
)
