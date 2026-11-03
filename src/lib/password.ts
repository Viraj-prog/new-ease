// Returns an alert [title, message] for the first problem with a new password, or null if it is fine.
export function passwordProblem(password: string, confirm: string): [string, string] | null {
  if (password.length < 6) return ['Weak password', 'Your password must be at least 6 characters.'];
  if (password !== confirm) return ['Passwords do not match', 'Re-enter your password in both fields.'];
  return null;
}
