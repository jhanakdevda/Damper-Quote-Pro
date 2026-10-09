import time
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from app.database import get_db
from app.models import User
from app.schemas import Token, LoginRequest, PasswordChangeRequest, UserResponse
from app.security import verify_password, get_password_hash, create_access_token
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# In-memory rate limiter for login: tracks timestamps of requests per IP/email
_login_attempts = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
MAX_LOGIN_ATTEMPTS = 15  # requests per window

def check_login_rate_limit(key: str):
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW
    # Clean expired
    _login_attempts[key] = [t for t in _login_attempts[key] if t > cutoff]
    if len(_login_attempts[key]) >= MAX_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait 60 seconds before trying again."
        )
    _login_attempts[key].append(now)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

def require_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Blocks any API access if the user must change password."""
    if current_user.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password change required before accessing system resources."
        )
    return current_user

def require_roles(allowed_roles: list):
    def role_checker(current_user: User = Depends(get_current_user)):
        # Normalize allowed roles to match both Manager and Manager/Approver
        normalized_allowed = set()
        for r in allowed_roles:
            normalized_allowed.add(r)
            if r == "Manager":
                normalized_allowed.add("Manager/Approver")
            elif r == "Manager/Approver":
                normalized_allowed.add("Manager")
                
        if current_user.role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

@router.post("/login", response_model=Token)
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    # Rate limit check per email
    check_login_rate_limit(creds.email.lower().strip())
    
    user = db.query(User).filter(User.email == creds.email.strip()).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        # Generic error message: never reveal whether account exists
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "must_change_password": user.must_change_password
        }
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-password")
def change_password(
    data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters"
        )
        
    current_user.hashed_password = get_password_hash(data.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully"}
