/**
 * API endpoints for dashboard
 */
import apiClient from '../client';
import { API_ENDPOINTS } from '@/config/constants';
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

/**
 * Get dashboard summary
 * GET /api/dashboard/summary/
 */
export const getDashboardSummary = async (
  filters?: DashboardFilters
): Promise<DashboardSummaryResponse> => {
  const { data } = await apiClient.get<DashboardSummaryResponse>(API_ENDPOINTS.DASHBOARD.SUMMARY, {
    params: filters,
  });

  return data;
};

/**
 * Get KPI data
 * GET /api/dashboard/kpi/
 */
export const getKPIData = async (
  filters?: DashboardFilters
): Promise<KPIDataResponse> => {
  const { data } = await apiClient.get<KPIDataResponse>(API_ENDPOINTS.DASHBOARD.KPI, {
    params: filters,
  });

  return data;
};

/**
 * Get publications data
 * GET /api/dashboard/publications/
 */
export const getPublicationsData = async (
  filters?: DashboardFilters
): Promise<PublicationDataResponse> => {
  const { data } = await apiClient.get<PublicationDataResponse>(API_ENDPOINTS.DASHBOARD.PUBLICATIONS, {
    params: filters,
  });

  return data;
};

/**
 * Get research data
 * GET /api/dashboard/research/
 */
export const getResearchData = async (
  filters?: DashboardFilters
): Promise<ResearchDataResponse> => {
  const { data } = await apiClient.get<ResearchDataResponse>(API_ENDPOINTS.DASHBOARD.RESEARCH, {
    params: filters,
  });

  return data;
};

/**
 * Get students data
 * GET /api/dashboard/students/
 */
export const getStudentsData = async (
  filters?: DashboardFilters
): Promise<StudentDataResponse> => {
  const { data } = await apiClient.get<StudentDataResponse>(API_ENDPOINTS.DASHBOARD.STUDENTS, {
    params: filters,
  });

  return data;
};

/**
 * Get available filters
 * GET /api/dashboard/filters/
 */
export const getAvailableFilters = async (): Promise<FiltersResponse> => {
  const { data } = await apiClient.get<FiltersResponse>(API_ENDPOINTS.DASHBOARD.FILTERS);
  return data;
};

/**
 * Get detailed report data
 * GET /api/dashboard/reports/{report_type}/
 */
export const getReportData = async (
  reportType: string,
  filters?: ReportFilters
): Promise<ReportDataResponse> => {
  const { data } = await apiClient.get<ReportDataResponse>(
    `${API_ENDPOINTS.DASHBOARD.REPORTS}${reportType}/`,
    {
      params: filters,
    }
  );

  return data;
};
