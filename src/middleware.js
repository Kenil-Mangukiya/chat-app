import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req) {
	const { pathname } = req.nextUrl
	const authSecret = process.env.NEXT_AUTH_SECRET

	// Validate auth via next-auth JWT
	const token = await getToken({ req, secret: authSecret })

	// If user is authenticated and hits auth pages, send them to UI
	if (token && (pathname === "/sign-in" || pathname === "/sign-up")) {
		const redirectUrl = req.nextUrl.clone()
		redirectUrl.pathname = "/ui"
		redirectUrl.search = ""
		return NextResponse.redirect(redirectUrl)
	}

	// Allowlist public and static routes for unauthenticated users
	const publicPaths = ["/sign-in", "/sign-up", "/favicon.ico"]
	const isStaticOrApi =
		pathname.startsWith("/_next/") ||
		pathname.startsWith("/api/") ||
		pathname.startsWith("/static/") ||
		pathname.match(/\.(.*)$/)

	if (publicPaths.includes(pathname) || isStaticOrApi) {
		return NextResponse.next()
	}

	// Not authenticated on protected path: redirect to sign-in without query params
	if (!token) {
		const url = req.nextUrl.clone()
		url.pathname = "/sign-in"
		url.search = ""
		return NextResponse.redirect(url)
	}

	// Authenticated and not on auth pages: continue
	return NextResponse.next()
}

export const config = {
	matcher: [
		// Run on most routes, including auth pages for logged-in redirect
		"/:path*",
	],
}


