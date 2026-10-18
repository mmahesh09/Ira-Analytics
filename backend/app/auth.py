"""Request guards backed by Better Auth sessions.

Sign-up, sign-in and sign-out are handled by Better Auth in the Next.js app (frontend/src/lib/auth.ts).
The browser sends its session cookie with every /api call (same origin via the Next.js rewrite);
here we look the token up in Better Auth's `session` table.
"""

from datetime import datetime, timezone
from urllib.parse import unquote

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .schema import AuthSession, Site, User

# the __Secure- prefix is used when Better Auth runs on HTTPS
COOKIES = ("__Secure-better-auth.session_token", "better-auth.session_token")


def _session_token(request: Request) -> str | None:
    for name in COOKIES:
        if value := request.cookies.get(name):
            # cookie value is "<token>.<signature>"; the token alone identifies the session row
            return unquote(value).split(".", 1)[0]
    return None


async def current_user(request: Request, db: AsyncSession = Depends(get_session)) -> User:
    token = _session_token(request)
    if not token:
        raise HTTPException(401, "Sign in to continue.")
    user = await db.scalar(
        select(User)
        .join(AuthSession, AuthSession.user_id == User.id)
        .where(AuthSession.token == token, AuthSession.expires_at > datetime.now(timezone.utc))
    )
    if not user:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    return user


async def owned_site(site_id: int, user: User = Depends(current_user), db: AsyncSession = Depends(get_session)) -> Site:
    """Loads a site the signed-in user owns. Other users' sites look like they don't exist."""
    site = await db.get(Site, site_id)
    if not site or site.owner_id != user.id:
        raise HTTPException(404, "Site not found.")
    return site
