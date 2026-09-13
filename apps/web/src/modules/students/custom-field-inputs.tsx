'use client';

import type { CustomFieldRecord } from '@lms/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/** Empty values for a set of definitions, so a form starts in a controlled state. */
export function customFieldDefaults(fields: CustomFieldRecord[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.archived) continue;
    out[field.key] = field.type === 'boolean' ? false : field.type === 'multiselect' ? [] : '';
  }
  return out;
}

/**
 * Renders the fields a client defined for an entity. The API validates the same definitions,
 * so anything accepted here is accepted there.
 */
export function CustomFieldInputs({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldRecord[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const active = fields.filter((f) => !f.archived);
  if (active.length === 0) return null;
  return (
    <div className="space-y-4 rounded-md border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Institute fields
      </p>
      {active.map((field) => {
        const id = `custom-${field.key}`;
        const value = values[field.key];
        return (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={id}>
              {field.label}
              {field.required ? <span className="ml-1 text-danger">*</span> : null}
            </Label>
            {field.type === 'textarea' ? (
              <Textarea
                id={id}
                rows={3}
                value={String(value ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            ) : field.type === 'boolean' ? (
              <Checkbox
                id={id}
                checked={value === true}
                onCheckedChange={(checked) => onChange(field.key, checked === true)}
              />
            ) : field.type === 'select' ? (
              <Select value={String(value ?? '')} onValueChange={(v) => onChange(field.key, v)}>
                <SelectTrigger id={id}>
                  <SelectValue placeholder="Choose one" />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'multiselect' ? (
              <div className="flex flex-wrap gap-3">
                {field.options.map((option) => {
                  const selected = Array.isArray(value) ? (value as string[]) : [];
                  return (
                    <label key={option.value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.includes(option.value)}
                        onCheckedChange={(checked) =>
                          onChange(
                            field.key,
                            checked === true
                              ? [...selected, option.value]
                              : selected.filter((v) => v !== option.value),
                          )
                        }
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            ) : (
              <Input
                id={id}
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                value={String(value ?? '')}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            )}
            {field.helpText ? (
              <p className="text-xs text-muted-foreground">{field.helpText}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
