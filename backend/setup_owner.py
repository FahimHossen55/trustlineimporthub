"""Script to ensure owner Shahin Perveg exists with initial credentials.

Usage:
  python setup_owner.py [username] [password]
"""
import sys
from sqlalchemy import select
from app.database import Base, SessionLocal, engine
from app.models import Owner
from app.security import hash_password

def main():
    Base.metadata.create_all(bind=engine)
    username = sys.argv[1] if len(sys.argv) > 1 else "shahin"
    password = sys.argv[2] if len(sys.argv) > 2 else "Shahin@2026!"
    full_name = "Shahin Perveg"

    db = SessionLocal()
    try:
        owner = db.scalar(select(Owner))
        if owner:
            owner.username = username
            owner.full_name = full_name
            owner.password_hash = hash_password(password)
            owner.token_version += 1
            print(f"[OK] Owner credentials updated: Username '{username}'")
        else:
            db.add(Owner(username=username, full_name=full_name, password_hash=hash_password(password)))
            print(f"[OK] Owner account created: Username '{username}'")
        db.commit()
    finally:
        db.close()

if __name__ == "__main__":
    main()
