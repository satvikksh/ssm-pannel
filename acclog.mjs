const B = "http://localhost:4000/api/v1";
const q = (p, body, method = "GET") =>
  fetch(B + p, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (r) => ({ s: r.status, b: await r.json().catch(() => ({})) }));

async function main() {
  const SA_EMAIL = "admin_acc_1789412147@example.com";
  const SA_PASS = "AccPass77!";
  const EMAIL = "full_" + Date.now() + "@example.com";
  const PASS = "FullPass88!";

  const data = (r) => r.b?.data ?? r.b;

  // 1) super admin login
  const saLogin = await q("/auth/login", { email: SA_EMAIL, password: SA_PASS }, "POST");
  const SAT = data(saLogin)?.accessToken;
  console.log("1 sa-login:", saLogin.s, "token:", SAT ? "ok" : JSON.stringify(saLogin.b).slice(0, 200));
  if (!SAT) return;

  // 2) super admin creates candidate admin
  const created = await q("/admin/admins", { email: EMAIL, password: PASS, name: "Full Acceptance Admin", role: "admin" }, "POST");
  const cd = data(created);
  const admin = cd?.admin ?? (Array.isArray(cd) ? cd[0] : cd);
  const adminId = admin?._id ?? admin?.id;
  console.log("2 create-admin:", created.s, "id:", adminId, "role:", admin?.role);

  // 3) candidate admin's OWN panel state (before license): must be blocked
  const aLogin = await q("/auth/login", { email: EMAIL, password: PASS }, "POST");
  const AT = data(aLogin)?.accessToken;
  const me0 = await q("/auth/me", null, "GET").catch(() => null);
  // blocked via login-gate message in token? /auth/me needs token:
  const me = await q("/auth/me", { accessToken: AT }, "POST");
  console.log("3 /auth/me pre-license:", (data(me)?.adminLicense) ? JSON.stringify(data(me).adminLicense) : JSON.stringify(me.b).slice(0, 160));
  return;
}

main().catch(console.error);
