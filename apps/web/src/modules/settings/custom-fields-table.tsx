'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  type CustomFieldEntity,
  type CustomFieldRecord,
  type CustomFieldType,
} from '@lms/shared';
import { EmptyState, ErrorState, LoadingRows } from '@/components/page-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';

const ENTITY_LABELS: Record<CustomFieldEntity, string> = { student: 'Students', batch: 'Batches' };

export function CustomFieldsEditor() {
  const [entityType, setEntityType] = useState<CustomFieldEntity>('student');
  return (
    <Tabs value={entityType} onValueChange={(v) => setEntityType(v as CustomFieldEntity)}>
      <TabsList>
        {CUSTOM_FIELD_ENTITIES.map((entity) => (
          <TabsTrigger key={entity} value={entity}>
            {ENTITY_LABELS[entity]}
          </TabsTrigger>
        ))}
      </TabsList>
      {CUSTOM_FIELD_ENTITIES.map((entity) => (
        <TabsContent key={entity} value={entity}>
          <FieldList entityType={entity} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function FieldList({ entityType }: { entityType: CustomFieldEntity }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['custom-fields', entityType],
    queryFn: () => api<CustomFieldRecord[]>(`/custom-fields?entityType=${entityType}`),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['custom-fields'] });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CustomFieldRecord> }) =>
      api(`/custom-fields/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => {
      refresh();
      toast.success('Field updated');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not update the field'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/custom-fields/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      toast.success('Field deleted');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'Could not delete the field'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>New field</Button>
      </div>
      {query.isPending ? (
        <LoadingRows rows={3} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <EmptyState
          title={`No extra ${entityType} fields`}
          description="Add a field to capture something this institute needs that the standard record does not hold."
          action={<Button onClick={() => setOpen(true)}>New field</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>In use</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.map((field) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <p className="font-medium">{field.label}</p>
                    <p className="font-mono text-xs text-muted-foreground">{field.key}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{field.type}</Badge>
                    {field.options.length > 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {field.options.map((o) => o.label).join(', ')}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={field.required}
                      onCheckedChange={(v) =>
                        update.mutate({ id: field.id, patch: { required: v } })
                      }
                      aria-label={`Require ${field.label}`}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">{field.position}</TableCell>
                  <TableCell>
                    <Switch
                      checked={!field.archived}
                      onCheckedChange={(v) =>
                        update.mutate({ id: field.id, patch: { archived: !v } })
                      }
                      aria-label={`Use ${field.label} on forms`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(field.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <NewFieldDialog entityType={entityType} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function NewFieldDialog({
  entityType,
  open,
  onOpenChange,
}: {
  entityType: CustomFieldEntity;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [helpText, setHelpText] = useState('');
  const [options, setOptions] = useState('');
  const [required, setRequired] = useState(false);

  const needsOptions = type === 'select' || type === 'multiselect';
  const create = useMutation({
    mutationFn: () =>
      api<CustomFieldRecord>('/custom-fields', {
        body: {
          entityType,
          key:
            key ||
            label
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_|_$/g, ''),
          label,
          type,
          helpText,
          required,
          options: needsOptions
            ? options
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
                .map((o) => ({ value: o.toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: o }))
            : [],
          position: 0,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field added');
      onOpenChange(false);
      setLabel('');
      setKey('');
      setOptions('');
      setHelpText('');
      setRequired(false);
    },
    onError: (error) => {
      if (isApiError(error) && error.problem?.errors?.length) {
        toast.error(error.problem.errors.map((e) => e.message).join(' '));
      } else {
        toast.error(isApiError(error) ? error.message : 'Could not add the field');
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New {entityType} field</DialogTitle>
          <DialogDescription>
            The field appears on the {entityType} form and is validated on save. The key cannot be
            changed later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-label">Label</Label>
            <Input id="field-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field-key">Key (optional)</Label>
            <Input
              id="field-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'intake_source'
              }
            />
            <p className="text-xs text-muted-foreground">
              Lowercase letters, digits and underscores. Derived from the label when left empty.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CustomFieldType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOptions ? (
            <div className="space-y-2">
              <Label htmlFor="field-options">Options (comma separated)</Label>
              <Input
                id="field-options"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                placeholder="Walk-in, Referral, Online"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="field-help">Help text</Label>
            <Input id="field-help" value={helpText} onChange={(e) => setHelpText(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={required} onCheckedChange={(v) => setRequired(v === true)} />
            Required on every new record
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={
              label.trim().length === 0 ||
              (needsOptions && options.trim().length === 0) ||
              create.isPending
            }
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Adding…' : 'Add field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
