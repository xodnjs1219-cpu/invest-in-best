import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  useTheme,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  FilePresent as FilePresentIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useUploadData, useUploadLogs, useDeleteUpload } from '@/hooks/queries/useUpload';

export const DataManagementPage = () => {
  const theme = useTheme();
  const [isDragActive, setIsDragActive] = useState(false);
  const [page] = useState(1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  
  // React Query hooks
  const { mutate: uploadFile, isPending: isUploading } = useUploadData();
  const { data: logsData, isLoading: isLoadingLogs, error: logsError } = useUploadLogs(page, 20);
  const { mutate: deleteUpload, isPending: isDeleting } = useDeleteUpload();

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFiles = (files: FileList) => {
    const file = files[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))) {
      setUploadError(null);
      setUploadSuccess(null);
      
      uploadFile(
        { file, replaceExisting: true },
        {
          onSuccess: (data) => {
            console.log('Upload successful:', data);
            setUploadSuccess(`파일이 성공적으로 업로드되었습니다: ${data.message}`);
          },
          onError: (error: any) => {
            console.error('Upload failed:', error);
            const errorMessage = error.response?.data?.details 
              ? JSON.stringify(error.response.data.details)
              : error.response?.data?.error 
              || error.message 
              || '파일 업로드에 실패했습니다';
            setUploadError(errorMessage);
          },
        }
      );
    } else {
      setUploadError('CSV 또는 XLSX 파일만 업로드 가능합니다.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon sx={{ color: 'success.main' }} />;
      case 'failed':
        return <ErrorIcon sx={{ color: 'error.main' }} />;
      default:
        return <FilePresentIcon sx={{ color: 'info.main' }} />;
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedLogId === null) return;
    
    deleteUpload(selectedLogId, {
      onSuccess: (data) => {
        setUploadSuccess(`${data.deleted_records}개의 데이터가 성공적으로 삭제되었습니다.`);
        setDeleteDialogOpen(false);
        setSelectedLogId(null);
      },
      onError: (error: any) => {
        const errorMessage = error.response?.data?.error || error.message || '삭제에 실패했습니다';
        setUploadError(errorMessage);
        setDeleteDialogOpen(false);
        setSelectedLogId(null);
      },
    });
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'success':
        return '완료';
      case 'failed':
        return '실패';
      case 'pending':
        return '처리중';
      default:
        return '알 수 없음';
    }
  };

  const uploadedFiles = logsData?.logs || [];
  const totalRecords = uploadedFiles.reduce((sum, log) => sum + (log.processed_records || 0), 0);

  return (
    <Box>
      {/* Upload Success/Error Messages */}
      {uploadSuccess && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setUploadSuccess(null)}>
          {uploadSuccess}
        </Alert>
      )}
      {uploadError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setUploadError(null)}>
          {uploadError}
        </Alert>
      )}
      {logsError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          데이터를 불러오는 중 오류가 발생했습니다: {logsError.message}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 1,
          }}
        >
          데이터 관리
        </Typography>
        <Typography variant="body1" color="textSecondary">
          엑셀 파일을 업로드하여 데이터를 관리하세요
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
          gap: 2.5,
        }}
      >
        {/* Upload Card */}
        <Box>
          <Card
            sx={{
              borderRadius: 2,
              border: `2px dashed ${
                isDragActive ? theme.palette.primary.main : theme.palette.divider
              }`,
              bgcolor: isDragActive
                ? `${theme.palette.primary.main}08`
                : 'transparent',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              height: '100%',
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragEnter}
            onDrop={handleDrop}
          >
            <CardContent
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py: 6,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  bgcolor: `${theme.palette.primary.main}15`,
                  color: theme.palette.primary.main,
                  mb: 2,
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 36 }} />
              </Box>

              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  mb: 1,
                  color: theme.palette.text.primary,
                }}
              >
                파일을 여기에 끌어놓으세요
              </Typography>

              <Typography
                variant="body1"
                color="textSecondary"
                sx={{ mb: 2.5 }}
              >
                또는 아래 버튼을 클릭하여 파일을 선택하세요
              </Typography>

              <Button
                variant="contained"
                component="label"
                size="large"
                startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : undefined}
                disabled={isUploading}
                sx={{
                  px: 3,
                  py: 1.2,
                }}
              >
                {isUploading ? '업로드 중...' : '파일 선택'}
                <input
                  hidden
                  accept=".xlsx,.xls,.csv"
                  type="file"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleFiles(e.target.files);
                    }
                  }}
                />
              </Button>

              <Typography
                variant="caption"
                color="textSecondary"
                sx={{ mt: 2 }}
              >
                지원 형식: .xlsx, .xls, .csv (최대 50MB)
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Info Cards */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 1.5,
                        bgcolor: `${theme.palette.primary.main}15`,
                        color: theme.palette.primary.main,
                      }}
                    >
                      <FilePresentIcon />
                    </Box>
                    <Box>
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ fontSize: '0.85rem' }}
                      >
                        총 업로드 파일
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{ fontWeight: 700 }}
                      >
                        {isLoadingLogs ? '-' : uploadedFiles.length}개
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

            <Card
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 48,
                        height: 48,
                        borderRadius: 1.5,
                        bgcolor: `${theme.palette.success.main}15`,
                        color: theme.palette.success.main,
                      }}
                    >
                      <CheckCircleIcon />
                    </Box>
                    <Box>
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ fontSize: '0.85rem' }}
                      >
                        총 기록
                      </Typography>
                      <Typography
                        variant="h5"
                        sx={{ fontWeight: 700 }}
                      >
                        {isLoadingLogs ? '-' : totalRecords.toLocaleString()}개
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
        </Box>

        {/* Upload History */}
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Card
            sx={{
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  mb: 3,
                }}
              >
                업로드 이력
              </Typography>

              {isLoadingLogs ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : uploadedFiles.length === 0 ? (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 3 }}>
                  업로드된 파일이 없습니다
                </Typography>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: theme.palette.action.hover }}>
                        <TableCell sx={{ fontWeight: 700 }}>파일명</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          크기
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          기록
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          상태
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          날짜
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          작업
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {uploadedFiles.map((log) => (
                        <TableRow
                          key={log.id}
                          sx={{
                            '&:hover': {
                              bgcolor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                              <FilePresentIcon sx={{ color: 'primary.main' }} />
                              <Box>
                                <Typography variant="body2">{log.filename}</Typography>
                                {log.error_message && (
                                  <Typography variant="caption" color="error">
                                    {log.error_message}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            {log.file_size ? `${Math.round(log.file_size / 1024)}KB` : '-'}
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${log.processed_records || 0}개`}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
                              {getStatusIcon(log.status)}
                              <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                {getStatusLabel(log.status)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="caption" color="textSecondary">
                              {new Date(log.uploaded_at).toLocaleDateString('ko-KR')}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedLogId(log.id);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={isDeleting}
                              title="삭제"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>데이터 삭제 확인</DialogTitle>
        <DialogContent>
          <DialogContentText>
            이 업로드 데이터를 삭제하시겠습니까?
            <br />
            <strong>삭제된 데이터는 복구할 수 없습니다.</strong>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            취소
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
