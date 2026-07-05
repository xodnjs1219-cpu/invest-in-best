/**
 * DTO types for dashboard API
 */

export interface DashboardFilters {
  year?: number;
  semester?: string;
  college?: string;
  department?: string;
}

export interface ReportFilters extends DashboardFilters {
  page?: number;
  limit?: number;
}

export interface DashboardSummary {
  total_students: number;
  total_publications: number;
  total_research_projects: number;
  total_research_budget: number; // 총 연구비 (원 단위)
}

export interface DashboardSummaryResponse {
  year: number | string; // 'all' 또는 연도
  semester: string;
  college: string;
  summary: DashboardSummary;
}

export interface KPIData {
  id: number;
  year: number;
  semester: string;
  college: string;
  department: string;
  [key: string]: any; // Metadata fields
}

export interface KPIDataResponse {
  count: number;
  data: KPIData[];
  filters: DashboardFilters;
}

export interface PublicationData {
  id: number;
  year: number;
  college: string;
  department: string;
  논문ID?: string;
  논문제목?: string;
  주저자?: string;
  참여저자?: string;
  학술지명?: string;
  저널등급?: string;
  Impact_Factor?: number | null;
  과제연계여부?: string;
  [key: string]: any;
}

export interface PublicationTrend {
  year: number;
  count: number;
}

export interface PublicationDataResponse {
  count: number;
  data: PublicationData[];
  trends: PublicationTrend[];
  filters: DashboardFilters;
}

export interface ResearchData {
  id: number;
  year: number;
  department: string;
  집행ID?: string;
  과제번호?: string;
  과제명?: string;
  연구책임자?: string;
  지원기관?: string;
  총연구비?: number;
  집행일자?: string;
  집행항목?: string;
  집행금액?: number;
  상태?: string;
  비고?: string;
  [key: string]: any;
}

export interface DepartmentResearchStats {
  department: string;
  project_count: number;
  total_budget: number;
}

export interface ResearchDataResponse {
  count: number;
  data: ResearchData[];
  by_department: DepartmentResearchStats[];
  filters: DashboardFilters;
}

export interface StudentData {
  id: number;
  year: number;
  college: string;
  department: string;
  학번?: string;
  이름?: string;
  학년?: number;
  과정구분?: string;
  학적상태?: string;
  성별?: string;
  지도교수?: string;
  이메일?: string;
  [key: string]: any;
}

export interface StudentStatistics {
  total_students: number;
  by_program: Record<string, number>;
  by_status: Record<string, number>;
}

export interface StudentDataResponse {
  count: number;
  data: StudentData[];
  statistics: StudentStatistics;
  filters: DashboardFilters;
}

export interface FiltersResponse {
  years: number[];
  colleges: string[];
  departments: string[];
  semesters: string[];
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ReportDataResponse {
  report_type: string;
  data: any[];
  pagination: PaginationInfo;
  filters: DashboardFilters;
}
