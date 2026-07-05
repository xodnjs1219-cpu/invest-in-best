-- Migration: 0001_create_tables.sql
-- Description: Create initial database schema for university data visualization dashboard
-- Created: 2025-01-01

BEGIN;

-- ============================================================================
-- 1. users 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. data_upload_logs 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_upload_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    total_records INTEGER,
    processed_records INTEGER,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. uploaded_data 테이블
-- ============================================================================
CREATE TABLE IF NOT EXISTS uploaded_data (
    id BIGSERIAL PRIMARY KEY,
    upload_log_id BIGINT NOT NULL REFERENCES data_upload_logs(id) ON DELETE CASCADE,
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('kpi', 'publication', 'research', 'student')),
    year INTEGER,
    semester VARCHAR(10),
    college VARCHAR(100),
    department VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. 인덱스 생성
-- ============================================================================

-- data_upload_logs 인덱스
CREATE INDEX IF NOT EXISTS idx_data_upload_logs_user_id
    ON data_upload_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_data_upload_logs_status
    ON data_upload_logs(status);

CREATE INDEX IF NOT EXISTS idx_data_upload_logs_uploaded_at
    ON data_upload_logs(uploaded_at DESC);

-- uploaded_data 인덱스
CREATE INDEX IF NOT EXISTS idx_uploaded_data_upload_log_id
    ON uploaded_data(upload_log_id);

CREATE INDEX IF NOT EXISTS idx_uploaded_data_type
    ON uploaded_data(data_type);

CREATE INDEX IF NOT EXISTS idx_uploaded_data_year
    ON uploaded_data(year);

CREATE INDEX IF NOT EXISTS idx_uploaded_data_college_department
    ON uploaded_data(college, department);

CREATE INDEX IF NOT EXISTS idx_uploaded_data_metadata
    ON uploaded_data USING GIN(metadata);

-- ============================================================================
-- 5. updated_at 자동 업데이트 트리거
-- ============================================================================

-- 트리거 함수 생성 (이미 존재하면 스킵)
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users 테이블 트리거
CREATE TRIGGER trigger_users_update_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- data_upload_logs 테이블 트리거
CREATE TRIGGER trigger_data_upload_logs_update_timestamp
BEFORE UPDATE ON data_upload_logs
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- uploaded_data 테이블 트리거
CREATE TRIGGER trigger_uploaded_data_update_timestamp
BEFORE UPDATE ON uploaded_data
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

COMMIT;
