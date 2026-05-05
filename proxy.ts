import { clerkMiddleware } from "@clerk/nextjs/server";

// All routes are public until Clerk account + keys are fully configured.
// TODO: re-enable route protection once sign-in/sign-up pages exist:
//   const isProtected = createRouteMatcher(["/sim/saved(.*)", "/api/profile(.*)"])
//   return clerkMiddleware(async (auth, req) => { if (isProtected(req)) await auth.protect() })

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
