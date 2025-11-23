import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req) {
	const { pathname } = req.nextUrl
	const authSecret = process.env.NEXT_AUTH_SECRET

	console.log("🔵 [MIDDLEWARE DEBUG] Pathname:", pathname)
	console.log("🔵 [MIDDLEWARE DEBUG] Full URL:", req.nextUrl.toString())
	console.log("🔵 [MIDDLEWARE DEBUG] Origin:", req.nextUrl.origin)

	// Validate auth via next-auth JWT
	const token = await getToken({ req, secret: authSecret })
	
	console.log("🔵 [MIDDLEWARE DEBUG] Token exists:", !!token)

	// If user is authenticated and hits auth pages, send them to chat
	if (token && (pathname === "/sign-in" || pathname === "/sign-up")) {
		const redirectUrl = req.nextUrl.clone()
		redirectUrl.pathname = "/chat"
		redirectUrl.search = ""
		return NextResponse.redirect(redirectUrl)
	}
	
	// If user is authenticated and hits root, redirect to chat
	if (token && pathname === "/") {
		const redirectUrl = req.nextUrl.clone()
		redirectUrl.pathname = "/chat"
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
		// Use environment variable for base URL, or fallback to current origin
		const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.NEXTAUTH_URL
		const url = baseUrl 
			? new URL("/sign-in", baseUrl)
			: req.nextUrl.clone()
		
		if (!baseUrl) {
			url.pathname = "/sign-in"
			url.search = ""
		}
		
		console.log("🔵 [MIDDLEWARE DEBUG] Redirecting unauthenticated user to:", url.toString())
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


