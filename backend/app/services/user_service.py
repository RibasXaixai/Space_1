from sqlalchemy.orm import Session

from app.models.user import User


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def create_user(db: Session, email: str, password_hash: str) -> User:
    new_user = User(email=email, password_hash=password_hash)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


def update_user_location(db: Session, user: User, location: str) -> User:
    user.location = location.strip()
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
