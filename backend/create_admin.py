"""Create or reset the single owner account.

Usage (from the backend folder):
    python create_admin.py
"""
import getpass
import re
import sys

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Owner
from app.security import hash_password


def strong(pw: str) -> str | None:
    if len(pw) < 10:
        return "at least 10 characters"
    if not re.search(r"[A-Z]", pw) or not re.search(r"[a-z]", pw):
        return "both upper and lower case letters"
    if not re.search(r"\d", pw):
        return "at least one number"
    if not re.search(r"[^A-Za-z0-9]", pw):
        return "at least one symbol (e.g. @ # $ !)"
    return None


def main():
    Base.metadata.create_all(bind=engine)
    print("=== Trust Line Import HUB - Owner account setup ===")
    username = input("Username [shahin]: ").strip() or "shahin"
    full_name = input("Full name [Shahin Perveg]: ").strip() or "Shahin Perveg"
    while True:
        pw = getpass.getpass("New password (hidden): ")
        problem = strong(pw)
        if problem:
            print(f"  ✗ Password needs {problem}.")
            continue
        if pw != getpass.getpass("Repeat password: "):
            print("  ✗ Passwords do not match.")
            continue
        break

    db = SessionLocal()
    try:
        owner = db.scalar(select(Owner))
        if owner:
            owner.username, owner.full_name = username, full_name
            owner.password_hash = hash_password(pw)
            owner.token_version += 1          # log out all existing sessions
            print("[OK] Owner account updated. All old sessions were signed out.")
        else:
            db.add(Owner(username=username, full_name=full_name, password_hash=hash_password(pw)))
            print("[OK] Owner account created.")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nCancelled.")
