import React from 'react';
import { useParams } from 'react-router-dom';
import { ReportRunner } from '@/components/reports/ReportRunner';

export const ReportView: React.FC = () => {
  const { reportName } = useParams<{ reportName: string }>();

  if (!reportName) {
    return <div className="p-8 text-destructive">Report name not specified</div>;
  }

  return <ReportRunner reportName={reportName} />;
};

export default ReportView;
