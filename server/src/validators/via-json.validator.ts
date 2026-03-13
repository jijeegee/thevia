import { z } from 'zod';

/**
 * VIA JSON definition schema validator.
 *
 * VIA JSON files define keyboard hardware layouts and keymaps.
 * This validates the essential structure that VIA expects to find.
 *
 * Reference: https://www.caniusevia.com/docs/specification
 */

// Matrix definition (rows x cols)
const matrixSchema = z.object({
  rows: z.number().int().min(1).max(20),
  cols: z.number().int().min(1).max(30),
});

// Key layout position
const keyPositionSchema = z.union([
  z.string(), // label or spacer
  z.object({}).passthrough(), // key config object with any properties
]);

// Layout option
const layoutOptionSchema = z.object({
  label: z.string().optional(),
  options: z.array(z.array(z.array(keyPositionSchema))).optional(),
}).passthrough();

// V2 layout format
const layoutV2Schema = z.object({
  keymap: z.array(z.array(keyPositionSchema)),
  labels: z.array(z.string()).optional(),
}).passthrough();

// V3 layout format uses "layouts" with "keymap" + optional "labels"
const layoutsV3Schema = z.object({
  keymap: z.array(z.array(z.array(keyPositionSchema))).optional(),
  labels: z.array(z.array(z.string())).optional(),
  width: z.number().optional(),
  height: z.number().optional(),
}).passthrough();

/**
 * Core VIA JSON schema.
 * Supports both V2 and V3 protocol formats.
 */
const viaJsonSchema = z.object({
  // Required fields
  name: z.string().min(1).max(255),
  vendorId: z.union([
    z.string().regex(/^0x[0-9a-fA-F]{4}$/), // hex string "0x1234"
    z.number().int().min(0).max(0xFFFF),      // numeric
  ]),
  productId: z.union([
    z.string().regex(/^0x[0-9a-fA-F]{4}$/),
    z.number().int().min(0).max(0xFFFF),
  ]),

  // Matrix is required
  matrix: matrixSchema.optional(),

  // Layouts (V3 uses 'layouts', V2 uses top-level keymap)
  layouts: z.record(z.string(), z.any()).optional(),
  keymap: z.array(z.any()).optional(),

  // Optional metadata
  lighting: z.union([z.string(), z.object({}).passthrough()]).optional(),
  customKeycodes: z.array(z.any()).optional(),
  customMenus: z.array(z.any()).optional(),
  menus: z.array(z.any()).optional(),
}).passthrough();

/**
 * Parse a hex string like "0x1234" to an integer.
 */
function parseVendorProductId(value: string | number): number {
  if (typeof value === 'number') return value;
  return parseInt(value, 16);
}

export interface ViaJsonValidationResult {
  valid: boolean;
  errors: string[];
  parsed?: z.infer<typeof viaJsonSchema>;
}

/**
 * Validates a VIA JSON definition object.
 *
 * @param json - The parsed JSON object to validate
 * @param expectedVendorId - The vendorId from the upload metadata (must match)
 * @param expectedProductId - The productId from the upload metadata (must match)
 * @returns Validation result with errors if invalid
 */
export function validateViaJson(
  json: unknown,
  expectedVendorId: number,
  expectedProductId: number,
): ViaJsonValidationResult {
  const errors: string[] = [];

  // Step 1: Parse against schema
  const result = viaJsonSchema.safeParse(json);
  if (!result.success) {
    return {
      valid: false,
      errors: result.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      ),
    };
  }

  const parsed = result.data;

  // Step 2: Check that the JSON has some form of layout data
  if (!parsed.matrix && !parsed.layouts && !parsed.keymap) {
    errors.push('JSON must contain at least one of: matrix, layouts, or keymap');
  }

  // Step 3: Validate vendorId matches
  const jsonVendorId = parseVendorProductId(parsed.vendorId);
  if (jsonVendorId !== expectedVendorId) {
    errors.push(
      `vendorId mismatch: JSON has ${jsonVendorId} (${parsed.vendorId}), expected ${expectedVendorId}`
    );
  }

  // Step 4: Validate productId matches
  const jsonProductId = parseVendorProductId(parsed.productId);
  if (jsonProductId !== expectedProductId) {
    errors.push(
      `productId mismatch: JSON has ${jsonProductId} (${parsed.productId}), expected ${expectedProductId}`
    );
  }

  // Step 5: Validate name is not empty
  if (!parsed.name || parsed.name.trim().length === 0) {
    errors.push('name must not be empty');
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: errors.length === 0 ? parsed : undefined,
  };
}

/**
 * Extract basic info from a VIA JSON without full validation.
 * Useful for quick inspection.
 */
export function extractViaJsonInfo(json: Record<string, unknown>): {
  name?: string;
  vendorId?: number;
  productId?: number;
  hasMatrix: boolean;
  hasLayouts: boolean;
  hasKeymap: boolean;
} {
  return {
    name: typeof json.name === 'string' ? json.name : undefined,
    vendorId: json.vendorId != null ? parseVendorProductId(json.vendorId as string | number) : undefined,
    productId: json.productId != null ? parseVendorProductId(json.productId as string | number) : undefined,
    hasMatrix: json.matrix != null,
    hasLayouts: json.layouts != null,
    hasKeymap: json.keymap != null,
  };
}
