# 데이터 업로드 페이지 - 상태 관리 설계 (Level 2)

## 개요

**복잡도**: High (12점)
**레벨**: Level 2 (Flux 패턴, Context 없음)
**관련 유스케이스**: UC-004

---

## 1. 상태 데이터 식별

### 1.1 관리할 상태 (State)

| 상태명 | 타입 | 설명 |
|--------|------|------|
| `uploadStatus` | `'idle' \| 'uploading' \| 'success' \| 'error'` | 업로드 진행 상태 |
| `selectedFile` | `File \| null` | 선택된 파일 |
| `uploadProgress` | `number` | 업로드 진행률 (0-100) |
| `errorMessage` | `string \| null` | 에러 메시지 (업로드 실패 시) |
| `uploadResult` | `UploadResult \| null` | 업로드 성공 결과 |

```typescript
interface UploadResult {
  id: number;
  filename: string;
  status: 'success';
  total_records: number;
  processed_records: number;
  uploaded_at: string;
  data_types: string[];
}
```

### 1.2 파생/표시 전용 데이터 (Derived Data)

**TanStack Query로 관리** (상태 관리 불필요):
- `uploadHistory`: 업로드 이력 목록 (서버에서 페칭)
- `isLoadingHistory`: 이력 로딩 상태
- `historyError`: 이력 조회 에러

---

## 2. 상태 전환 테이블

| 현재 상태 | 이벤트 (Action) | 다음 상태 | UI 업데이트 |
|----------|----------------|-----------|------------|
| idle | SELECT_FILE | selectedFile 설정 | 파일명 표시, 업로드 버튼 활성화 |
| idle | START_UPLOAD | uploadStatus='uploading' | 로딩 인디케이터, 업로드 버튼 비활성화 |
| uploading | UPDATE_PROGRESS | uploadProgress 업데이트 | 프로그레스 바 업데이트 |
| uploading | UPLOAD_SUCCESS | uploadStatus='success', uploadResult 설정 | 성공 메시지, 이력 목록 새로 고침 |
| uploading | UPLOAD_ERROR | uploadStatus='error', errorMessage 설정 | 에러 메시지, 재시도 버튼 |
| success/error | RESET_UPLOAD | 모든 상태 초기화 | 폼 리셋, 새 업로드 가능 |

---

## 3. Flux 패턴 설계

### 3.1 Actions (사용자 트리거 이벤트)

```typescript
// Action Types
type UploadAction =
  | { type: 'SELECT_FILE'; payload: File | null }
  | { type: 'START_UPLOAD' }
  | { type: 'UPDATE_PROGRESS'; payload: number }
  | { type: 'UPLOAD_SUCCESS'; payload: UploadResult }
  | { type: 'UPLOAD_ERROR'; payload: string }
  | { type: 'RESET_UPLOAD' };
```

### 3.2 Store (useReducer로 상태 관리)

```typescript
// State Interface
interface UploadState {
  uploadStatus: 'idle' | 'uploading' | 'success' | 'error';
  selectedFile: File | null;
  uploadProgress: number;
  errorMessage: string | null;
  uploadResult: UploadResult | null;
}

// Initial State
const initialState: UploadState = {
  uploadStatus: 'idle',
  selectedFile: null,
  uploadProgress: 0,
  errorMessage: null,
  uploadResult: null,
};

// Reducer
function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case 'SELECT_FILE':
      return {
        ...state,
        selectedFile: action.payload,
        uploadStatus: 'idle',
        errorMessage: null,
      };

    case 'START_UPLOAD':
      return {
        ...state,
        uploadStatus: 'uploading',
        uploadProgress: 0,
        errorMessage: null,
        uploadResult: null,
      };

    case 'UPDATE_PROGRESS':
      return {
        ...state,
        uploadProgress: action.payload,
      };

    case 'UPLOAD_SUCCESS':
      return {
        ...state,
        uploadStatus: 'success',
        uploadProgress: 100,
        uploadResult: action.payload,
        errorMessage: null,
      };

    case 'UPLOAD_ERROR':
      return {
        ...state,
        uploadStatus: 'error',
        errorMessage: action.payload,
        uploadProgress: 0,
      };

    case 'RESET_UPLOAD':
      return initialState;

    default:
      return state;
  }
}
```

### 3.3 View (컴포넌트에서 사용)

```typescript
// DataUploadPage.tsx
function DataUploadPage() {
  const [state, dispatch] = useReducer(uploadReducer, initialState);
  const queryClient = useQueryClient();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    dispatch({ type: 'SELECT_FILE', payload: file });
  };

  const handleUpload = async () => {
    if (!state.selectedFile) return;

    dispatch({ type: 'START_UPLOAD' });

    const formData = new FormData();
    formData.append('file', state.selectedFile);

    try {
      const xhr = new XMLHttpRequest();

      // 진행률 추적
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          dispatch({ type: 'UPDATE_PROGRESS', payload: progress });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          const result = JSON.parse(xhr.responseText);
          dispatch({ type: 'UPLOAD_SUCCESS', payload: result });

          // 업로드 이력 목록 새로 고침
          queryClient.invalidateQueries({ queryKey: ['upload-history'] });
        } else {
          const error = JSON.parse(xhr.responseText);
          dispatch({ type: 'UPLOAD_ERROR', payload: error.message || '업로드 실패' });
        }
      });

      xhr.addEventListener('error', () => {
        dispatch({ type: 'UPLOAD_ERROR', payload: '네트워크 오류가 발생했습니다' });
      });

      xhr.open('POST', '/api/data-upload/');
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('access_token')}`);
      xhr.send(formData);
    } catch (error) {
      dispatch({ type: 'UPLOAD_ERROR', payload: '업로드 중 오류가 발생했습니다' });
    }
  };

  const handleReset = () => {
    dispatch({ type: 'RESET_UPLOAD' });
  };

  return (
    <Box>
      <FileUploader
        state={state}
        onFileSelect={handleFileSelect}
        onUpload={handleUpload}
        onReset={handleReset}
      />
      <UploadStatus state={state} />
      <UploadHistory />
    </Box>
  );
}
```

---

## 4. 컴포넌트 설계

### 4.1 FileUploader 컴포넌트

```typescript
interface FileUploaderProps {
  state: UploadState;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
  onReset: () => void;
}

function FileUploader({ state, onFileSelect, onUpload, onReset }: FileUploaderProps) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">엑셀 파일 업로드</Typography>

        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onFileSelect}
          disabled={state.uploadStatus === 'uploading'}
        />

        {state.selectedFile && (
          <Typography variant="body2">선택된 파일: {state.selectedFile.name}</Typography>
        )}

        <Button
          variant="contained"
          onClick={onUpload}
          disabled={!state.selectedFile || state.uploadStatus === 'uploading'}
        >
          {state.uploadStatus === 'uploading' ? '업로드 중...' : '업로드'}
        </Button>

        {state.uploadStatus !== 'idle' && (
          <Button variant="outlined" onClick={onReset}>
            초기화
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.2 UploadStatus 컴포넌트

```typescript
function UploadStatus({ state }: { state: UploadState }) {
  if (state.uploadStatus === 'idle') return null;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        {state.uploadStatus === 'uploading' && (
          <>
            <Typography variant="h6">업로드 중...</Typography>
            <LinearProgress variant="determinate" value={state.uploadProgress} />
            <Typography variant="body2">{state.uploadProgress}%</Typography>
          </>
        )}

        {state.uploadStatus === 'success' && state.uploadResult && (
          <Alert severity="success">
            <Typography variant="h6">업로드 완료</Typography>
            <Typography variant="body2">파일명: {state.uploadResult.filename}</Typography>
            <Typography variant="body2">총 레코드: {state.uploadResult.total_records}</Typography>
            <Typography variant="body2">
              처리된 레코드: {state.uploadResult.processed_records}
            </Typography>
            <Typography variant="body2">
              데이터 타입: {state.uploadResult.data_types.join(', ')}
            </Typography>
          </Alert>
        )}

        {state.uploadStatus === 'error' && (
          <Alert severity="error">
            <Typography variant="h6">업로드 실패</Typography>
            <Typography variant="body2">{state.errorMessage}</Typography>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
```

### 4.3 UploadHistory 컴포넌트

```typescript
function UploadHistory() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['upload-history'],
    queryFn: async () => {
      const response = await fetch('/api/data-upload/history/');
      return response.json();
    },
    refetchInterval: 30000, // 30초마다 자동 새로 고침
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">이력을 불러오는 중 오류가 발생했습니다</Alert>;

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Typography variant="h6">업로드 이력</Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>파일명</TableCell>
                <TableCell>상태</TableCell>
                <TableCell>레코드 수</TableCell>
                <TableCell>업로드 일시</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell>{log.filename}</TableCell>
                  <TableCell>
                    <Chip
                      label={log.status === 'success' ? '성공' : '실패'}
                      color={log.status === 'success' ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell>{log.processed_records} / {log.total_records}</TableCell>
                  <TableCell>{new Date(log.uploaded_at).toLocaleString('ko-KR')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
```

---

## 5. 데이터 로딩 흐름

```
사용자가 파일 선택
    ↓
dispatch({ type: 'SELECT_FILE', payload: file })
    ↓
selectedFile 상태 업데이트
    ↓
파일명 표시, 업로드 버튼 활성화
    ↓
사용자가 '업로드' 버튼 클릭
    ↓
dispatch({ type: 'START_UPLOAD' })
    ↓
uploadStatus = 'uploading'
    ↓
XMLHttpRequest로 파일 전송 시작
    ↓
진행률 이벤트 → dispatch({ type: 'UPDATE_PROGRESS', payload: % })
    ↓
서버 응답 수신
    ↓
성공: dispatch({ type: 'UPLOAD_SUCCESS', payload: result })
실패: dispatch({ type: 'UPLOAD_ERROR', payload: errorMessage })
    ↓
UI 업데이트 (성공 메시지 또는 에러 메시지)
    ↓
queryClient.invalidateQueries(['upload-history'])
    ↓
업로드 이력 목록 자동 새로 고침
```

---

## 6. 컴포넌트 구조

```
DataUploadPage (useReducer로 상태 관리)
├─ FileUploader (state, handlers props로 전달)
│  ├─ 파일 선택 input
│  ├─ 업로드 버튼
│  └─ 초기화 버튼
├─ UploadStatus (state props로 전달)
│  ├─ 업로드 중: LinearProgress
│  ├─ 성공: Alert (성공 메시지 + 결과 정보)
│  └─ 실패: Alert (에러 메시지)
└─ UploadHistory (useQuery로 이력 조회)
   └─ Table (업로드 이력 목록)
```

---

## 7. 구현 우선순위

1. **useReducer + Actions** (업로드 상태 관리)
2. **파일 선택 및 검증** (클라이언트 측)
3. **XMLHttpRequest + 진행률** (업로드 구현)
4. **성공/에러 처리** (UI 피드백)
5. **TanStack Query (이력)** (업로드 이력 조회)

---

## 8. 테스트 전략

### Unit Test
- `uploadReducer` 함수 테스트 (각 액션별 상태 전환)
- 파일 선택 로직 테스트
- 업로드 진행률 계산 테스트

### Integration Test
- 파일 선택 → 업로드 → 성공 전체 흐름
- 파일 선택 → 업로드 → 실패 → 재시도
- 업로드 성공 후 이력 목록 자동 새로 고침

---

## 요약

- **useReducer**: 업로드 진행 상태 관리 (idle → uploading → success/error)
- **Flux 패턴**: 명확한 상태 전환 흐름
- **XMLHttpRequest**: 업로드 진행률 추적 가능
- **TanStack Query**: 업로드 이력 조회 및 자동 새로 고침
- **독립적 컴포넌트**: FileUploader, UploadStatus, UploadHistory 분리
