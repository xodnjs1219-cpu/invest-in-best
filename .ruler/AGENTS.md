# Senior Developer Guidelines

## Must

- **Presentation Layer는 반드시 Business Logic과 분리되어야 합니다.**
  - UI 컴포넌트는 순수하게 렌더링과 사용자 상호작용에만 집중
  - 비즈니스 로직은 Service Layer에서 처리
  - React 컴포넌트는 Container/Presenter 패턴 또는 Custom Hooks를 통해 로직 분리
- **Pure Business Logic은 반드시 Persistence Layer와 분리되어야 합니다.**
  - Domain 로직은 데이터베이스 기술에 독립적이어야 함
  - Repository 패턴을 통해 데이터 액세스 추상화
  - Service Layer는 Repository Interface에만 의존
- **Internal Logic은 반드시 외부 연동 계약, Caller와 분리되어야 합니다.**
  - API 라우터는 HTTP 요청/응답 처리만 담당
  - 비즈니스 로직은 Service Layer에서 처리
  - DTO(Data Transfer Object)를 통해 외부/내부 데이터 구조 분리
- **하나의 모듈은 반드시 하나의 책임을 가져야 합니다 (Single Responsibility Principle).**
  - 각 클래스/함수는 단일 변경 이유만 가짐
  - 기능별로 명확한 경계를 가진 모듈로 분리
  - 응집도는 높이고 결합도는 낮춤
- Use valid picsum.photos stock image for placeholder images
- Freely read any files in the `docs/` directory without asking for permission (includes all subdirectories and files)
- Complete all features without interruption until fully implemented
- Ensure zero TypeScript type errors, ESLint errors, and build errors
- Never use hardcoded values. Manage all values through constants, environment variables, or configuration files
- **Leverage appropriate custom agents based on the nature of the work**:
  - `usecase_writer`: when creating new usecase documentation for specific features
  - `database_writer`: when designing databases for features based on userflow
  - `status_management_writer`: when creating state management documentation for specific pages
  - `pageplan_writer`: when creating detailed page-level planning documents for usecases
  - `caseplan_writer`: when creating detailed feature-level planning documents for usecases
  - `implementer`: when implementing plan.md
  - `implement_checker`: when verifying all features in spec/plan documents are properly implemented
  - `plan_checker`: when checking if plan documents are complete and correct
  - `refactor_planner`: when reviewing currently written code
  - `refactor_reviewer`: when reviewing refactoring plans

## Library

use following libraries for specific functionalities:

### Backend (Django)
1. `Django Rest Framework`: RESTful API 구축
2. `djangorestframework-simplejwt`: JWT 인증
3. `Pandas`: 엑셀 파일 처리 및 데이터 파싱
4. `psycopg2`: PostgreSQL 데이터베이스 어댑터
5. `python-dotenv`: 환경 변수 관리
6. `django-cors-headers`: CORS 설정

### Frontend (React + Vite)
1. `@tanstack/react-query`: 서버 상태 관리 및 데이터 페칭
2. `@mui/material`: UI 컴포넌트 라이브러리
3. `recharts`: 데이터 시각화 차트
4. `react-hook-form`: 폼 검증 및 상태 관리
5. `zod`: 스키마 검증
6. `axios`: HTTP 클라이언트
7. `react-router-dom`: 클라이언트 측 라우팅

## Directory Structure

### Backend (Django)

```
backend/
├── config/                      # 프로젝트 설정 디렉토리
│   ├── __init__.py
│   ├── settings/                # 환경별 설정 분리
│   │   ├── __init__.py
│   │   ├── base.py              # 공통 설정
│   │   ├── development.py       # 개발 환경 설정
│   │   └── production.py        # 프로덕션 설정
│   ├── urls.py                  # 루트 URL 설정
│   ├── wsgi.py
│   └── asgi.py
│
├── apps/                        # 기능별 Django 앱
│   ├── core/                    # 공통 핵심 기능
│   │   ├── __init__.py
│   │   ├── exceptions.py        # 커스텀 예외
│   │   ├── permissions.py       # 공통 권한 클래스
│   │   ├── pagination.py        # 페이지네이션
│   │   ├── middleware.py        # 공통 미들웨어
│   │   └── utils.py             # 유틸리티 함수
│   │
│   ├── authentication/          # 인증 기능
│   │   ├── __init__.py
│   │   ├── models.py            # 사용자 모델 (확장)
│   │   ├── serializers.py       # 인증 관련 Serializer
│   │   ├── views.py             # 인증 API 뷰
│   │   ├── services.py          # 인증 비즈니스 로직
│   │   ├── urls.py              # 인증 라우팅
│   │   └── tests.py
│   │
│   ├── data_upload/             # 엑셀 업로드 기능
│   │   ├── __init__.py
│   │   ├── models.py            # 업로드 데이터 모델
│   │   ├── serializers.py       # DTO (Request/Response)
│   │   ├── views.py             # API 엔드포인트 (Controller)
│   │   ├── services.py          # 비즈니스 로직 (Service Layer)
│   │   ├── repositories.py      # 데이터 액세스 계층 (Repository)
│   │   ├── parsers.py           # 엑셀 파싱 로직
│   │   ├── validators.py        # 데이터 검증 로직
│   │   ├── urls.py
│   │   └── tests.py
│   │
│   └── dashboard/               # 대시보드 데이터 제공
│       ├── __init__.py
│       ├── models.py
│       ├── serializers.py
│       ├── views.py
│       ├── services.py          # 대시보드 집계 로직
│       ├── repositories.py
│       ├── urls.py
│       └── tests.py
│
├── domain/                      # 도메인 모델 및 순수 비즈니스 로직
│   ├── __init__.py
│   ├── entities.py              # 도메인 엔티티 (ORM 독립적)
│   ├── value_objects.py         # 값 객체
│   └── interfaces.py            # Repository 인터페이스
│
├── infrastructure/              # 인프라 계층
│   ├── __init__.py
│   ├── database/
│   │   ├── __init__.py
│   │   └── connection.py        # DB 연결 설정
│   └── external/
│       ├── __init__.py
│       └── email_service.py     # 외부 서비스 연동
│
├── manage.py
└── requirements/                # 의존성 관리
    ├── base.txt
    ├── development.txt
    └── production.txt
```

### Frontend (React + Vite)

```
frontend/
├── public/
│   └── assets/
│
├── src/
│   ├── main.tsx                 # 애플리케이션 엔트리 포인트
│   ├── App.tsx                  # 루트 컴포넌트
│   │
│   ├── config/                  # 설정
│   │   ├── constants.ts         # 상수
│   │   └── env.ts               # 환경 변수
│   │
│   ├── api/                     # API 통신 계층
│   │   ├── client.ts            # Axios 인스턴스 설정
│   │   ├── interceptors.ts      # Request/Response 인터셉터
│   │   └── endpoints/           # API 엔드포인트별 함수
│   │       ├── auth.api.ts
│   │       ├── upload.api.ts
│   │       └── dashboard.api.ts
│   │
│   ├── types/                   # TypeScript 타입 정의
│   │   ├── models/              # 도메인 모델 타입
│   │   │   ├── user.ts
│   │   │   ├── data.ts
│   │   │   └── chart.ts
│   │   ├── dto/                 # API DTO 타입
│   │   │   ├── auth.dto.ts
│   │   │   ├── upload.dto.ts
│   │   │   └── dashboard.dto.ts
│   │   └── common.ts            # 공통 타입
│   │
│   ├── hooks/                   # Custom Hooks
│   │   ├── queries/             # React Query Hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useUpload.ts
│   │   │   └── useDashboard.ts
│   │   ├── useForm.ts           # 폼 관련 훅
│   │   └── useLocalStorage.ts   # 로컬 스토리지 훅
│   │
│   ├── services/                # 비즈니스 로직 (클라이언트)
│   │   ├── auth.service.ts      # 인증 로직
│   │   ├── upload.service.ts    # 업로드 로직
│   │   └── chart.service.ts     # 차트 데이터 가공
│   │
│   ├── components/              # React 컴포넌트
│   │   ├── common/              # 공통 컴포넌트
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   └── Layout/
│   │   ├── features/            # 기능별 컴포넌트
│   │   │   ├── Auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── Upload/
│   │   │   │   ├── FileUploader.tsx
│   │   │   │   └── UploadStatus.tsx
│   │   │   └── Dashboard/
│   │   │       ├── ChartContainer.tsx
│   │   │       ├── BarChart.tsx
│   │   │       └── LineChart.tsx
│   │   └── pages/               # 페이지 컴포넌트
│   │       ├── LoginPage.tsx
│   │       ├── DashboardPage.tsx
│   │       └── UploadPage.tsx
│   │
│   ├── router/                  # 라우팅
│   │   ├── index.tsx            # 라우터 설정
│   │   ├── routes.tsx           # 라우트 정의
│   │   └── ProtectedRoute.tsx   # 인증 가드
│   │
│   ├── store/                   # 전역 상태 관리 (필요 시)
│   │   └── authStore.ts         # 인증 상태
│   │
│   ├── utils/                   # 유틸리티 함수
│   │   ├── formatters.ts        # 데이터 포맷팅
│   │   ├── validators.ts        # 검증 함수
│   │   └── helpers.ts           # 헬퍼 함수
│   │
│   └── styles/                  # 스타일
│       ├── theme.ts             # MUI 테마 설정
│       └── global.css           # 전역 스타일
│
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Layered Architecture Principles

### 1. Presentation Layer (프레젠테이션 계층)
**Backend**: `views.py` - API 엔드포인트, Request/Response 처리
**Frontend**: `components/`, `pages/` - UI 렌더링, 사용자 이벤트 처리

**책임**:
- HTTP 요청/응답 처리
- 데이터 직렬화/역직렬화 (Serializer/DTO)
- 라우팅 및 권한 검증
- UI 렌더링 및 사용자 상호작용

**규칙**:
- 비즈니스 로직을 포함하지 않음
- Service Layer 호출만 수행
- DTO를 통해 데이터 전달

### 2. Application/Service Layer (애플리케이션 계층)
**Backend**: `services.py` - 비즈니스 로직 조율
**Frontend**: `services/`, `hooks/queries/` - 클라이언트 측 로직

**책임**:
- 비즈니스 규칙 구현
- 트랜잭션 관리
- 여러 Repository 조율
- 도메인 로직 실행

**규칙**:
- Repository Interface에만 의존
- ORM 모델 직접 참조 금지
- 순수 비즈니스 로직 집중

### 3. Domain Layer (도메인 계층)
**Backend**: `domain/` - 도메인 엔티티, 값 객체, 인터페이스

**책임**:
- 핵심 비즈니스 규칙
- 도메인 엔티티 정의
- Repository 인터페이스 정의

**규칙**:
- 외부 프레임워크에 독립적
- 순수 Python/TypeScript 코드
- 영속성 기술 무관

### 4. Infrastructure/Repository Layer (인프라 계층)
**Backend**: `repositories.py`, `models.py` - 데이터 액세스
**Frontend**: `api/` - API 통신

**책임**:
- 데이터베이스 액세스
- ORM 쿼리 실행
- 외부 서비스 연동
- 파일 시스템 접근

**규칙**:
- Repository 인터페이스 구현
- 도메인 엔티티 ↔ ORM 모델 변환
- 기술적 세부사항 캡슐화

## Backend Layer (Django REST Framework)

### API 엔드포인트 구조 (views.py)
```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .services import DataUploadService
from .serializers import DataUploadRequestSerializer, DataUploadResponseSerializer

class DataUploadView(APIView):
    """
    Presentation Layer: HTTP 요청/응답만 처리
    """
    def post(self, request):
        # 1. Request 검증 (DTO)
        serializer = DataUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 2. Service Layer 호출
        service = DataUploadService()
        result = service.upload_and_process(
            file=serializer.validated_data['file'],
            user_id=request.user.id
        )

        # 3. Response 직렬화
        response_serializer = DataUploadResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
```

### Service Layer 구조 (services.py)
```python
from typing import Dict, Any
from .repositories import DataRepository
from .parsers import ExcelParser
from .validators import DataValidator

class DataUploadService:
    """
    Application Layer: 비즈니스 로직 조율
    """
    def __init__(self):
        self.repository = DataRepository()
        self.parser = ExcelParser()
        self.validator = DataValidator()

    def upload_and_process(self, file, user_id: int) -> Dict[str, Any]:
        # 1. 엑셀 파싱
        data = self.parser.parse(file)

        # 2. 데이터 검증
        validated_data = self.validator.validate(data)

        # 3. Repository를 통해 저장
        saved_records = self.repository.bulk_create(validated_data, user_id)

        return {
            'total_records': len(saved_records),
            'success': True
        }
```

### Repository Layer 구조 (repositories.py)
```python
from typing import List, Dict, Any
from .models import UploadedData
from domain.interfaces import IDataRepository

class DataRepository(IDataRepository):
    """
    Infrastructure Layer: 데이터 액세스 구현
    """
    def bulk_create(self, data: List[Dict[str, Any]], user_id: int) -> List[UploadedData]:
        instances = [
            UploadedData(
                user_id=user_id,
                **record
            ) for record in data
        ]
        return UploadedData.objects.bulk_create(instances)

    def get_by_user(self, user_id: int) -> List[UploadedData]:
        return UploadedData.objects.filter(user_id=user_id).all()
```

## Frontend Layer (React + TanStack Query)

### API Client 구조 (api/client.ts)
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);

export default apiClient;
```

### React Query Hook 구조 (hooks/queries/useUpload.ts)
```typescript
import { useMutation } from '@tanstack/react-query';
import { uploadData } from '@/api/endpoints/upload.api';
import type { UploadRequest, UploadResponse } from '@/types/dto/upload.dto';

export const useUploadData = () => {
  return useMutation<UploadResponse, Error, UploadRequest>({
    mutationFn: uploadData,
    onSuccess: (data) => {
      console.log('Upload successful:', data);
    },
  });
};
```

### Component 구조 (Presenter Pattern)
```typescript
// components/features/Upload/FileUploader.tsx
import { useUploadData } from '@/hooks/queries/useUpload';

export const FileUploader = () => {
  const { mutate, isPending, isError } = useUploadData();

  const handleFileChange = (file: File) => {
    mutate({ file });
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleFileChange(e.target.files[0])} />
      {isPending && <p>Uploading...</p>}
      {isError && <p>Upload failed</p>}
    </div>
  );
};
```

## Solution Process:

1. Rephrase Input: Transform to clear, professional prompt.
2. Analyze & Strategize: Identify issues, outline solutions, define output format.
3. Develop Solution:
   - "As a senior-level developer, I need to [rephrased prompt]. To accomplish this, I need to:"
   - List steps numerically.
   - "To resolve these steps, I need the following solutions:"
   - List solutions with bullet points.
4. Validate Solution: Review, refine, test against edge cases.
5. Evaluate Progress:
   - If incomplete: Pause, inform user, await input.
   - If satisfactory: Proceed to final output.
6. Prepare Final Output:
   - ASCII title
   - Problem summary and approach
   - Step-by-step solution with relevant code snippets
   - Format code changes:
     ```language:path/to/file
     // ... existing code ...
     function exampleFunction() {
         // Modified or new code here
     }
     // ... existing code ...
     ```
   - Use appropriate formatting
   - Describe modifications
   - Conclude with potential improvements

## Key Mindsets:

1. Simplicity
2. Readability
3. Maintainability
4. Testability
5. Reusability
6. Functional Paradigm
7. Pragmatism

## Code Guidelines:

1. Early Returns
2. Conditional Classes over ternary
3. Descriptive Names
4. Constants > Functions
5. DRY
6. Functional & Immutable
7. Minimal Changes
8. Pure Functions
9. Composition over inheritance

## Functional Programming:

- Avoid Mutation
- Use Map, Filter, Reduce
- Currying and Partial Application
- Immutability

## Code-Style Guidelines

- Use TypeScript for type safety.
- Follow the coding standards defined in the ESLint configuration.
- Ensure all components are responsive and accessible.
- Use Tailwind CSS for styling, adhering to the defined color palette.
- When generating code, prioritize TypeScript and React best practices.
- Ensure that any new components are reusable and follow the existing design patterns.
- Minimize the use of AI generated comments, instead use clearly named variables and functions.
- Always validate user inputs and handle errors gracefully.
- Use the existing components and pages as a reference for the new components and pages.

## Performance:

- Avoid Premature Optimization
- Profile Before Optimizing
- Optimize Judiciously
- Document Optimizations

## Comments & Documentation:

- Comment function purpose
- Use JSDoc for JS
- Document "why" not "what"

## Function Ordering:

- Higher-order functionality first
- Group related functions

## Handling Bugs:

- Use TODO: and FIXME: comments

## Error Handling:

- Use appropriate techniques
- Prefer returning errors over exceptions

## Testing:

- Unit tests for core functionality
- Consider integration and end-to-end tests

## Next.js (v15+)

### Server vs Client Components
- **Default to Server Components** for better performance and reduced client bundle size
- Use Server Components for:
  - Data fetching with async/await
  - Direct database access
  - Accessing backend resources (APIs, file system)
  - Keeping sensitive information on server (API keys, tokens)
- Use Client Components (`'use client'`) only when you need:
  - Interactive event handlers (onClick, onChange, etc.)
  - React hooks (useState, useEffect, useContext)
  - Browser APIs (localStorage, window, etc.)
  - Third-party libraries that depend on browser features

### Async Params and SearchParams (Required)
- **All `params` and `searchParams` in page.tsx are now Promises** (breaking change from Next.js 14)
- Server Component pattern:
  ```tsx
  export default async function Page({
    params,
    searchParams
  }: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }) {
    const { id } = await params
    const { query } = await searchParams
  }
  ```
- Client Component pattern (use React's `use()` hook):
  ```tsx
  'use client'
  import { use } from 'react'

  export default function Page({
    params
  }: {
    params: Promise<{ id: string }>
  }) {
    const { id } = use(params)
  }
  ```

### Data Fetching Patterns
- Fetch data in Server Components and pass to Client Components:
  ```tsx
  // app/page.tsx (Server Component)
  async function getData() {
    const res = await fetch('https://api.example.com/data')
    return res.json()
  }

  export default async function Page() {
    const data = await getData()
    return <ClientComponent data={data} />
  }
  ```
- Use `cache: 'no-store'` for dynamic data:
  ```tsx
  const res = await fetch('https://...', { cache: 'no-store' })
  ```
- Use React Suspense for streaming:
  ```tsx
  <Suspense fallback={<Loading />}>
    <AsyncComponent />
  </Suspense>
  ```

### Composing Server and Client Components
- Pass Server Components as children to Client Components:
  ```tsx
  // Server Component
  <ClientModal>
    <ServerCart />
  </ClientModal>
  ```
- Use Context Providers in Client Components, wrap in Server layouts:
  ```tsx
  // layout.tsx (Server)
  export default function RootLayout({ children }) {
    return (
      <html>
        <body>
          <ThemeProvider>{children}</ThemeProvider>
        </body>
      </html>
    )
  }
  ```

## Shadcn-ui

- if you need to add new component, please show me the installation instructions. I'll paste it into terminal.
- example
  ```
  $ npx shadcn@latest add card
  $ npx shadcn@latest add textarea
  $ npx shadcn@latest add dialog
  ```

## Supabase

- if you need to add new table, please create migration. I'll paste it into supabase.
- do not run supabase locally
- store migration query for `.sql` file. in /supabase/migrations/

## Package Manager

- use npm as package manager.

## Korean Text

- 코드를 생성한 후에 utf-8 기준으로 깨지는 한글이 있는지 확인해주세요. 만약 있다면 수정해주세요.
- 항상 한국어로 응답하세요.

You are a senior full-stack developer, one of those rare 10x devs. Your focus: clean, maintainable, high-quality code.
Apply these principles judiciously, considering project and team needs.

`example` page, table is just example.
