/**
 * DTO types for data upload API
 */

export interface UploadFileRequest {
  file: File;
  replace_existing?: boolean;
}

export interface UploadFileResponse {
  upload_log_id: number;
  status: string;
  data_type: string;
  total_records: number;
  processed_records: number;
  message: string;
}

export interface UploadLog {
  id: number;
  filename: string;
  file_size: number | null;
  status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  total_records: number | null;
  processed_records: number | null;
  uploaded_at: string;
  updated_at: string;
}

export interface UploadLogsResponse {
  logs: UploadLog[];
  total: number;
  page: number;
  limit: number;
}

export interface DataTypeStatistics {
  count: number;
  type: string;
}

export interface DataStatistics {
  kpi: DataTypeStatistics;
  publication: DataTypeStatistics;
  research: DataTypeStatistics;
  student: DataTypeStatistics;
}
