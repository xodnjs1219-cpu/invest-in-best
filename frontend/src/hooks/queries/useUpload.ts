/**
 * React Query hooks for data upload
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  uploadDataFile,
  getUploadLogs,
  getDataStatistics,
  deleteUploadData,
} from '@/api/endpoints/upload.api';
import type { UploadFileResponse, UploadLogsResponse, DataStatistics } from '@/types/dto/upload.dto';

// Query keys
export const uploadKeys = {
  all: ['upload'] as const,
  logs: (page?: number, limit?: number) => ['upload', 'logs', { page, limit }] as const,
  statistics: () => ['upload', 'statistics'] as const,
};

/**
 * Hook for uploading data files
 */
export const useUploadData = () => {
  const queryClient = useQueryClient();

  return useMutation<UploadFileResponse, Error, { file: File; replaceExisting?: boolean }>({
    mutationFn: ({ file, replaceExisting = true }) => uploadDataFile(file, replaceExisting),
    onSuccess: () => {
      // Invalidate upload logs and statistics
      queryClient.invalidateQueries({ queryKey: uploadKeys.all });
      // Also invalidate dashboard data as it depends on uploaded data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

/**
 * Hook for fetching upload logs
 */
export const useUploadLogs = (page: number = 1, limit: number = 20) => {
  return useQuery<UploadLogsResponse, Error>({
    queryKey: uploadKeys.logs(page, limit),
    queryFn: () => getUploadLogs(page, limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for fetching data statistics
 */
export const useDataStatistics = () => {
  return useQuery<DataStatistics, Error>({
    queryKey: uploadKeys.statistics(),
    queryFn: getDataStatistics,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for deleting uploaded data
 */
export const useDeleteUpload = () => {
  const queryClient = useQueryClient();

  return useMutation<{ message: string; deleted_records: number }, Error, number>({
    mutationFn: (logId: number) => deleteUploadData(logId),
    onSuccess: () => {
      // Invalidate upload logs and statistics
      queryClient.invalidateQueries({ queryKey: uploadKeys.all });
      // Also invalidate dashboard data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};
