import { z } from 'zod';

/** Entities a client may extend with their own fields without a code change. */
export const CUSTOM_FIELD_ENTITIES = ['student', 'batch'] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const CUSTOM_FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'boolean',
  'select',
  'multiselect',
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** Who may see a field: staff only, or the person the record belongs to as well. */
export const CUSTOM_FIELD_VISIBILITIES = ['staff', 'staff_and_owner'] as const;

export const customFieldOptionSchema = z.object({
  value: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
});

export const customFieldDefinitionSchema = z
  .object({
    entityType: z.enum(CUSTOM_FIELD_ENTITIES),
    key: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, digits and underscores'),
    label: z.string().trim().min(1).max(80),
    type: z.enum(CUSTOM_FIELD_TYPES),
    helpText: z.string().trim().max(200).default(''),
    options: z.array(customFieldOptionSchema).max(50).default([]),
    required: z.boolean().default(false),
    visibility: z.enum(CUSTOM_FIELD_VISIBILITIES).default('staff'),
    position: z.number().int().min(0).max(1000).default(0),
    archived: z.boolean().default(false),
  })
  .refine((v) => !['select', 'multiselect'].includes(v.type) || v.options.length > 0, {
    path: ['options'],
    message: 'Give at least one option for a choice field',
  });
export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;

export const customFieldCreateSchema = customFieldDefinitionSchema;
export const customFieldUpdateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  helpText: z.string().trim().max(200).optional(),
  options: z.array(customFieldOptionSchema).max(50).optional(),
  required: z.boolean().optional(),
  visibility: z.enum(CUSTOM_FIELD_VISIBILITIES).optional(),
  position: z.number().int().min(0).max(1000).optional(),
  archived: z.boolean().optional(),
});

export interface CustomFieldRecord extends CustomFieldDefinition {
  id: string;
}

/**
 * Builds a validator for the `custom` object of an entity from its active field definitions.
 * Unknown keys are rejected so a typo never becomes silent data.
 */
export function customValuesSchema(definitions: CustomFieldDefinition[]): z.ZodType {
  const shape: Record<string, z.ZodType> = {};
  for (const field of definitions) {
    if (field.archived) continue;
    let base: z.ZodType;
    switch (field.type) {
      case 'number':
        base = z.coerce.number();
        break;
      case 'boolean':
        // Coercion would read the string "false" as true (Phase 6).
        base = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
        break;
      case 'date':
        base = z.iso.date();
        break;
      case 'select':
        base = z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
        break;
      case 'multiselect':
        base = z.array(z.enum(field.options.map((o) => o.value) as [string, ...string[]])).max(50);
        break;
      case 'textarea':
        base = z.string().trim().max(2000);
        break;
      default:
        base = z.string().trim().max(200);
    }
    shape[field.key] = field.required ? base : base.nullish();
  }
  return z.object(shape).strict();
}
