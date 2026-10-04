'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@repo/ui/components/ui/field';
import { Input } from '@repo/ui/components/ui/input';
import { useImportCsv } from '@/hooks/use-employees';

/**
 * CSV bulk import dialog. Columns `name,email` with a header row;
 * the server validates every row, inserts the valid ones in one
 * transaction, and returns row-level errors without rejecting
 * the whole file.
 */
export function CsvImportDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}): React.JSX.Element {
  const { importCsv, isPending, result, reset } = useImportCsv(companyId);
  const [fileError, setFileError] = useState<string | undefined>(undefined);

  function handleFile(file: File | undefined): void {
    setFileError(undefined);
    if (file === undefined) {
      return;
    }
    void file.text().then(
      (text) => importCsv(text),
      () => setFileError('Could not read the file'),
    );
  }

  return (
    <Dialog
      open
      onOpenChange={() => {
        reset();
        onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import employees from CSV</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="csv-file">CSV file (name,email header)</FieldLabel>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {fileError !== undefined && <p className="text-destructive">{fileError}</p>}
          </Field>
          {result !== undefined && (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm">Imported {result.imported} employees.</p>
              {result.errors.map((entry) => (
                <p key={entry.row} className="text-caption text-destructive">
                  Row {entry.row}: {entry.message}
                </p>
              ))}
            </div>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {isPending ? 'Importing…' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
