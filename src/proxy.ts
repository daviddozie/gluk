import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export default async function proxy(req: NextRequest) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const { pathname } = req.nextUrl;

    // Allow auth routes and login page
    if (
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/_next") ||
        pathname === "/favicon.ico"
    ) {
        return NextResponse.next();
    }

    // Guests have no thread memory; redirect any /c/* requests to '/'
    if (pathname.startsWith("/c/") && !token) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    // Publicly accessible paths (guest chat, login, next assets)
    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};