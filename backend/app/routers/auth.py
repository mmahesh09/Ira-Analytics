from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..auth import current_user
from ..schema import User

router = APIRouter(prefix="/api", tags=["account"])


class UserOut(BaseModel):
    id: str
    email: str
    name: str


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(current_user)):
    return UserOut(id=user.id, email=user.email, name=user.name or "")
