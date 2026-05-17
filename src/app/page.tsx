import { redirect } from "next/navigation";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default function AppRootPage() {
  redirect(appUrl ? new URL("/home", appUrl).toString() : "/home");
}
