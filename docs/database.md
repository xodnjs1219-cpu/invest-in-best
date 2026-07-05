# 데이터베이스 설계 문서

## 📊 데이터 흐름 다이어그램

```
┌──────────────────────────────────────────┐
│       관리자 파일 업로드                    │
│  (department_kpi.csv / publication_list) │
└────────────────┬─────────────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ DataUploadLog 기록  │
        │ (업로드 이력 저장)   │
        └────────┬───────────┘
                 │
                 ▼
    ┌───────────────────────────┐
    │ 데이터 파싱 및 검증        │
    │ (Pandas + Python)         │
    └─────────┬─────────────────┘
              │
              ▼
    ┌──────────────────────────────┐
    │ UploadedData 테이블에 저장    │
    │ (모든 데이터를 하나의 테이블)  │
    │ - KPI 데이터               │
    │ - 논문 데이터               │
    │ - 연구 프로젝트 데이터        │
    │ - 학생 명부 데이터            │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ 사용자 조회 및 시각화      │
    │ (대시보드에서 표시)       │
    │ - 차트, 테이블, 필터링    │
    └──────────────────────────┘
```

## 📋 테이블 스키마

### 1. users (사용자 테이블)

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| `id` | BIGSERIAL | PRIMARY KEY | 사용자 ID |
| `username` | VARCHAR(100) | UNIQUE NOT NULL | 로그인 아이디 |
| `password_hash` | VARCHAR(255) | NOT NULL | 해시된 비밀번호 |
| `full_name` | VARCHAR(100) | | 이름 |
| `role` | VARCHAR(20) | DEFAULT 'user' | 역할: 'admin' 또는 'user' |
| `is_active` | BOOLEAN | DEFAULT true | 활성 여부 |
| `is_locked` | BOOLEAN | DEFAULT false | 잠금 여부 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 생성 시간 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 수정 시간 |

---

### 2. data_upload_logs (데이터 업로드 이력 테이블)

파일 업로드 성공/실패 이력을 기록하는 테이블

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| `id` | BIGSERIAL | PRIMARY KEY | 이력 ID |
| `user_id` | BIGINT | NOT NULL, FK | 업로드한 사용자 ID |
| `filename` | VARCHAR(255) | NOT NULL | 업로드된 파일명 |
| `file_size` | INTEGER | | 파일 크기 (바이트) |
| `status` | VARCHAR(20) | NOT NULL | 상태: 'pending', 'success', 'failed' |
| `error_message` | TEXT | | 실패 시 에러 메시지 |
| `total_records` | INTEGER | | 파일의 총 레코드 수 |
| `processed_records` | INTEGER | | 처리된 레코드 수 |
| `uploaded_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 업로드 시간 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 수정 시간 |

**외래키**: `user_id` → `users(id)` (CASCADE DELETE)

---

### 3. uploaded_data (업로드된 데이터 테이블)

엑셀에서 파싱된 모든 데이터를 저장하는 단일 테이블

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| `id` | BIGSERIAL | PRIMARY KEY | 데이터 ID |
| `upload_log_id` | BIGINT | NOT NULL, FK | 업로드 이력 ID |
| `data_type` | VARCHAR(50) | NOT NULL | 데이터 타입: 'kpi', 'publication', 'research', 'student' |
| `year` | INTEGER | | 연도 (예: 2023, 2024) |
| `semester` | VARCHAR(10) | | 학기 (KPI 데이터용) |
| `college` | VARCHAR(100) | | 단과대학/학부 |
| `department` | VARCHAR(100) | | 학과 |
| `metadata` | JSONB | NOT NULL | 타입별 추가 데이터를 JSON으로 저장 |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 생성 시간 |
| `updated_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | 수정 시간 |

**외래키**: `upload_log_id` → `data_upload_logs(id)` (CASCADE DELETE)

---

## 📝 metadata (JSONB) 필드 구조

### data_type = 'kpi' (부서별 KPI 데이터)

```json
{
  "graduation_rate": 85.5,
  "tenured_faculty": 15,
  "visiting_faculty": 4,
  "tech_transfer_income": 8.5,
  "international_conference_count": 2
}
```

### data_type = 'publication' (논문 데이터)

```json
{
  "paper_id": "PUB-23-001",
  "publication_date": "2023-02-18",
  "paper_title": "A Study on Low-Power Semiconductor Design",
  "first_author": "김민준",
  "co_authors": ["박지훈", "최민서"],
  "journal_name": "IEEE Transactions on Circuits and Systems",
  "journal_level": "SCIE",
  "impact_factor": 3.9,
  "research_linked": true
}
```

### data_type = 'research' (연구 프로젝트 데이터)

```json
{
  "execution_id": "T2301001",
  "project_number": "NRF-2023-015",
  "project_name": "차세대 AI 반도체 설계",
  "researcher_in_charge": "김민준",
  "funding_agency": "한국연구재단",
  "total_research_budget": 500000000,
  "execution_date": "2023-03-15",
  "execution_item": "연구장비 도입",
  "execution_amount": 120000000,
  "status": "집행완료",
  "remarks": "A-1급 스펙트로미터"
}
```

### data_type = 'student' (학생 명부 데이터)

```json
{
  "student_id": "20201101",
  "name": "김유진",
  "grade": 4,
  "degree_type": "학사",
  "academic_status": "재학",
  "gender": "여",
  "admission_year": 2020,
  "advisor": "이서연",
  "email": "yjkim@university.ac.kr"
}
```

---

## 🔑 인덱스

```sql
CREATE INDEX idx_data_upload_logs_user_id ON data_upload_logs(user_id);
CREATE INDEX idx_data_upload_logs_status ON data_upload_logs(status);
CREATE INDEX idx_uploaded_data_upload_log_id ON uploaded_data(upload_log_id);
CREATE INDEX idx_uploaded_data_type ON uploaded_data(data_type);
CREATE INDEX idx_uploaded_data_year ON uploaded_data(year);
CREATE INDEX idx_uploaded_data_college_department ON uploaded_data(college, department);
```

---

## 📌 설계 원칙

1. **단일 테이블 전략**: 모든 데이터 타입을 `uploaded_data` 테이블 하나로 관리
   - `data_type` 컬럼으로 데이터 타입 구분
   - `metadata` JSONB 필드로 타입별 추가 정보 저장

2. **CASCADE DELETE**: 업로드 파일 삭제 시 관련 데이터도 자동 삭제
   - 데이터 일관성 유지
   - 업로드 이력 삭제 시 모든 레코드 정리

3. **유연한 구조**: JSONB를 통한 타입별 확장성
   - 새로운 데이터 타입 추가 시 스키마 변경 불필요
   - 각 타입별 고유 필드를 JSON으로 저장

4. **검색 최적화**: 자주 사용되는 컬럼에 인덱스 설정
   - `year`, `college`, `department` 등 필터링 필드
   - 대시보드 쿼리 성능 향상
