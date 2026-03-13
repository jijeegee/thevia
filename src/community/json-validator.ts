// Client-side VIA JSON definition validator
// Validates that uploaded JSON files conform to the VIA definition format

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  parsed: {
    name: string | null;
    vendorId: number | null;
    productId: number | null;
    matrix: {rows: number; cols: number} | null;
    layouts: string[] | null;
  };
}

function addError(
  errors: ValidationError[],
  path: string,
  message: string,
): void {
  errors.push({path, message});
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isHexId(value: unknown): boolean {
  if (typeof value === 'string') {
    return /^0x[0-9a-fA-F]+$/.test(value);
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 0xffff;
  }
  return false;
}

function parseHexOrNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)) {
    return parseInt(value, 16);
  }
  return null;
}

/**
 * Validates a VIA V2 definition (the older format).
 */
function validateV2(
  def: Record<string, unknown>,
  errors: ValidationError[],
): void {
  // name
  if (!isNonEmptyString(def.name)) {
    addError(errors, 'name', 'Required: non-empty string');
  }

  // vendorId
  if (!isHexId(def.vendorId)) {
    addError(
      errors,
      'vendorId',
      'Required: hex string (e.g. "0x1234") or number',
    );
  }

  // productId
  if (!isHexId(def.productId)) {
    addError(
      errors,
      'productId',
      'Required: hex string (e.g. "0x5678") or number',
    );
  }

  // matrix
  if (!isObject(def.matrix)) {
    addError(errors, 'matrix', 'Required: object with rows and cols');
  } else {
    const matrix = def.matrix as Record<string, unknown>;
    if (!isPositiveInteger(matrix.rows)) {
      addError(errors, 'matrix.rows', 'Required: positive integer');
    }
    if (!isPositiveInteger(matrix.cols)) {
      addError(errors, 'matrix.cols', 'Required: positive integer');
    }
  }

  // layouts
  if (!isObject(def.layouts)) {
    addError(errors, 'layouts', 'Required: object');
  } else {
    const layouts = def.layouts as Record<string, unknown>;
    if (!isObject(layouts.keymap) && !Array.isArray(layouts.keymap)) {
      // VIA v2 keymap can be an array of arrays or a special format
      // Check for at least 'keymap' key presence
      addError(errors, 'layouts.keymap', 'Required: keymap data');
    }
  }
}

/**
 * Validates a VIA V3 definition (the newer format).
 */
function validateV3(
  def: Record<string, unknown>,
  errors: ValidationError[],
): void {
  // name
  if (!isNonEmptyString(def.name)) {
    addError(errors, 'name', 'Required: non-empty string');
  }

  // vendorId
  if (!isHexId(def.vendorId)) {
    addError(
      errors,
      'vendorId',
      'Required: hex string (e.g. "0x1234") or number',
    );
  }

  // productId
  if (!isHexId(def.productId)) {
    addError(
      errors,
      'productId',
      'Required: hex string (e.g. "0x5678") or number',
    );
  }

  // matrix
  if (!isObject(def.matrix)) {
    addError(errors, 'matrix', 'Required: object with rows and cols');
  } else {
    const matrix = def.matrix as Record<string, unknown>;
    if (!isPositiveInteger(matrix.rows)) {
      addError(errors, 'matrix.rows', 'Required: positive integer');
    }
    if (!isPositiveInteger(matrix.cols)) {
      addError(errors, 'matrix.cols', 'Required: positive integer');
    }
  }

  // layouts
  if (!isObject(def.layouts)) {
    addError(errors, 'layouts', 'Required: object');
  } else {
    const layouts = def.layouts as Record<string, unknown>;
    // V3 must have 'keymap' as an array
    if (!Array.isArray(layouts.keymap)) {
      addError(errors, 'layouts.keymap', 'Required: array of key definitions');
    } else if (layouts.keymap.length === 0) {
      addError(errors, 'layouts.keymap', 'Keymap must not be empty');
    }
  }

  // V3 specific: keycodes (optional but if present should be array)
  if (def.keycodes !== undefined && !Array.isArray(def.keycodes)) {
    addError(errors, 'keycodes', 'If present, must be an array');
  }

  // V3 specific: menus (optional but if present should be array)
  if (def.menus !== undefined && !Array.isArray(def.menus)) {
    addError(errors, 'menus', 'If present, must be an array');
  }
}

/**
 * Validate a parsed JSON object against VIA definition requirements.
 * Supports both V2 and V3 formats, auto-detecting the version.
 */
export function validateViaDefinition(json: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  const parsed: ValidationResult['parsed'] = {
    name: null,
    vendorId: null,
    productId: null,
    matrix: null,
    layouts: null,
  };

  // Must be an object
  if (!isObject(json)) {
    addError(errors, '$', 'Definition must be a JSON object');
    return {valid: false, errors, parsed};
  }

  const def = json as Record<string, unknown>;

  // Extract parsed metadata regardless of validation
  if (isNonEmptyString(def.name)) {
    parsed.name = def.name;
  }
  parsed.vendorId = parseHexOrNumber(def.vendorId);
  parsed.productId = parseHexOrNumber(def.productId);

  if (isObject(def.matrix)) {
    const matrix = def.matrix as Record<string, unknown>;
    if (isPositiveInteger(matrix.rows) && isPositiveInteger(matrix.cols)) {
      parsed.matrix = {rows: matrix.rows, cols: matrix.cols};
    }
  }

  if (isObject(def.layouts)) {
    const layouts = def.layouts as Record<string, unknown>;
    if (layouts.labels && Array.isArray(layouts.labels)) {
      parsed.layouts = layouts.labels.map((l: unknown) =>
        Array.isArray(l) ? String(l[0]) : String(l),
      );
    }
  }

  // Detect version: V3 definitions have specific markers
  // V3 uses array-style keymap layouts; V2 uses KLE-style string arrays
  const isV3 =
    isObject(def.layouts) &&
    Array.isArray((def.layouts as Record<string, unknown>).keymap) &&
    (def.layouts as Record<string, unknown>).keymap !== undefined &&
    Array.isArray(
      ((def.layouts as Record<string, unknown>).keymap as unknown[])[0],
    ) === false
      ? false
      : true;

  // In practice, the simplest heuristic:
  // If 'customKeycodes' or 'menus' exist, it's likely V3
  const hasV3Fields =
    def.customKeycodes !== undefined || def.menus !== undefined;

  if (hasV3Fields) {
    validateV3(def, errors);
  } else {
    // Try V2 validation first, fall back to V3 checks
    validateV2(def, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed,
  };
}

/**
 * Parse and validate a JSON string. Returns the validation result
 * plus the parsed JSON if parsing succeeded.
 */
export function validateViaJsonString(jsonString: string): ValidationResult & {
  parsedJson: unknown;
} {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonString);
  } catch (e) {
    const message =
      e instanceof SyntaxError ? e.message : 'Invalid JSON syntax';
    return {
      valid: false,
      errors: [{path: '$', message: `JSON parse error: ${message}`}],
      parsed: {
        name: null,
        vendorId: null,
        productId: null,
        matrix: null,
        layouts: null,
      },
      parsedJson: null,
    };
  }
  const result = validateViaDefinition(parsedJson);
  return {...result, parsedJson};
}
