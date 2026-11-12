/** Logout is a same-origin POST (see app/auth/logout/route.ts). */
export function SignOutButton() {
  return (
    <form action="/auth/logout" method="post">
      <button type="submit" className="secondary">
        Sign out
      </button>
    </form>
  );
}
