/**
 * React Query hooks for dashboard
 */
import { useQuery } from '@tanstack/react-query';
import {
  getDashboardSummary,
  getKPIData,
  getPublicationsData,
  getResearchData,
  getStudentsData,
  getAvailableFilters,
  getReportData,
} from '@/api/endpoints/dashboard.api';
import type {
  DashboardSummaryResponse,
  KPIDataResponse,
  PublicationDataResponse,
  ResearchDataResponse,
  StudentDataResponse,
  FiltersResponse,
  ReportDataResponse,
  DashboardFilters,
  ReportFilters,
} from '@/types/dto/dashboard.dto';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: (filters?: DashboardFilters) => ['dashboard', 'summary', filters] as const,
  kpi: (filters?: DashboardFilters) => ['dashboard', 'kpi', filters] as const,
  publications: (filters?: DashboardFilters) => ['dashboard', 'publications', filters] as const,
  research: (filters?: DashboardFilters) => ['dashboard', 'research', filters] as const,
  students: (filters?: DashboardFilters) => ['dashboard', 'students', filters] as const,
  filters: () => ['dashboard', 'filters'] as const,
  report: (reportType: string, filters?: ReportFilters) =>
    ['dashboard', 'report', reportType, filters] as const,
};

/**
 * Hook for fetching dashboard summary
 */
export const useDashboardSummary = (filters?: DashboardFilters) => {
  return useQuery<DashboardSummaryResponse, Error>({
    queryKey: dashboardKeys.summary(filters),
    queryFn: () => getDashboardSummary(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for fetching KPI data
 */
export const useKPIData = (filters?: DashboardFilters) => {
  return useQuery<KPIDataResponse, Error>({
    queryKey: dashboardKeys.kpi(filters),
    queryFn: () => getKPIData(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for fetching publications data
 */
export const usePublicationsData = (filters?: DashboardFilters) => {
  return useQuery<PublicationDataResponse, Error>({
    queryKey: dashboardKeys.publications(filters),
    queryFn: () => getPublicationsData(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for fetching research data
 */
export const useResearchData = (filters?: DashboardFilters) => {
  return useQuery<ResearchDataResponse, Error>({
    queryKey: dashboardKeys.research(filters),
    queryFn: () => getResearchData(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for fetching students data
 */
export const useStudentsData = (filters?: DashboardFilters) => {
  return useQuery<StudentDataResponse, Error>({
    queryKey: dashboardKeys.students(filters),
    queryFn: () => getStudentsData(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for fetching available filters
 */
export const useAvailableFilters = () => {
  return useQuery<FiltersResponse, Error>({
    queryKey: dashboardKeys.filters(),
    queryFn: getAvailableFilters,
    staleTime: 1000 * 60 * 10, // 10 minutes (filters change less frequently)
  });
};

/**
 * Hook for fetching report data
 */
export const useReportData = (reportType: string, filters?: ReportFilters) => {
  return useQuery<ReportDataResponse, Error>({
    queryKey: dashboardKeys.report(reportType, filters),
    queryFn: () => getReportData(reportType, filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!reportType, // Only run query if reportType is provided
  });
};
