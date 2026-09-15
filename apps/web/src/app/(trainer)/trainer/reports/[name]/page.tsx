import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { REPORT_NAMES, type ReportName } from '@lms/shared';
import { ReportPage } from '@/modules/reports/report-page';

export const metadata: Metadata = { title: 'Report' };

export default async function TrainerReportPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(REPORT_NAMES as readonly string[]).includes(name)) notFound();
  return <ReportPage name={name as ReportName} exportsHref="/trainer/exports" canExport />;
}
