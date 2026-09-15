import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { REPORT_NAMES, type ReportName } from '@lms/shared';
import { ReportPage } from '@/modules/reports/report-page';

export const metadata: Metadata = { title: 'Report' };

export default async function AdminReportPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(REPORT_NAMES as readonly string[]).includes(name)) notFound();
  return <ReportPage name={name as ReportName} exportsHref="/admin/exports" canExport />;
}
