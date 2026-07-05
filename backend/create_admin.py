"""
Create admin user in custom User table.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.authentication.models import User

# 관리자 계정 생성
username = input("관리자 아이디를 입력하세요 (기본값: admin): ") or "admin"
password = input("비밀번호를 입력하세요 (기본값: admin123): ") or "admin123"
full_name = input("이름을 입력하세요 (기본값: 관리자): ") or "관리자"

# 이미 존재하는지 확인
if User.objects.filter(username=username).exists():
    print(f"❌ 사용자 '{username}'는 이미 존재합니다.")
    exit(1)

# 관리자 생성
user = User(
    username=username,
    full_name=full_name,
    role='admin',
    is_active=True,
    is_locked=False,
)
user.set_password(password)
user.save()

print(f"\n✅ 관리자 계정이 생성되었습니다!")
print(f"   아이디: {username}")
print(f"   이름: {full_name}")
print(f"   역할: admin")
