import { redirect } from "next/navigation";

/**
 * Backward-compatibility redirect.
 * Old bookmarks at /wheel/:id are redirected to /features/wheel/:id.
 */
export default async function WheelRedirect({ params }) {
  const { id } = await params;
  redirect(`/features/wheel/${id}`);
}
