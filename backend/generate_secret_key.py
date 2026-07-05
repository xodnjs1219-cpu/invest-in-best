"""
Django Secret Key Generator
Railway 배포를 위한 SECRET_KEY 생성 스크립트
"""
from django.core.management.utils import get_random_secret_key

if __name__ == '__main__':
    secret_key = get_random_secret_key()
    print("\n" + "="*60)
    print("Django Secret Key Generated:")
    print("="*60)
    print(f"\n{secret_key}\n")
    print("="*60)
    print("\nRailway 환경 변수에 다음과 같이 추가하세요:")
    print(f"DJANGO_SECRET_KEY={secret_key}")
    print("="*60 + "\n")
