/**
 * API endpoints for data upload
 */
import apiClient from '../client';
import { API_ENDPOINTS } from '@/config/constants';
import type {
  UploadFileResponse,
  UploadLogsResponse,
  DataStatistics,
} from '@/types/dto/upload.dto';

/**
 * Upload data file (CSV/XLSX)
 * POST /api/data-upload/upload/
 */
export const uploadDataFile = async (
  file: File,
  replaceExisting: boolean = true
): Promise<UploadFileResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('replace_existing', replaceExisting ? 'true' : 'false');

  const { data } = await apiClient.post<UploadFileResponse>(
    API_ENDPOINTS.DATA_UPLOAD.UPLOAD,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return data;
};

/**
 * Get upload logs
 * GET /api/data-upload/logs/
 */
export const getUploadLogs = async (
  page: number = 1,
  limit: number = 20
): Promise<UploadLogsResponse> => {
  const { data } = await apiClient.get<UploadLogsResponse>(API_ENDPOINTS.DATA_UPLOAD.LOGS, {
    params: { page, limit },
  });

  return data;
};

/**
 * Get data statistics
 * GET /api/data-upload/statistics/
 */
export const getDataStatistics = async (): Promise<DataStatistics> => {
  const { data } = await apiClient.get<DataStatistics>(API_ENDPOINTS.DATA_UPLOAD.STATISTICS);
  return data;
};

/**
 * Delete uploaded data
 * DELETE /api/data-upload/delete/<log_id>/
 */
export const deleteUploadData = async (logId: number): Promise<{ message: string; deleted_records: number }> => {
  const { data } = await apiClient.delete(`${API_ENDPOINTS.DATA_UPLOAD.DELETE}${logId}/`);
  return data;
};
